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
