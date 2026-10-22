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
