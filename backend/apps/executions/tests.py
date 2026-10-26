import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.prompts.models import Prompt, PromptVersion
from .models import Execution
from .services import compose_prompt

User = get_user_model()


class ComposePromptTests(TestCase):
    def test_placeholder_replacement(self):
        self.assertEqual(
            compose_prompt("Translate to French: {input}", "Good morning"),
            "Translate to French: Good morning",
        )
        self.assertEqual(
            compose_prompt("Summarize: {{input}}", "Long article"),
            "Summarize: Long article",
        )
        self.assertEqual(
            compose_prompt("Classify: [input]", "Sample text"),
            "Classify: Sample text",
        )
        self.assertEqual(
            compose_prompt("Classify: [Input Text]", "Sample text"),
            "Classify: Sample text",
        )

    def test_default_append(self):
        self.assertEqual(
            compose_prompt("Summarize the text below:", "My test input"),
            "Summarize the text below:\n\nMy test input",
        )

    def test_empty_handling(self):
        self.assertEqual(compose_prompt("", "Raw input"), "Raw input")
        self.assertEqual(compose_prompt("Prompt content", ""), "Prompt content")
        self.assertEqual(compose_prompt(None, "Raw input"), "Raw input")


class RunOllamaServiceTests(TestCase):
    @patch("apps.executions.services.requests.post")
    def test_run_ollama_passes_think_parameter(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": {"content": "ok"}}
        from .services import run_ollama

        run_ollama("qwen3:4b", "test prompt", think=False)
        self.assertIn("think", mock_post.call_args.kwargs["json"])
        self.assertIs(mock_post.call_args.kwargs["json"]["think"], False)

    @patch("apps.executions.services.requests.post")
    def test_run_ollama_omits_think_parameter_by_default(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": {"content": "ok"}}
        from .services import run_ollama

        run_ollama("gemma3:4b", "test prompt")
        self.assertNotIn("think", mock_post.call_args.kwargs["json"])

    @patch("apps.executions.services.requests.post")
    def test_run_ollama_passes_options_parameter_when_provided(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": {"content": "ok"}}
        from .services import run_ollama

        run_ollama(
            "qwen3:4b",
            "test prompt",
            options={"num_predict": 512, "temperature": 0.2},
        )
        self.assertIn("options", mock_post.call_args.kwargs["json"])
        self.assertEqual(
            mock_post.call_args.kwargs["json"]["options"],
            {"num_predict": 512, "temperature": 0.2},
        )

    @patch("apps.executions.services.requests.post")
    def test_run_ollama_omits_options_parameter_by_default(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": {"content": "ok"}}
        from .services import run_ollama

        run_ollama("gemma3:4b", "test prompt")
        self.assertNotIn("options", mock_post.call_args.kwargs["json"])


class ExecutionVersionSelectionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="execuser",
            email="execuser@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Customer Response Prompt",
            category="support",
            status="production",
        )

        self.version_1 = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Version 1: Respond formally to the customer: {input}",
            system_prompt="You are a formal support agent.",
            created_by=self.user,
        )

        self.version_2 = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=2,
            content="Version 2: Respond casually to the customer: {input}",
            system_prompt="You are a friendly casual assistant.",
            created_by=self.user,
        )

        self.url = reverse("execution-list-create")

    @patch("apps.executions.views.run_ollama")
    def test_execute_historical_version_1(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {"content": "Dear customer, we have resolved your issue."},
            "total_duration": 150000000,
            "prompt_eval_count": 20,
            "eval_count": 30,
        }

        # Explicitly request historical version 1 even though version 2 is latest
        payload = {
            "prompt_version": self.version_1.id,
            "model": "gemma3:4b",
            "input_text": "My package was delayed.",
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["version_number"], 1)
        self.assertEqual(response.data["prompt_version"], self.version_1.id)

        # Verify Execution database record references version 1
        execution = Execution.objects.get(id=response.data["id"])
        self.assertEqual(execution.prompt_version.id, self.version_1.id)
        self.assertEqual(execution.prompt_version.version_number, 1)

        # Verify Ollama received version 1's actual content and system prompt
        mock_run_ollama.assert_called_once_with(
            model="gemma3:4b",
            user_prompt="Version 1: Respond formally to the customer: My package was delayed.",
            system_prompt="You are a formal support agent.",
        )

    @patch("apps.executions.views.run_ollama")
    def test_execute_latest_version_2(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {"content": "Hey there! Your package is on the way!"},
            "total_duration": 120000000,
            "prompt_eval_count": 18,
            "eval_count": 25,
        }

        payload = {
            "prompt_version": self.version_2.id,
            "model": "gemma3:4b",
            "input_text": "My package was delayed.",
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["version_number"], 2)
        self.assertEqual(response.data["prompt_version"], self.version_2.id)

        execution = Execution.objects.get(id=response.data["id"])
        self.assertEqual(execution.prompt_version.id, self.version_2.id)
        self.assertEqual(execution.prompt_version.version_number, 2)

        mock_run_ollama.assert_called_once_with(
            model="gemma3:4b",
            user_prompt="Version 2: Respond casually to the customer: My package was delayed.",
            system_prompt="You are a friendly casual assistant.",
        )


class OllamaModelListViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="modeluser",
            email="modeluser@example.com",
            password="password123",
        )
        self.url = reverse("ollama-model-list")

    def test_get_models_unauthenticated_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("apps.executions.services.requests.get")
    def test_get_models_success(self, mock_get):
        self.client.force_authenticate(user=self.user)
        mock_response = mock_get.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {
                    "name": "gemma3:4b",
                    "model": "gemma3:4b",
                    "modified_at": "2026-09-05T16:40:55.044Z",
                    "size": 3338801804,
                    "digest": "a2af6cc3eb7f",
                    "details": {
                        "family": "gemma3",
                        "parameter_size": "4.3B",
                        "quantization_level": "Q4_K_M",
                    },
                },
                {
                    "name": "llama3:8b",
                    "model": "llama3:8b",
                    "modified_at": "2026-09-06T10:00:00.000Z",
                    "size": 4700000000,
                    "digest": "b3bf7dd4fc8e",
                    "details": {
                        "family": "llama",
                        "parameter_size": "8B",
                        "quantization_level": "Q4_0",
                    },
                },
            ]
        }

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("models", response.data)
        models = response.data["models"]
        self.assertEqual(len(models), 2)
        self.assertEqual(models[0]["name"], "gemma3:4b")
        self.assertEqual(models[0]["family"], "gemma3")
        self.assertEqual(models[0]["parameter_size"], "4.3B")
        self.assertEqual(models[0]["size_formatted"], "3.3 GB")
        self.assertEqual(models[1]["name"], "llama3:8b")
        self.assertEqual(models[1]["parameter_size"], "8B")
        self.assertEqual(models[1]["size_formatted"], "4.7 GB")

    @patch("apps.executions.services.requests.get")
    def test_get_models_empty_list(self, mock_get):
        self.client.force_authenticate(user=self.user)
        mock_response = mock_get.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {"models": []}

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["models"], [])

    @patch("apps.executions.services.requests.get")
    def test_get_models_connection_error_returns_503(self, mock_get):
        import requests
        self.client.force_authenticate(user=self.user)
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection refused")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("detail", response.data)
        self.assertEqual(response.data["error"], "connection_error")
        self.assertEqual(response.data["models"], [])

    @patch("apps.executions.services.requests.get")
    def test_get_models_timeout_returns_504(self, mock_get):
        import requests
        self.client.force_authenticate(user=self.user)
        mock_get.side_effect = requests.exceptions.Timeout("Request timed out")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("detail", response.data)
        self.assertEqual(response.data["error"], "timeout")

    @patch("apps.executions.services.requests.get")
    def test_get_models_request_exception_returns_502(self, mock_get):
        import requests
        self.client.force_authenticate(user=self.user)
        mock_get.side_effect = requests.exceptions.HTTPError("500 Server Error")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("detail", response.data)


class ModelExecutionValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="valuser",
            email="valuser@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Validation Prompt",
            category="productivity",
            status="draft",
        )
        self.version = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Do something: {input}",
            created_by=self.user,
        )
        self.url = reverse("execution-list-create")

    @patch("apps.executions.services.get_installed_models")
    def test_reject_arbitrary_nonexistent_model(self, mock_get_installed_models):
        mock_get_installed_models.return_value = [
            {"name": "gemma3:4b", "model": "gemma3:4b"}
        ]

        payload = {
            "prompt_version": self.version.id,
            "model": "gpt-5-turbo",
            "input_text": "Test input",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not installed in local Ollama", response.data["detail"])

    @patch("apps.executions.views.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_allow_and_track_installed_custom_model(
        self, mock_get_installed_models, mock_run_ollama
    ):
        mock_get_installed_models.return_value = [
            {"name": "llama3:8b", "model": "llama3:8b"}
        ]
        mock_run_ollama.return_value = {
            "message": {"content": "Output from llama3"},
            "total_duration": 100000000,
            "prompt_eval_count": 10,
            "eval_count": 15,
        }

        payload = {
            "prompt_version": self.version.id,
            "model": "llama3:8b",
            "input_text": "Testing custom model",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["model"], "llama3:8b")

        execution = Execution.objects.get(id=response.data["id"])
        self.assertEqual(execution.model, "llama3:8b")
        mock_run_ollama.assert_called_once_with(
            model="llama3:8b",
            user_prompt="Do something: Testing custom model",
            system_prompt="",
)


class QwenExecutionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="qwenuser",
            email="qwenuser@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Qwen Tutor",
            category="engineering",
            status="draft",
        )

        self.version = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Teach me: {input}",
            system_prompt="Be a friendly tutor.",
            created_by=self.user,
        )

        self.url = reverse("execution-list-create")

    @patch("apps.executions.views.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_qwen_execution_passes_think_false(
        self, mock_get_installed_models, mock_run_ollama
    ):
        mock_get_installed_models.return_value = [
            {"name": "qwen3:4b", "model": "qwen3:4b"}
        ]
        mock_run_ollama.return_value = {
            "message": {"content": "Here is the tutor explanation."},
            "total_duration": 100000000,
            "prompt_eval_count": 15,
            "eval_count": 25,
        }

        payload = {
            "prompt_version": self.version.id,
            "model": "qwen3:4b",
            "input_text": "Python recursion",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["model"], "qwen3:4b")

        execution = Execution.objects.get(id=response.data["id"])
        self.assertEqual(execution.model, "qwen3:4b")
        self.assertEqual(execution.status, "completed")

        mock_run_ollama.assert_called_once_with(
            model="qwen3:4b",
            user_prompt="Teach me: Python recursion",
            system_prompt="Be a friendly tutor.",
            think=False,
        )

    @patch("apps.executions.views.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_qwen_execution_cleans_think_reasoning_tags(
        self, mock_get_installed_models, mock_run_ollama
    ):
        mock_get_installed_models.return_value = [
            {"name": "qwen3:4b", "model": "qwen3:4b"}
        ]
        mock_run_ollama.return_value = {
            "message": {
                "content": "Let me think about recursion.\n</think>\n\nRecursion is a function calling itself."
            },
            "total_duration": 100000000,
            "prompt_eval_count": 15,
            "eval_count": 25,
        }

        payload = {
            "prompt_version": self.version.id,
            "model": "qwen3:4b",
            "input_text": "Python recursion",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.data["output_text"],
            "Recursion is a function calling itself.",
        )

        execution = Execution.objects.get(id=response.data["id"])
        self.assertEqual(
            execution.output_text,
            "Recursion is a function calling itself.",
        )

    @patch("apps.executions.views.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_qwen_execution_timeout_returns_504_and_records_failure(
        self, mock_get_installed_models, mock_run_ollama
    ):
        import requests
        mock_get_installed_models.return_value = [
            {"name": "qwen3:4b", "model": "qwen3:4b"}
        ]
        mock_run_ollama.side_effect = requests.exceptions.Timeout("Read timed out")

        payload = {
            "prompt_version": self.version.id,
            "model": "qwen3:4b",
            "input_text": "Python recursion",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("Ollama took too long to respond", response.data["detail"])

        execution = Execution.objects.get(id=response.data["execution_id"])
        self.assertEqual(execution.status, "failed")
        self.assertIn("Ollama took too long to respond", execution.error_message)

    @patch("apps.executions.views.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_llama_and_gemma_executions_do_not_pass_think(
        self, mock_get_installed_models, mock_run_ollama
    ):
        mock_get_installed_models.return_value = [
            {"name": "gemma3:4b", "model": "gemma3:4b"},
            {"name": "llama3.2:1b", "model": "llama3.2:1b"},
        ]
        mock_run_ollama.return_value = {
            "message": {"content": "Standard output."},
            "total_duration": 50000000,
        }

        for test_model in ["gemma3:4b", "llama3.2:1b"]:
            mock_run_ollama.reset_mock()
            payload = {
                "prompt_version": self.version.id,
                "model": test_model,
                "input_text": "Test input",
            }

            response = self.client.post(self.url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            mock_run_ollama.assert_called_once_with(
                model=test_model,
                user_prompt="Teach me: Test input",
                system_prompt="Be a friendly tutor.",
            )


class ExecutionDeletionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="owneruser",
            email="owneruser@example.com",
            password="password123",
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            email="otheruser@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Customer Support",
            category="support",
            status="testing",
        )

        self.version = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Support: {input}",
            created_by=self.user,
        )

        self.execution = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.version,
            model="gemma3:4b",
            input_text="My order has not arrived.",
            output_text="We apologize for the delay. Your tracking is 123.",
            status="completed",
        )

        self.url = reverse("execution-detail", kwargs={"pk": self.execution.id})

    def test_owner_can_delete_execution(self):
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Execution is deleted from DB
        self.assertFalse(Execution.objects.filter(id=self.execution.id).exists())

        # Prompt and PromptVersion are preserved
        self.assertTrue(Prompt.objects.filter(id=self.prompt.id).exists())
        self.assertTrue(PromptVersion.objects.filter(id=self.version.id).exists())

    def test_other_user_cannot_delete_execution(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("You do not have permission", response.data["detail"])

        # Execution remains intact
        self.assertTrue(Execution.objects.filter(id=self.execution.id).exists())

    def test_unauthenticated_cannot_delete_execution(self):
        self.client.logout()
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Execution.objects.filter(id=self.execution.id).exists())

    def test_delete_execution_linked_to_evaluation_is_prevented(self):
        from apps.evaluations.models import (
            EvaluationDataset,
            TestCase as EvalTestCase,
            EvaluationRun,
            EvaluationResult,
        )

        dataset = EvaluationDataset.objects.create(
            owner=self.user,
            name="Support Dataset",
        )
        test_case = EvalTestCase.objects.create(
            dataset=dataset,
            name="Shipping delay",
            input_text="Where is my order?",
        )
        run = EvaluationRun.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.version,
            dataset=dataset,
            model="gemma3:4b",
            status="completed",
        )
        EvaluationResult.objects.create(
            evaluation_run=run,
            test_case=test_case,
            execution=self.execution,
            status="completed",
            score=85.0,
        )

        # Attempt to delete execution linked to evaluation result
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("referenced by evaluation run results", response.data["detail"])

        # Record remains completely intact
        self.assertTrue(Execution.objects.filter(id=self.execution.id).exists())

    def test_delete_nonexistent_execution_returns_404(self):
        url = reverse("execution-detail", kwargs={"pk": 999999})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ExecutionCompareRecommendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testcomparator",
            email="compare@example.com",
            password="password123",
        )
        self.other_user = User.objects.create_user(
            username="othercomparator",
            email="othercompare@example.com",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)

        self.prompt = Prompt.objects.create(
            owner=self.user,
            title="Customer Support Assistant",
            category="support",
            status="testing",
        )

        self.version_1 = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=1,
            content="Help the customer concisely: {input}",
            system_prompt="Be a polite and concise support agent.",
            created_by=self.user,
        )

        self.version_2 = PromptVersion.objects.create(
            prompt=self.prompt,
            version_number=2,
            content="Help the customer step-by-step: {input}",
            system_prompt="Be a structured and detailed support agent.",
            created_by=self.user,
        )

        self.exec_a = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.version_1,
            model="gemma3:4b",
            input_text="My order has not arrived.",
            output_text="Please check your tracking link sent via email. If it has been more than 5 days, contact shipping support.",
            status="completed",
        )

        self.exec_b = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.version_2,
            model="gemma3:4b",
            input_text="My order has not arrived.",
            output_text="Here are the steps to track your order:\n1. Open your confirmation email.\n2. Click the tracking link.\n3. Check delivery carrier status.",
            status="completed",
        )

        self.url = reverse("execution-compare-recommend")

    def test_unauthenticated_cannot_compare(self):
        self.client.logout()
        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": self.exec_b.id,
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_execution_ids_returns_400(self):
        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Both execution_a_id and execution_b_id are required", response.data["detail"])

    def test_same_execution_id_returns_400(self):
        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": self.exec_a.id,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot compare an execution with itself", response.data["detail"])

    def test_unowned_execution_returns_404(self):
        other_exec = Execution.objects.create(
            owner=self.other_user,
            prompt=self.prompt,
            prompt_version=self.version_1,
            model="gemma3:4b",
            input_text="Hello",
            output_text="Hi there",
            status="completed",
        )
        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": other_exec.id,
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_failed_or_empty_execution_returns_400(self):
        failed_exec = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.version_1,
            model="gemma3:4b",
            input_text="Hello",
            output_text="",
            status="failed",
        )
        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": failed_exec.id,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("usable output", response.data["detail"])

    @patch("apps.executions.services.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_compare_recommend_winner_b_success(self, mock_models, mock_run_ollama):
        mock_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "recommendation": "execution_b",
                    "winner_label": "Experiment B (v2)",
                    "reasoning": "Experiment B provided actionable step-by-step guidance following the structured prompt instructions.",
                    "strengths_weaknesses": {
                        "execution_a": {
                            "strengths": ["Concise", "Polite"],
                            "weaknesses": ["Lacks step-by-step detail"]
                        },
                        "execution_b": {
                            "strengths": ["Structured steps", "Clear tracking advice"],
                            "weaknesses": ["Slightly longer"]
                        }
                    },
                    "criteria_comparison": {
                        "relevance": "Both address the shipping query directly.",
                        "instruction_adherence": "Experiment B adhered more closely to step-by-step requirements."
                    }
                })
            }
        }

        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": self.exec_b.id,
            "judge_model": "gemma3:4b",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["recommendation"], "execution_b")
        self.assertEqual(response.data["recommended_execution_id"], self.exec_b.id)
        self.assertEqual(response.data["recommended_version_number"], 2)
        self.assertIn("Experiment B", response.data["winner_label"])
        self.assertTrue(response.data["fairness"]["same_input"])
        self.assertTrue(response.data["fairness"]["same_model"])

    @patch("apps.executions.services.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_compare_recommend_too_close_to_call(self, mock_models, mock_run_ollama):
        mock_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "recommendation": "too_close_to_call",
                    "winner_label": "Too close to call",
                    "reasoning": "Both prompt executions perform with equal clarity and relevance with minor style differences.",
                    "strengths_weaknesses": {
                        "execution_a": {"strengths": ["Direct"], "weaknesses": []},
                        "execution_b": {"strengths": ["Structured"], "weaknesses": []}
                    }
                })
            }
        }

        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": self.exec_b.id,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["recommendation"], "too_close_to_call")
        self.assertIsNone(response.data["recommended_execution_id"])
        self.assertEqual(response.data["winner_label"], "Too close to call")

    @patch("apps.executions.services.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_fairness_disclosures_for_different_inputs_and_models(self, mock_models, mock_run_ollama):
        mock_models.return_value = [
            {"name": "gemma3:4b", "model": "gemma3:4b"},
            {"name": "qwen3:4b", "model": "qwen3:4b"}
        ]
        mock_run_ollama.return_value = {
            "message": {
                "content": json.dumps({
                    "recommendation": "execution_a",
                    "reasoning": "Execution A is more concise."
                })
            }
        }

        different_exec = Execution.objects.create(
            owner=self.user,
            prompt=self.prompt,
            prompt_version=self.version_2,
            model="qwen3:4b",
            input_text="Can I return an opened item?",
            output_text="Yes, within 30 days.",
            status="completed",
        )

        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": different_exec.id,
            "judge_model": "gemma3:4b",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["fairness"]["same_input"])
        self.assertFalse(response.data["fairness"]["same_model"])
        disclosures_text = " ".join(response.data["fairness"]["disclosures"])
        self.assertIn("different inputs", disclosures_text)
        self.assertIn("different models", disclosures_text)

    @patch("apps.executions.services.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_ollama_timeout_returns_504(self, mock_models, mock_run_ollama):
        import requests
        mock_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_run_ollama.side_effect = requests.exceptions.Timeout("Read timed out")

        response = self.client.post(self.url, {
            "execution_a_id": self.exec_a.id,
            "execution_b_id": self.exec_b.id,
        })
        self.assertEqual(response.status_code, status.HTTP_504_GATEWAY_TIMEOUT)
        self.assertIn("timed out", response.data["detail"])
