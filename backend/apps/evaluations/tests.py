from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
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
