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
