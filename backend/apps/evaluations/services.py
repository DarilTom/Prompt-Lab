import json
import re
from decimal import Decimal

from apps.executions.models import Execution
from apps.executions.services import run_ollama
from .models import EvaluationResult

JUDGE_SYSTEM_PROMPT = """
You are an objective evaluator for an LLM prompt-testing platform.

Your job is to evaluate the response produced by another language model.

Evaluate the response using these criteria:

1. Relevance to the user's input
2. Alignment with the expected output
3. Compliance with the expected behavior
4. Overall usefulness and quality

Give an overall score from 0 to 100.

Return ONLY valid JSON in this exact structure:

{
  "score": 0,
  "criteria_scores": {
    "relevance": 0,
    "expected_output_alignment": 0,
    "expected_behavior": 0,
    "overall_quality": 0
  },
  "feedback": "Brief explanation of the score."
}

Do not include markdown.
Do not include additional fields.
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
    )

    message = judge_result.get("message", {})
    judge_output = message.get("content", "").strip()

    if not judge_output:
        raise ValueError("The evaluator model returned an empty response.")

    data = _extract_json(judge_output)

    if not data:
        # Fallback: try to recover just the score if JSON formatting failed.
        score_match = re.search(
            r'"score"\s*:\s*(\d+(?:\.\d+)?)',
            judge_output,
        )

        if not score_match:
            raise ValueError(
                "The evaluator model did not return valid JSON."
            )

        score = float(score_match.group(1))

        return {
            "score": max(0.0, min(100.0, score)),
            "criteria_scores": {},
            "feedback": judge_output,
        }

    raw_score = data.get("score", 0)

    try:
        score = float(raw_score)
    except (TypeError, ValueError):
        score = 0.0

    score = max(0.0, min(100.0, score))

    criteria_scores = data.get(
        "criteria_scores",
        {}
    )

    if not isinstance(criteria_scores, dict):
        criteria_scores = {}

    # These four criteria are equally weighted.
    required_criteria = [
        "relevance",
        "expected_output_alignment",
        "expected_behavior",
        "overall_quality",
    ]

    cleaned_criteria = {}

    for key in required_criteria:
        value = criteria_scores.get(key)

        try:
            cleaned_criteria[key] = max(
                0.0,
                min(100.0, float(value))
            )
        except (TypeError, ValueError):
            # If the judge does not return a usable value,
            # fall back to the judge's overall score.
            cleaned_criteria[key] = score

    # Calculate the final score ourselves so that the
    # overall score always matches the criterion scores.
    final_score = (
        sum(cleaned_criteria.values())
        / len(required_criteria)
    )

    feedback = str(
        data.get("feedback", "")
    ).strip()

    return {
        "score": round(final_score, 2),
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

    for test_case in test_cases:

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
            ollama_result = run_ollama(
                model=evaluation_run.model,
                user_prompt=test_case.input_text,
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