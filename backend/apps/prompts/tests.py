from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .services import generate_improved_prompt

User = get_user_model()


class PromptImproverServiceTests(TestCase):
    """
    Focused unit tests for generate_improved_prompt, verifying type safety
    when Ollama returns lists, strings, or unexpected structures.
    """

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_with_list_explanation(self, mock_run_ollama):
        """
        Verify that when the LLM returns an 'explanation' field as a list of strings,
        the service safely formats it into a string without raising:
        'list' object has no attribute 'strip'.
        """
        mock_run_ollama.return_value = {
            "message": {
                "content": """
                {
                    "improved_prompt": "You are an expert copywriter. Write a concise email headline.",
                    "explanation": [
                        "Added clear role framing as an expert copywriter.",
                        "Specified conciseness and output format."
                    ]
                }
                """
            }
        }

        result = generate_improved_prompt(
            prompt_text="Write an email headline",
            context="SaaS product launch",
            tone="Professional",
            output_format="Plain text",
            model="gemma3:4b",
        )

        self.assertIn("improved_prompt", result)
        self.assertIn("explanation", result)
        self.assertEqual(
            result["improved_prompt"],
            "You are an expert copywriter. Write a concise email headline.",
        )
        self.assertIsInstance(result["explanation"], str)
        self.assertIn("Added clear role framing", result["explanation"])
        self.assertIn("Specified conciseness", result["explanation"])

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_with_list_improved_prompt(self, mock_run_ollama):
        """
        Verify that when the LLM returns 'improved_prompt' as a list of paragraphs,
        it is joined cleanly as a string without crashing.
        """
        mock_run_ollama.return_value = {
            "message": {
                "content": """
                {
                    "improved_prompt": [
                        "You are a technical documentation specialist.",
                        "Document the REST API endpoints clearly."
                    ],
                    "explanation": "Added persona and instructions."
                }
                """
            }
        }

        result = generate_improved_prompt(
            prompt_text="Document the API",
        )

        self.assertIsInstance(result["improved_prompt"], str)
        self.assertIn("You are a technical documentation specialist.", result["improved_prompt"])
        self.assertIn("Document the REST API endpoints clearly.", result["improved_prompt"])
        self.assertEqual(result["explanation"], "Added persona and instructions.")

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_with_wrapped_list_json(self, mock_run_ollama):
        """
        Verify that when the LLM returns JSON enclosed in a list [ {...} ],
        it is unwrapped correctly.
        """
        mock_run_ollama.return_value = {
            "message": {
                "content": """
                [
                    {
                        "improved_prompt": "You are a Python tutor. Explain recursion simply.",
                        "explanation": "Added tutor role and simplified explanation."
                    }
                ]
                """
            }
        }

        result = generate_improved_prompt(
            prompt_text="Explain recursion",
        )

        self.assertEqual(
            result["improved_prompt"],
            "You are a Python tutor. Explain recursion simply.",
        )
        self.assertEqual(
            result["explanation"],
            "Added tutor role and simplified explanation.",
        )

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_with_list_input_fields(self, mock_run_ollama):
        """
        Verify that when context or tone are passed as lists of strings,
        they are safely processed without raising .strip() errors.
        """
        mock_run_ollama.return_value = {
            "message": {
                "content": """
                {
                    "improved_prompt": "You are an assistant.",
                    "explanation": "Structured prompt."
                }
                """
            }
        }

        result = generate_improved_prompt(
            prompt_text="Summarize this text",
            context=["Background context 1", "Background context 2"],
            tone=["Friendly", "Empathetic"],
            output_format=["Bullet points"],
        )

        self.assertEqual(result["improved_prompt"], "You are an assistant.")
        # Ensure user_prompt sent to Ollama joined the list elements properly
        call_kwargs = mock_run_ollama.call_args.kwargs
        self.assertIn("Background context 1\nBackground context 2", call_kwargs["user_prompt"])
        self.assertIn("Friendly, Empathetic", call_kwargs["user_prompt"])

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_disables_thinking_for_qwen(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": '{"improved_prompt": "Qwen improved prompt", "explanation": "Clear steps."}'
            }
        }

        result = generate_improved_prompt(
            prompt_text="Help write an essay",
            model="qwen3:4b",
        )

        self.assertEqual(result["improved_prompt"], "Qwen improved prompt")
        self.assertEqual(result["model"], "qwen3:4b")
        self.assertIs(mock_run_ollama.call_args.kwargs.get("think"), False)

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_preserves_default_for_non_qwen(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": '{"improved_prompt": "Gemma prompt", "explanation": "Framed role."}'
            }
        }

        result = generate_improved_prompt(
            prompt_text="Help write an essay",
            model="gemma3:4b",
        )

        self.assertEqual(result["improved_prompt"], "Gemma prompt")
        self.assertEqual(result["model"], "gemma3:4b")
        self.assertNotIn("think", mock_run_ollama.call_args.kwargs)

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_strips_think_tags(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": '<think>deliberating...</think>{"improved_prompt": "Cleaned prompt", "explanation": "Added constraints."}'
            }
        }

        result = generate_improved_prompt(
            prompt_text="Help write an essay",
            model="qwen3:4b",
        )

        self.assertEqual(result["improved_prompt"], "Cleaned prompt")
        self.assertEqual(result["explanation"], "Added constraints.")


class PromptImproveAPITests(TestCase):
    """
    Tests for the POST /api/prompts/improve/ endpoint.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="testpassword123",
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse("prompt-improve")

    @patch("apps.prompts.services.run_ollama")
    def test_prompt_improve_success_with_list_explanation(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": """
                {
                    "improved_prompt": "You are an AI assistant. Help write unit tests.",
                    "explanation": [
                        "Added assistant role.",
                        "Specified test writing task."
                    ]
                }
                """
            }
        }

        payload = {
            "prompt_text": "Write unit tests",
            "context": "Django project",
            "tone": "Professional and precise",
            "output_format": "Clean markdown with structured headings",
            "model": "gemma3:4b",
        }

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("improved_prompt", response.data)
        self.assertIn("explanation", response.data)
        self.assertIsInstance(response.data["explanation"], str)
        self.assertIn("Added assistant role", response.data["explanation"])

    def test_prompt_improve_empty_text_returns_400(self):
        response = self.client.post(self.url, {"prompt_text": ""}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_prompt_improve_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, {"prompt_text": "Write code", "model": "gemma3:4b"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_prompt_improve_missing_model_returns_400(self):
        response = self.client.post(self.url, {"prompt_text": "Write code"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("model is required", response.data["detail"])

    @patch("apps.executions.services.get_installed_models")
    def test_prompt_improve_rejects_nonexistent_model(self, mock_get_models):
        mock_get_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        response = self.client.post(
            self.url,
            {"prompt_text": "Write code", "model": "fake-model-xyz"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not installed in local Ollama", response.data["detail"])

    @patch("apps.prompts.services.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_prompt_improve_with_custom_model(self, mock_get_models, mock_run_ollama):
        mock_get_models.return_value = [{"name": "mistral:7b", "model": "mistral:7b"}]
        mock_run_ollama.return_value = {
            "message": {
                "content": '{"improved_prompt": "Improved prompt text", "explanation": "Refined structure."}'
            }
        }
        response = self.client.post(
            self.url,
            {"prompt_text": "Write tests", "model": "mistral:7b"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["model"], "mistral:7b")
        mock_run_ollama.assert_called_once()
        self.assertEqual(mock_run_ollama.call_args.kwargs["model"], "mistral:7b")
