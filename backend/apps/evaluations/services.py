import json
import logging
import re
import threading
from decimal import Decimal

from django.db import close_old_connections
from django.utils import timezone

from apps.executions.models import Execution
from apps.executions.services import compose_prompt, run_ollama
from .models import EvaluationResult, EvaluationRun

logger = logging.getLogger(__name__)

JUDGE_SYSTEM_PROMPT = """You are an objective evaluator for an LLM prompt-testing platform.

Evaluate the actual response against the provided user input, expected output, and expected behavior.

You MUST evaluate all four criteria on a 0-100 scale, where each score is an integer between 0 and 100, higher scores indicate better performance, and 0 is reserved strictly for completely irrelevant, incorrect, or harmful outputs:

1. relevance: How directly and specifically the response addresses the user input (0-100).
2. expected_output_alignment: How closely the response satisfies the key information, requirements, and intent of the expected output (0-100).
3. expected_behavior: How strictly the response follows the expected behavioral guidelines, tone, constraints, and instructions (0-100).
4. overall_quality: Overall clarity, coherence, helpfulness, completeness, and correctness of the response (0-100).

Scoring and Feedback Rules:
- Score each criterion realistically from 0 to 100.
- A good, accurate, and helpful response must receive high scores (typically 70-100).
- Do not assign 0 unless the response is entirely wrong, irrelevant, or absent.
- The overall score must be an integer from 0 to 100 representing the average of the four criterion scores.
- Your written feedback MUST agree with your numeric scores. If the response is good, your feedback must be positive and your scores must be high. Do not provide positive feedback with low or zero scores.

You must return ONLY a single valid JSON object with the following fields and types:
- "score": an integer from 0 to 100 representing the overall average score.
- "criteria_scores": a JSON object with exactly four numeric integer fields from 0 to 100:
  - "relevance": integer from 0 to 100
  - "expected_output_alignment": integer from 0 to 100
  - "expected_behavior": integer from 0 to 100
  - "overall_quality": integer from 0 to 100
- "feedback": a concise string explaining and justifying the scores based on evidence from the response.

All four criteria in criteria_scores are strictly required.
Do not omit any criterion.
Do not use a 0-10 scale; always use 0-100.
Do not include markdown formatting, code fences, or any commentary outside the JSON object.
"""


def _extract_json(text):
    """
    Extract a JSON object from the evaluator model's response.
    Handles the occasional case where the model wraps JSON in text/code fences.
    """

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)

    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def evaluate_response(
    *,
    model,
    input_text,
    expected_output,
    expected_behavior,
    actual_output,
):
    """
    Evaluate one generated response using the selected Ollama model
    as an LLM judge.
    """

    evaluation_prompt = f"""
Evaluate the following LLM response.

USER INPUT:
{input_text}

EXPECTED OUTPUT:
{expected_output}

EXPECTED BEHAVIOR:
{expected_behavior}

ACTUAL RESPONSE:
{actual_output}

Return the required JSON structure.
"""

    judge_result = run_ollama(
        model=model,
        user_prompt=evaluation_prompt,
        system_prompt=JUDGE_SYSTEM_PROMPT,
        format="json",
        options={
            "temperature": 0.2,
            "num_predict": 512,
        },
    )

    message = judge_result.get("message", {})
    judge_output = message.get("content", "").strip()

    if not judge_output:
        raise ValueError("The evaluator model returned an empty response.")

    data = _extract_json(judge_output)

    if not isinstance(data, dict):
        raise ValueError("The evaluator model did not return a valid JSON object.")

    if "score" not in data:
        raise ValueError("The evaluator model response is missing 'score'.")

    raw_judge_score = data["score"]
    if isinstance(raw_judge_score, bool):
        raise ValueError(
            f"Overall score has non-numeric boolean value: {raw_judge_score!r}"
        )

    try:
        judge_score = float(raw_judge_score)
    except (TypeError, ValueError):
        raise ValueError(
            f"Overall score has non-numeric value: {raw_judge_score!r}"
        )

    if not (0.0 <= judge_score <= 100.0):
        raise ValueError(
            f"Overall score value {judge_score} is outside 0-100 range."
        )

    criteria_data = data.get("criteria_scores")
    if not isinstance(criteria_data, dict):
        raise ValueError("The evaluator model response is missing 'criteria_scores'.")

    # These four criteria are equally weighted.
    required_criteria = [
        "relevance",
        "expected_output_alignment",
        "expected_behavior",
        "overall_quality",
    ]

    cleaned_criteria = {}
    for key in required_criteria:
        if key not in criteria_data:
            raise ValueError(
                f"The evaluator model response is missing criterion '{key}'."
            )

        value = criteria_data[key]
        if isinstance(value, bool):
            raise ValueError(
                f"Criterion '{key}' has non-numeric boolean value: {value!r}"
            )

        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            raise ValueError(
                f"Criterion '{key}' has non-numeric value: {value!r}"
            )

        if not (0.0 <= numeric_value <= 100.0):
            raise ValueError(
                f"Criterion '{key}' value {numeric_value} is outside 0-100 range."
            )

        cleaned_criteria[key] = round(numeric_value, 2)

    final_score = round(
        sum(cleaned_criteria.values()) / len(cleaned_criteria),
        2,
    )

    if abs(judge_score - final_score) > 0.5:
        raise ValueError(
            f"The evaluator model overall score {judge_score} contradicts the criteria average {final_score}."
        )

    feedback = str(
        data.get("feedback", "")
    ).strip()

    return {
        "score": final_score,
        "criteria_scores": cleaned_criteria,
        "feedback": feedback,
    }


def run_evaluation(evaluation_run):
    """
    Execute every test case in an EvaluationRun,
    store Execution records, and store EvaluationResult records.
    """

    test_cases = list(
        evaluation_run.dataset.test_cases.all().order_by(
            "sort_order",
            "id",
        )
    )

    total_duration = 0
    total_input_tokens = 0
    total_output_tokens = 0

    has_duration = False
    has_input_tokens = False
    has_output_tokens = False

    passed_cases = 0
    scores = []
    has_error = False

    for idx, test_case in enumerate(test_cases):

        execution = Execution.objects.create(
            owner=evaluation_run.owner,
            prompt=evaluation_run.prompt,
            prompt_version=evaluation_run.prompt_version,
            model=evaluation_run.model,
            input_text=test_case.input_text,
            status="running",
        )

        try:
            # Reuse the exact Ollama execution service
            # already used by the Execution Sandbox.
            user_prompt = compose_prompt(
                evaluation_run.prompt_version.content,
                test_case.input_text,
            )
            ollama_result = run_ollama(
                model=evaluation_run.model,
                user_prompt=user_prompt,
                system_prompt=evaluation_run.prompt_version.system_prompt,
            )

            message = ollama_result.get("message", {})

            execution.output_text = message.get(
                "content",
                "",
            )
            execution.status = "completed"

            execution.total_duration = ollama_result.get(
                "total_duration"
            )

            execution.load_duration = ollama_result.get(
                "load_duration"
            )

            execution.prompt_eval_count = ollama_result.get(
                "prompt_eval_count"
            )

            execution.eval_count = ollama_result.get(
                "eval_count"
            )

            execution.save()

            # Collect execution metrics
            if execution.total_duration is not None:
                total_duration += execution.total_duration
                has_duration = True

            if execution.prompt_eval_count is not None:
                total_input_tokens += execution.prompt_eval_count
                has_input_tokens = True

            if execution.eval_count is not None:
                total_output_tokens += execution.eval_count
                has_output_tokens = True

            # Evaluate the generated response
            evaluation = evaluate_response(
                model=evaluation_run.model,
                input_text=test_case.input_text,
                expected_output=test_case.expected_output,
                expected_behavior=test_case.expected_behavior,
                actual_output=execution.output_text,
            )

            score = evaluation["score"]

            result_status = (
                "passed"
                if score >= 70
                else "failed"
            )

            if result_status == "passed":
                passed_cases += 1

            scores.append(score)

            EvaluationResult.objects.create(
                evaluation_run=evaluation_run,
                test_case=test_case,
                execution=execution,
                status=result_status,
                score=Decimal(str(round(score, 2))),
                criteria_scores=evaluation["criteria_scores"],
                feedback=evaluation["feedback"],
            )

        except Exception as exc:
            has_error = True

            execution.status = "failed"
            execution.error_message = str(exc)

            execution.save(
                update_fields=[
                    "status",
                    "error_message",
                ]
            )

            EvaluationResult.objects.create(
                evaluation_run=evaluation_run,
                test_case=test_case,
                execution=execution,
                status="error",
                score=None,
                criteria_scores={},
                feedback=str(exc),
            )

        # Update running progress counts incrementally
        evaluation_run.passed_cases = passed_cases
        evaluation_run.failed_cases = (idx + 1) - passed_cases
        evaluation_run.save(
            update_fields=[
                "passed_cases",
                "failed_cases",
            ]
        )

    evaluation_run.total_cases = len(test_cases)
    evaluation_run.passed_cases = passed_cases

    # Errors are included in failed_cases because they did not pass.
    evaluation_run.failed_cases = (
        len(test_cases) - passed_cases
    )

    if scores:
        average_score = sum(scores) / len(scores)

        evaluation_run.overall_score = Decimal(
            str(round(average_score, 2))
        )
    else:
        evaluation_run.overall_score = None

    evaluation_run.total_duration = (
        total_duration if has_duration else None
    )

    evaluation_run.total_input_tokens = (
        total_input_tokens
        if has_input_tokens
        else None
    )

    evaluation_run.total_output_tokens = (
        total_output_tokens
        if has_output_tokens
        else None
    )

    return has_error


def execute_evaluation_run(evaluation_run_id):
    """
    Worker task that safely executes an EvaluationRun by ID.
    Reloads the run from the database, runs test cases, and updates
    status upon completion or failure.
    """
    try:
        evaluation_run = (
            EvaluationRun.objects.select_related("prompt", "prompt_version", "dataset")
            .prefetch_related("dataset__test_cases")
            .get(pk=evaluation_run_id)
        )

        # Do not run the same evaluation twice if already finished
        if evaluation_run.status in (
            EvaluationRun.Status.COMPLETED,
            EvaluationRun.Status.FAILED,
        ):
            return

        evaluation_run.status = EvaluationRun.Status.RUNNING
        evaluation_run.save(update_fields=["status"])

        has_error = run_evaluation(evaluation_run)

        evaluation_run.completed_at = timezone.now()
        evaluation_run.status = (
            EvaluationRun.Status.FAILED
            if has_error
            else EvaluationRun.Status.COMPLETED
        )
        evaluation_run.save()

    except Exception as exc:
        logger.exception(
            "Unexpected error executing evaluation run %s", evaluation_run_id
        )
        try:
            EvaluationRun.objects.filter(pk=evaluation_run_id).update(
                status=EvaluationRun.Status.FAILED,
                error_message="Evaluation failed due to an unexpected processing error. Please try again.",
                completed_at=timezone.now(),
            )
        except Exception:
            logger.exception(
                "Failed to update status for failed evaluation run %s",
                evaluation_run_id,
            )


def _background_worker(evaluation_run_id):
    """
    Background thread entrypoint that wraps execute_evaluation_run
    with thread-boundary close_old_connections() calls.
    """
    try:
        close_old_connections()
        execute_evaluation_run(evaluation_run_id)
    finally:
        close_old_connections()


def start_evaluation_run_background(evaluation_run_id):
    """
    Spawns a daemon thread to run the evaluation asynchronously.
    Returns the started Thread instance.
    """
    thread = threading.Thread(
        target=_background_worker,
        args=(evaluation_run_id,),
        daemon=True,
        name=f"evaluation-run-{evaluation_run_id}",
    )
    thread.start()
    return thread