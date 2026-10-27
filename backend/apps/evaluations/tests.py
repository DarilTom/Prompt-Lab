import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.executions.models import Execution
from apps.prompts.models import Prompt, PromptVersion
from .models import EvaluationDataset, EvaluationResult, EvaluationRun, TestCase as EvaluationTestCase

User = get_user_model()


class EvaluationRunDetailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="evaluser",
            email="evaluser@example.com",
            password="password123",
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="otheruser@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        # Create prompt & version
        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Customer Support Assistant",
            category="support",
            status="production",
        )
        self.prompt_version = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Answer the user query politely: {input}",
            system_prompt="You are a helpful customer service representative.",
            created_by=self.user,
        )

        # Create dataset & test case
        self.dataset = EvaluationDataset.objects.create(
            owner=self.user,
            name="Support QA Benchmark",
            description="Testing refund and order queries.",
        )
        self.test_case = EvaluationTestCase.objects.create(
            dataset=self.dataset,
            name="Refund Request Query",
            input_text="I want a refund for my order #12345.",
            expected_output="Polite acknowledgment and request for details.",
            expected_behavior="Professional and concise.",
        )

        # Create execution
        self.execution = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            model="gemma3:4b",
            status="completed",
            input_text=self.test_case.input_text,
            output_text="Hello, I would be happy to help process your refund for order #12345.",
            total_duration=1200000000,
            prompt_eval_count=25,
            eval_count=45,
        )

        # Create evaluation run
        self.evaluation_run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status="completed",
            total_cases=1,
            passed_cases=1,
            failed_cases=0,
            overall_score=92.50,
            total_duration=1500000000,
            total_input_tokens=25,
            total_output_tokens=45,
        )

        # Create evaluation result
        self.evaluation_result = EvaluationResult.objects.create(
            evaluation_run=self.evaluation_run,
            test_case=self.test_case,
            execution=self.execution,
            status="passed",
            score=92.50,
            criteria_scores={"relevance": 95.0, "tone": 90.0},
            feedback="Response is polite and directly addresses the order refund request.",
        )

    def test_get_evaluation_run_detail_success(self):
        url = reverse("evaluation-run-detail", kwargs={"pk": self.evaluation_run.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Top-level run fields
        self.assertEqual(data["id"], self.evaluation_run.id)
        self.assertEqual(data["prompt_title"], "Customer Support Assistant")
        self.assertEqual(data["version_number"], 1)
        self.assertEqual(data["dataset_name"], "Support QA Benchmark")
        self.assertEqual(data["model"], "gemma3:4b")
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["total_cases"], 1)
        self.assertEqual(data["passed_cases"], 1)
        self.assertEqual(data["failed_cases"], 0)
        self.assertEqual(float(data["overall_score"]), 92.50)

        # Nested test case results
        self.assertEqual(len(data["results"]), 1)
        first_result = data["results"][0]
        self.assertEqual(first_result["test_case_name"], "Refund Request Query")
        self.assertEqual(first_result["status"], "passed")
        self.assertEqual(float(first_result["score"]), 92.50)
        self.assertIn("Hello, I would be happy to help", first_result["execution_output"])
        self.assertEqual(first_result["criteria_scores"]["relevance"], 95.0)
        self.assertIn("Response is polite", first_result["feedback"])

    def test_get_evaluation_run_detail_unauthorized_user(self):
        # Authenticate as another user
        self.client.force_authenticate(user=self.other_user)
        url = reverse("evaluation-run-detail", kwargs={"pk": self.evaluation_run.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_evaluation_run_detail_not_found(self):
        url = reverse("evaluation-run-detail", kwargs={"pk": 999999})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("apps.executions.services.get_installed_models")
    def test_create_evaluation_run_rejects_nonexistent_model(self, mock_get_models):
        mock_get_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        url = reverse("evaluation-run-list-create")
        payload = {
            "prompt_version": self.prompt_version.id,
            "dataset": self.dataset.id,
            "model": "nonexistent:model",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not installed in local Ollama", response.data["detail"])

    @patch("apps.evaluations.views.start_evaluation_run_background")
    @patch("apps.executions.services.get_installed_models")
    def test_create_evaluation_run_responds_promptly_with_running_status(
        self, mock_get_models, mock_start_bg
    ):
        mock_get_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        url = reverse("evaluation-run-list-create")
        payload = {
            "prompt_version": self.prompt_version.id,
            "dataset": self.dataset.id,
            "model": "gemma3:4b",
        }
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "running")
        self.assertEqual(response.data["total_cases"], 1)
        self.assertEqual(response.data["passed_cases"], 0)
        self.assertEqual(response.data["failed_cases"], 0)

        run_id = response.data["id"]
        mock_start_bg.assert_called_once_with(run_id)

    @patch("apps.evaluations.services.evaluate_response")
    @patch("apps.evaluations.services.run_ollama")
    def test_execute_evaluation_run_completes_run_and_persists_results(
        self, mock_run_ollama, mock_evaluate
    ):
        from .services import execute_evaluation_run

        mock_run_ollama.return_value = {
            "message": {"content": "Sample generated response for test case."},
            "total_duration": 1200000000,
            "prompt_eval_count": 20,
            "eval_count": 30,
        }
        mock_evaluate.return_value = {
            "score": 88.0,
            "criteria_scores": {
                "relevance": 90,
                "expected_output_alignment": 85,
                "expected_behavior": 90,
                "overall_quality": 87,
            },
            "feedback": "Well formatted answer adhering to requirements.",
        }

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.RUNNING,
            total_cases=1,
            passed_cases=0,
            failed_cases=0,
        )

        execute_evaluation_run(run.id)

        run.refresh_from_db()
        self.assertEqual(run.status, EvaluationRun.Status.COMPLETED)
        self.assertIsNotNone(run.completed_at)
        self.assertEqual(run.passed_cases, 1)
        self.assertEqual(run.failed_cases, 0)
        self.assertEqual(float(run.overall_score), 88.0)
        self.assertEqual(run.results.count(), 1)
        result = run.results.first()
        self.assertEqual(result.status, "passed")
        self.assertEqual(float(result.score), 88.0)

    @patch("apps.evaluations.services.run_evaluation")
    def test_execute_evaluation_run_marks_run_failed_on_exception(
        self, mock_run_evaluation
    ):
        from .services import execute_evaluation_run

        mock_run_evaluation.side_effect = RuntimeError("Ollama service timed out unexpectedly")

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.RUNNING,
            total_cases=1,
            passed_cases=0,
            failed_cases=0,
        )

        execute_evaluation_run(run.id)

        run.refresh_from_db()
        self.assertEqual(run.status, EvaluationRun.Status.FAILED)
        self.assertIsNotNone(run.completed_at)
        self.assertEqual(
            run.error_message,
            "Evaluation failed due to an unexpected processing error. Please try again.",
        )
        self.assertNotIn("Ollama service timed out unexpectedly", run.error_message)

    @patch("apps.evaluations.services.run_evaluation")
    def test_execute_evaluation_run_transitions_pending_to_running_before_processing(
        self, mock_run_evaluation
    ):
        from .services import execute_evaluation_run

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.PENDING,
            total_cases=1,
            passed_cases=0,
            failed_cases=0,
        )

        observed_statuses = []

        def side_effect(evaluation_run):
            in_db = EvaluationRun.objects.get(pk=run.id)
            observed_statuses.append(in_db.status)
            return False

        mock_run_evaluation.side_effect = side_effect

        execute_evaluation_run(run.id)

        self.assertEqual(observed_statuses, [EvaluationRun.Status.RUNNING])
        run.refresh_from_db()
        self.assertEqual(run.status, EvaluationRun.Status.COMPLETED)
        self.assertIsNotNone(run.completed_at)

    @patch("apps.evaluations.services.run_evaluation")
    def test_execute_evaluation_run_preserves_terminal_statuses(
        self, mock_run_evaluation
    ):
        from .services import execute_evaluation_run

        # Case 1: Completed run
        completed_run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.COMPLETED,
            total_cases=1,
            passed_cases=1,
            failed_cases=0,
        )

        execute_evaluation_run(completed_run.id)
        mock_run_evaluation.assert_not_called()
        completed_run.refresh_from_db()
        self.assertEqual(completed_run.status, EvaluationRun.Status.COMPLETED)

        # Case 2: Failed run
        failed_run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.FAILED,
            total_cases=1,
            passed_cases=0,
            failed_cases=1,
            error_message="Existing failure",
        )

        execute_evaluation_run(failed_run.id)
        mock_run_evaluation.assert_not_called()
        failed_run.refresh_from_db()
        self.assertEqual(failed_run.status, EvaluationRun.Status.FAILED)
        self.assertEqual(failed_run.error_message, "Existing failure")

    def test_get_evaluation_run_detail_running_state(self):
        running_run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.RUNNING,
            total_cases=3,
            passed_cases=1,
            failed_cases=0,
        )
        url = reverse("evaluation-run-detail", kwargs={"pk": running_run.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "running")
        self.assertEqual(response.data["total_cases"], 3)
        self.assertEqual(response.data["passed_cases"], 1)

    def test_get_evaluation_run_detail_failed_state(self):
        failed_run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.FAILED,
            total_cases=2,
            passed_cases=0,
            failed_cases=2,
            error_message="Evaluation aborted due to connection error.",
        )
        url = reverse("evaluation-run-detail", kwargs={"pk": failed_run.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "failed")
        self.assertEqual(
            response.data["error_message"], "Evaluation aborted due to connection error."
        )


class JudgeScoringServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="judgeuser",
            email="judgeuser@example.com",
            password="password123",
        )
        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Support Bot",
            category="support",
            status="production",
        )
        self.prompt_version = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Answer: {input}",
            system_prompt="Helpful bot",
            created_by=self.user,
        )
        self.dataset = EvaluationDataset.objects.create(
            owner=self.user,
            name="Judge Benchmark",
        )
        self.test_case = EvaluationTestCase.objects.create(
            dataset=self.dataset,
            name="Case 1",
            input_text="What is cloud computing?",
            expected_output="On-demand availability of computer system resources.",
            expected_behavior="Accurate and concise.",
        )

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_valid_scores_and_options(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response, JUDGE_SYSTEM_PROMPT

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 85,
                    "criteria_scores": {
                        "relevance": 90,
                        "expected_output_alignment": 80,
                        "expected_behavior": 85,
                        "overall_quality": 85,
                    },
                    "feedback": "Strong explanation addressing the core prompt.",
                })
            }
        }

        result = evaluate_response(
            model="llama3.2:1b",
            input_text="What is cloud computing?",
            expected_output="On-demand computing resources.",
            expected_behavior="Accurate.",
            actual_output="Cloud computing delivers compute and storage over the internet.",
        )

        mock_run_ollama.assert_called_once()
        _, kwargs = mock_run_ollama.call_args
        self.assertEqual(kwargs["model"], "llama3.2:1b")
        self.assertEqual(kwargs["system_prompt"], JUDGE_SYSTEM_PROMPT)
        self.assertEqual(kwargs["format"], "json")
        self.assertEqual(kwargs["options"], {"temperature": 0.2, "num_predict": 512})

        self.assertEqual(result["score"], 85.0)
        self.assertEqual(
            result["criteria_scores"],
            {
                "relevance": 90.0,
                "expected_output_alignment": 80.0,
                "expected_behavior": 85.0,
                "overall_quality": 85.0,
            },
        )
        self.assertEqual(result["feedback"], "Strong explanation addressing the core prompt.")

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_arithmetic_mean_calculation(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 81,
                    "criteria_scores": {
                        "relevance": 70,
                        "expected_output_alignment": 80,
                        "expected_behavior": 90,
                        "overall_quality": 85,
                    },
                    "feedback": "Decent response.",
                })
            }
        }

        result = evaluate_response(
            model="llama3.2:1b",
            input_text="Test",
            expected_output="Test",
            expected_behavior="Test",
            actual_output="Test",
        )

        # Arithmetic mean: (70 + 80 + 90 + 85) / 4 = 325 / 4 = 81.25
        self.assertEqual(result["score"], 81.25)

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_inconsistent_overall_score_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 50,
                    "criteria_scores": {
                        "relevance": 85,
                        "expected_output_alignment": 85,
                        "expected_behavior": 85,
                        "overall_quality": 85,
                    },
                    "feedback": "Contradictory overall score",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("contradicts", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_missing_overall_score_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "criteria_scores": {
                        "relevance": 80,
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                        "overall_quality": 80,
                    },
                    "feedback": "Missing top-level score",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("missing 'score'", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_non_numeric_overall_score_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        # Non-numeric string
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": "eighty",
                    "criteria_scores": {
                        "relevance": 80,
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                        "overall_quality": 80,
                    },
                    "feedback": "Non-numeric score",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("non-numeric", str(ctx.exception).lower())

        # Boolean score
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": True,
                    "criteria_scores": {
                        "relevance": 80,
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                        "overall_quality": 80,
                    },
                    "feedback": "Boolean score",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("boolean", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_out_of_range_overall_score_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 105,
                    "criteria_scores": {
                        "relevance": 100,
                        "expected_output_alignment": 100,
                        "expected_behavior": 100,
                        "overall_quality": 100,
                    },
                    "feedback": "Out of range score",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("outside 0-100 range", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_integer_rounding_tolerance(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        # Mean is (70 + 80 + 90 + 85) / 4 = 81.25.
        # Score 81 has diff 0.25 <= 0.5 -> Accepted.
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 81,
                    "criteria_scores": {
                        "relevance": 70,
                        "expected_output_alignment": 80,
                        "expected_behavior": 90,
                        "overall_quality": 85,
                    },
                    "feedback": "Valid integer rounded score.",
                })
            }
        }

        result = evaluate_response(
            model="llama3.2:1b",
            input_text="Test",
            expected_output="Test",
            expected_behavior="Test",
            actual_output="Test",
        )
        self.assertEqual(result["score"], 81.25)

        # Score 82 has diff 0.75 > 0.5 -> Rejected.
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 82,
                    "criteria_scores": {
                        "relevance": 70,
                        "expected_output_alignment": 80,
                        "expected_behavior": 90,
                        "overall_quality": 85,
                    },
                    "feedback": "Inconsistent rounded score.",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("contradicts", str(ctx.exception).lower())

        # Correctly rounded overall score for exact mean (e.g. 85.0 with score 85) -> Accepted.
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 85,
                    "criteria_scores": {
                        "relevance": 85,
                        "expected_output_alignment": 85,
                        "expected_behavior": 85,
                        "overall_quality": 85,
                    },
                    "feedback": "Exact rounded score.",
                })
            }
        }

        result_exact = evaluate_response(
            model="llama3.2:1b",
            input_text="Test",
            expected_output="Test",
            expected_behavior="Test",
            actual_output="Test",
        )
        self.assertEqual(result_exact["score"], 85.0)

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_all_zero_scores_with_positive_feedback(
        self, mock_run_ollama
    ):
        """
        Reproduce the observed failure mode: the judge returns all criterion
        scores as zero and a top-level score of zero, despite providing positive
        feedback.

        Numeric consistency checks alone cannot detect this semantic contradiction,
        because 0.0 for all criteria is mathematically consistent with an overall
        score of 0 (mean = 0.0). The system must faithfully record the model's
        evaluated numbers without inventing scores, silently inflating values, or
        introducing brittle keyword-based sentiment detection.
        """
        from apps.evaluations.services import evaluate_response

        positive_feedback = (
            "The response provided a good overview of cloud computing. "
            "The overall quality of the response was good, but it could have been "
            "improved with more attention to detail and relevance to the user's input."
        )

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 0,
                    "criteria_scores": {
                        "relevance": 0,
                        "expected_output_alignment": 0,
                        "expected_behavior": 0,
                        "overall_quality": 0,
                    },
                    "feedback": positive_feedback,
                })
            }
        }

        result = evaluate_response(
            model="llama3.2:1b",
            input_text="What is cloud computing?",
            expected_output="Overview of on-demand computing resources.",
            expected_behavior="Accurate and helpful.",
            actual_output="Cloud computing provides on-demand data storage and computing power.",
        )

        self.assertEqual(result["score"], 0.0)
        self.assertEqual(
            result["criteria_scores"],
            {
                "relevance": 0.0,
                "expected_output_alignment": 0.0,
                "expected_behavior": 0.0,
                "overall_quality": 0.0,
            },
        )
        self.assertEqual(result["feedback"], positive_feedback)

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_missing_criterion_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 80,
                    "criteria_scores": {
                        "relevance": 80,
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                    },
                    "feedback": "Missing overall_quality",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("overall_quality", str(ctx.exception))

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_non_numeric_criterion_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 80,
                    "criteria_scores": {
                        "relevance": "high",
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                        "overall_quality": 80,
                    },
                    "feedback": "Non-numeric relevance",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("non-numeric", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_boolean_criterion_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 80,
                    "criteria_scores": {
                        "relevance": True,
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                        "overall_quality": 80,
                    },
                    "feedback": "Boolean relevance",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("boolean", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_out_of_range_criterion_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "score": 80,
                    "criteria_scores": {
                        "relevance": 105,
                        "expected_output_alignment": 80,
                        "expected_behavior": 80,
                        "overall_quality": 80,
                    },
                    "feedback": "Out of range",
                })
            }
        }

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("outside 0-100 range", str(ctx.exception))

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_invalid_or_empty_json_raises(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        # Empty response
        mock_run_ollama.return_value = {"message": {"content": ""}}
        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("empty response", str(ctx.exception).lower())

        # Malformed non-JSON
        mock_run_ollama.return_value = {"message": {"content": "Not JSON at all"}}
        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="Test",
                expected_output="Test",
                expected_behavior="Test",
                actual_output="Test",
            )
        self.assertIn("valid json", str(ctx.exception).lower())

    @patch("apps.evaluations.services.evaluate_response")
    @patch("apps.evaluations.services.run_ollama")
    def test_run_evaluation_pass_fail_threshold_and_error(
        self, mock_run_ollama, mock_evaluate
    ):
        from apps.evaluations.services import run_evaluation

        mock_run_ollama.return_value = {
            "message": {"content": "Sample output"},
            "total_duration": 1000000,
            "prompt_eval_count": 10,
            "eval_count": 20,
        }

        # Case 1: Score >= 70 marks result as passed
        mock_evaluate.return_value = {
            "score": 70.0,
            "criteria_scores": {
                "relevance": 70.0,
                "expected_output_alignment": 70.0,
                "expected_behavior": 70.0,
                "overall_quality": 70.0,
            },
            "feedback": "Meets threshold",
        }
        run_pass = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )
        run_evaluation(run_pass)
        res_pass = run_pass.results.first()
        self.assertEqual(res_pass.status, "passed")
        self.assertEqual(float(res_pass.score), 70.0)

        # Case 2: Score < 70 marks result as failed
        mock_evaluate.return_value = {
            "score": 69.9,
            "criteria_scores": {
                "relevance": 70.0,
                "expected_output_alignment": 69.0,
                "expected_behavior": 70.0,
                "overall_quality": 70.0,
            },
            "feedback": "Below threshold",
        }
        run_fail = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )
        run_evaluation(run_fail)
        res_fail = run_fail.results.first()
        self.assertEqual(res_fail.status, "failed")
        self.assertEqual(float(res_fail.score), 69.9)

        # Case 3: evaluate_response raises ValueError -> marks result as error
        mock_evaluate.side_effect = ValueError("Evaluator returned invalid JSON")
        run_err = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )
        has_error = run_evaluation(run_err)
        self.assertTrue(has_error)
        res_err = run_err.results.first()
        self.assertEqual(res_err.status, "error")
        self.assertIsNone(res_err.score)
        self.assertEqual(res_err.criteria_scores, {})
        self.assertIn("Evaluator returned invalid JSON", res_err.feedback)

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_math_two_plus_two_correct_answer(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "criteria_scores": {
                        "relevance": 95,
                        "expected_output_alignment": 95,
                        "expected_behavior": 95,
                        "overall_quality": 95,
                    },
                    "score": 95,
                    "feedback": "The response '2 + 2 is 4.' directly and accurately answers the mathematical question.",
                })
            }
        }

        result = evaluate_response(
            model="llama3.2:1b",
            input_text="What is 2 + 2?",
            expected_output="4",
            expected_behavior="Concise and correct.",
            actual_output="2 + 2 is 4.",
        )

        mock_run_ollama.assert_called_once()
        self.assertEqual(result["score"], 95.0)
        self.assertEqual(
            result["criteria_scores"],
            {
                "relevance": 95.0,
                "expected_output_alignment": 95.0,
                "expected_behavior": 95.0,
                "overall_quality": 95.0,
            },
        )
        self.assertGreaterEqual(result["score"], 70)

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_retry_recovers_from_inconsistent_scores(
        self, mock_run_ollama
    ):
        from apps.evaluations.services import evaluate_response

        # Attempt 1: Inconsistent score (40 vs criteria average 0)
        # Attempt 2: Corrected response (score 90 vs criteria average 90)
        mock_run_ollama.side_effect = [
            {
                "message": {
                    "content": json.dumps({
                        "criteria_scores": {
                            "relevance": 0,
                            "expected_output_alignment": 0,
                            "expected_behavior": 0,
                            "overall_quality": 0,
                        },
                        "score": 40,
                        "feedback": "Initial flawed evaluation.",
                    })
                }
            },
            {
                "message": {
                    "content": json.dumps({
                        "criteria_scores": {
                            "relevance": 90,
                            "expected_output_alignment": 90,
                            "expected_behavior": 90,
                            "overall_quality": 90,
                        },
                        "score": 90,
                        "feedback": "Corrected evaluation after prompt feedback.",
                    })
                }
            },
        ]

        result = evaluate_response(
            model="llama3.2:1b",
            input_text="What is 2 + 2?",
            expected_output="4",
            expected_behavior="Accurate.",
            actual_output="2 + 2 is 4.",
        )

        self.assertEqual(mock_run_ollama.call_count, 2)
        second_call_kwargs = mock_run_ollama.call_args_list[1][1]
        self.assertIn("IMPORTANT CORRECTION REQUIRED", second_call_kwargs["user_prompt"])
        self.assertIn("contradicts", second_call_kwargs["user_prompt"])
        self.assertEqual(result["score"], 90.0)
        self.assertEqual(result["criteria_scores"]["relevance"], 90.0)

    @patch("apps.evaluations.services.run_ollama")
    def test_evaluate_response_fails_after_max_retries(self, mock_run_ollama):
        from apps.evaluations.services import evaluate_response

        # Both attempts return inconsistent scores
        inconsistent_response = {
            "message": {
                "content": json.dumps({
                    "criteria_scores": {
                        "relevance": 0,
                        "expected_output_alignment": 0,
                        "expected_behavior": 0,
                        "overall_quality": 0,
                    },
                    "score": 40,
                    "feedback": "Persistent flawed evaluation.",
                })
            }
        }
        mock_run_ollama.side_effect = [inconsistent_response, inconsistent_response]

        with self.assertRaises(ValueError) as ctx:
            evaluate_response(
                model="llama3.2:1b",
                input_text="What is 2 + 2?",
                expected_output="4",
                expected_behavior="Accurate.",
                actual_output="2 + 2 is 4.",
            )

        self.assertEqual(mock_run_ollama.call_count, 2)
        self.assertIn("failed validation after 2 attempts", str(ctx.exception).lower())
        self.assertIn("contradicts", str(ctx.exception).lower())

    @patch("apps.evaluations.services.run_ollama")
    def test_run_evaluation_default_judge_model(self, mock_run_ollama):
        from apps.evaluations.services import run_evaluation, get_judge_model

        self.assertEqual(get_judge_model(), "gemma3:4b")

        mock_run_ollama.side_effect = [
            # Call 1: Generation from model under test (llama3.2:1b)
            {
                "message": {"content": "2 + 2 is 4."},
                "total_duration": 1500000,
                "prompt_eval_count": 12,
                "eval_count": 18,
            },
            # Call 2: Evaluation from judge model (gemma3:4b)
            {
                "message": {
                    "content": json.dumps({
                        "criteria_scores": {
                            "relevance": 95,
                            "expected_output_alignment": 95,
                            "expected_behavior": 95,
                            "overall_quality": 95,
                        },
                        "score": 95,
                        "feedback": "Accurate and concise.",
                    })
                }
            },
        ]

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )

        has_error = run_evaluation(run)
        self.assertFalse(has_error)

        # Verify call arguments
        self.assertEqual(mock_run_ollama.call_count, 2)
        gen_call = mock_run_ollama.call_args_list[0][1]
        judge_call = mock_run_ollama.call_args_list[1][1]

        self.assertEqual(gen_call["model"], "llama3.2:1b")
        self.assertEqual(judge_call["model"], "gemma3:4b")

        # Verify saved models
        run.refresh_from_db()
        self.assertEqual(run.model, "llama3.2:1b")
        self.assertEqual(run.judge_model, "gemma3:4b")

        result = run.results.first()
        self.assertEqual(result.status, "passed")
        self.assertEqual(float(result.score), 95.0)
        self.assertEqual(result.judge_model, "gemma3:4b")
        self.assertEqual(result.execution.model, "llama3.2:1b")

    @override_settings(EVALUATION_JUDGE_MODEL="qwen3:4b")
    @patch("apps.evaluations.services.run_ollama")
    def test_run_evaluation_explicitly_configured_judge_model(self, mock_run_ollama):
        from apps.evaluations.services import run_evaluation, get_judge_model

        self.assertEqual(get_judge_model(), "qwen3:4b")

        mock_run_ollama.side_effect = [
            # Call 1: Generation from model under test (llama3.2:1b)
            {
                "message": {"content": "2 + 2 is 4."},
                "total_duration": 1500000,
                "prompt_eval_count": 12,
                "eval_count": 18,
            },
            # Call 2: Evaluation from custom judge model (qwen3:4b)
            {
                "message": {
                    "content": json.dumps({
                        "criteria_scores": {
                            "relevance": 90,
                            "expected_output_alignment": 90,
                            "expected_behavior": 90,
                            "overall_quality": 90,
                        },
                        "score": 90,
                        "feedback": "Good response.",
                    })
                }
            },
        ]

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )

        has_error = run_evaluation(run)
        self.assertFalse(has_error)

        self.assertEqual(mock_run_ollama.call_count, 2)
        gen_call = mock_run_ollama.call_args_list[0][1]
        judge_call = mock_run_ollama.call_args_list[1][1]

        self.assertEqual(gen_call["model"], "llama3.2:1b")
        self.assertEqual(judge_call["model"], "qwen3:4b")

        run.refresh_from_db()
        self.assertEqual(run.model, "llama3.2:1b")
        self.assertEqual(run.judge_model, "qwen3:4b")

        result = run.results.first()
        self.assertEqual(result.judge_model, "qwen3:4b")
        self.assertEqual(result.execution.model, "llama3.2:1b")

    @patch("apps.evaluations.services.run_ollama")
    def test_run_evaluation_persistent_invalid_judge_output_does_not_fallback(self, mock_run_ollama):
        from apps.evaluations.services import run_evaluation

        invalid_judge_response = {
            "message": {
                "content": json.dumps({
                    "criteria_scores": {
                        "relevance": 0,
                        "expected_output_alignment": 0,
                        "expected_behavior": 0,
                        "overall_quality": 0,
                    },
                    "score": 40,
                    "feedback": "Contradictory scores.",
                })
            }
        }

        mock_run_ollama.side_effect = [
            # Call 1: Generation from model under test (llama3.2:1b)
            {
                "message": {"content": "2 + 2 is 4."},
                "total_duration": 1500000,
                "prompt_eval_count": 12,
                "eval_count": 18,
            },
            # Call 2: Judge attempt 1 (gemma3:4b) - fails validation
            invalid_judge_response,
            # Call 3: Judge attempt 2 (gemma3:4b) - retry fails validation
            invalid_judge_response,
        ]

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )

        has_error = run_evaluation(run)
        self.assertTrue(has_error)

        # Call count is 1 generation + 2 judge retries = 3 total.
        # No fallback call to llama3.2:1b as judge was made.
        self.assertEqual(mock_run_ollama.call_count, 3)
        self.assertEqual(mock_run_ollama.call_args_list[0][1]["model"], "llama3.2:1b")
        self.assertEqual(mock_run_ollama.call_args_list[1][1]["model"], "gemma3:4b")
        self.assertEqual(mock_run_ollama.call_args_list[2][1]["model"], "gemma3:4b")

        result = run.results.first()
        self.assertEqual(result.status, "error")
        self.assertIsNone(result.score)
        self.assertEqual(result.criteria_scores, {})
        self.assertIn("failed validation after 2 attempts", result.feedback)
        self.assertEqual(result.judge_model, "gemma3:4b")
        self.assertEqual(result.execution.model, "llama3.2:1b")

    @patch("apps.evaluations.services.run_ollama")
    def test_run_evaluation_judge_service_failure_does_not_fallback(self, mock_run_ollama):
        from apps.evaluations.services import run_evaluation

        mock_run_ollama.side_effect = [
            # Call 1: Generation succeeds from model under test (llama3.2:1b)
            {
                "message": {"content": "2 + 2 is 4."},
                "total_duration": 1500000,
                "prompt_eval_count": 12,
                "eval_count": 18,
            },
            # Call 2: Judge service throws a runtime connection/service failure
            RuntimeError("Ollama service unavailable: 503 Service Unavailable"),
        ]

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            status=EvaluationRun.Status.RUNNING,
        )

        has_error = run_evaluation(run)
        self.assertTrue(has_error)

        # Call count is 2 (1 generation + 1 judge attempt that raised RuntimeError).
        # No silent fallback was attempted.
        self.assertEqual(mock_run_ollama.call_count, 2)
        self.assertEqual(mock_run_ollama.call_args_list[0][1]["model"], "llama3.2:1b")
        self.assertEqual(mock_run_ollama.call_args_list[1][1]["model"], "gemma3:4b")

        result = run.results.first()
        self.assertEqual(result.status, "error")
        self.assertIsNone(result.score)
        self.assertEqual(result.criteria_scores, {})
        self.assertIn("503 Service Unavailable", result.feedback)
        self.assertEqual(result.judge_model, "gemma3:4b")
        self.assertEqual(result.execution.model, "llama3.2:1b")

    def test_evaluation_serializers_include_judge_model(self):
        from apps.evaluations.serializers import EvaluationRunSerializer, EvaluationResultSerializer

        execution = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            model="llama3.2:1b",
            input_text=self.test_case.input_text,
            output_text="2 + 2 is 4.",
            status="completed",
        )

        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.prompt_version,
            dataset=self.dataset,
            model="llama3.2:1b",
            judge_model="gemma3:4b",
            status=EvaluationRun.Status.COMPLETED,
        )
        res = EvaluationResult.objects.create(
            evaluation_run=run,
            test_case=self.test_case,
            execution=execution,
            judge_model="gemma3:4b",
            status="passed",
            score=88.5,
            criteria_scores={"relevance": 90, "expected_output_alignment": 88, "expected_behavior": 88, "overall_quality": 88},
            feedback="Well done",
        )

        run_data = EvaluationRunSerializer(run).data
        self.assertEqual(run_data["model"], "llama3.2:1b")
        self.assertEqual(run_data["judge_model"], "gemma3:4b")

        res_data = EvaluationResultSerializer(res).data
        self.assertEqual(res_data["execution_model"], execution.model)
        self.assertEqual(res_data["judge_model"], "gemma3:4b")
