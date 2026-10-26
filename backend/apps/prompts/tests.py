from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.evaluations.models import EvaluationDataset, TestCase as EvalTestCase
from apps.executions.models import Execution
from .models import Prompt, PromptVersion
from .services import InvalidModelOutputError, generate_improved_prompt

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
    def test_improve_prompt_sends_generation_options(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": '{"improved_prompt": "Clean prompt", "explanation": "Added constraints."}'
            }
        }

        generate_improved_prompt(
            prompt_text="Help write an essay",
            model="llama3.2:1b",
        )

        call_kwargs = mock_run_ollama.call_args.kwargs
        self.assertIn("options", call_kwargs)
        self.assertEqual(
            call_kwargs["options"],
            {"num_predict": 512, "temperature": 0.2},
        )

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
        self.assertEqual(
            mock_run_ollama.call_args.kwargs.get("options"),
            {"num_predict": 512, "temperature": 0.2},
        )

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
        self.assertEqual(
            mock_run_ollama.call_args.kwargs.get("options"),
            {"num_predict": 512, "temperature": 0.2},
        )

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

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_truncated_json_raises_invalid_model_output_error(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": '{"improved_prompt": "This is a cut off truncated response without closing braces'
            }
        }

        with self.assertRaises(InvalidModelOutputError) as ctx:
            generate_improved_prompt(
                prompt_text="Help write an essay",
                model="qwen3:4b",
            )
        self.assertIn("invalid or truncated", str(ctx.exception))

    @patch("apps.prompts.services.run_ollama")
    def test_improve_prompt_non_json_raises_invalid_model_output_error(self, mock_run_ollama):
        mock_run_ollama.return_value = {
            "message": {
                "content": "I am not returning JSON here, just plain text."
            }
        }

        with self.assertRaises(InvalidModelOutputError) as ctx:
            generate_improved_prompt(
                prompt_text="Help write an essay",
                model="gemma3:4b",
            )
        self.assertIn("invalid or truncated", str(ctx.exception))


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

    @patch("apps.prompts.services.run_ollama")
    @patch("apps.executions.services.get_installed_models")
    def test_prompt_improve_handles_truncated_output_gracefully(self, mock_get_models, mock_run_ollama):
        mock_get_models.return_value = [{"name": "qwen3:4b", "model": "qwen3:4b"}]
        mock_run_ollama.return_value = {
            "message": {
                "content": '{"improved_prompt": "Truncated json without closing brace...'
            }
        }
        response = self.client.post(
            self.url,
            {"prompt_text": "Write tests", "model": "qwen3:4b"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("detail", response.data)
        self.assertIn("invalid or incomplete response", response.data["detail"])

    @patch("apps.prompts.views.generate_improved_prompt")
    @patch("apps.executions.services.get_installed_models")
    def test_prompt_improve_generic_value_error_returns_500(self, mock_get_models, mock_generate):
        mock_get_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_generate.side_effect = ValueError("Some internal conversion error")
        response = self.client.post(
            self.url,
            {"prompt_text": "Write tests", "model": "gemma3:4b"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("Unable to improve prompt", response.data["detail"])


class PromptCreationAndStatusTests(TestCase):
    """
    Tests verifying that prompt creation automatically assigns Draft status
    when no status is specified, while preserving status updates and filters.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testauthor",
            email="author@example.com",
            password="AuthorPassword123!",
        )
        self.client.force_authenticate(user=self.user)
        self.list_create_url = reverse("prompt-list-create")

    def test_create_prompt_without_status_defaults_to_draft(self):
        payload = {
            "title": "Automated Draft Test",
            "description": "Testing default status",
            "category": "engineering",
            "content": "You are a helpful assistant.",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "draft")

        prompt = Prompt.objects.get(id=response.data["id"])
        self.assertEqual(prompt.status, Prompt.Status.DRAFT)

    def test_create_prompt_with_explicit_status(self):
        payload = {
            "title": "Explicit Testing Prompt",
            "description": "Testing explicit status assignment",
            "category": "content",
            "status": "testing",
            "content": "Write marketing copy.",
        }
        response = self.client.post(self.list_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "testing")

        prompt = Prompt.objects.get(id=response.data["id"])
        self.assertEqual(prompt.status, Prompt.Status.TESTING)

    def test_filter_prompts_by_status(self):
        Prompt.objects.create(
            owner=self.user,
            title="Draft Prompt",
            status=Prompt.Status.DRAFT,
        )
        Prompt.objects.create(
            owner=self.user,
            title="Production Prompt",
            status=Prompt.Status.PRODUCTION,
        )

        response = self.client.get(f"{self.list_create_url}?status=draft")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(all(p["status"] == "draft" for p in response.data))
        self.assertEqual(len(response.data), 1)

        response_prod = self.client.get(f"{self.list_create_url}?status=production")
        self.assertEqual(response_prod.status_code, status.HTTP_200_OK)
        self.assertTrue(all(p["status"] == "production" for p in response_prod.data))
        self.assertEqual(len(response_prod.data), 1)

    def test_view_or_edit_draft_without_executing_remains_draft(self):
        prompt = Prompt.objects.create(
            owner=self.user,
            title="Initial Title",
            status=Prompt.Status.DRAFT,
        )
        detail_url = reverse("prompt-detail", kwargs={"pk": prompt.id})

        # Viewing leaves it as draft
        view_res = self.client.get(detail_url)
        self.assertEqual(view_res.status_code, status.HTTP_200_OK)
        self.assertEqual(view_res.data["status"], "draft")

        # Editing title / description leaves it as draft
        edit_res = self.client.patch(detail_url, {"title": "Updated Title"}, format="json")
        self.assertEqual(edit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(edit_res.data["status"], "draft")
        prompt.refresh_from_db()
        self.assertEqual(prompt.status, Prompt.Status.DRAFT)

    def test_untested_draft_cannot_be_promoted_directly_to_production(self):
        prompt = Prompt.objects.create(
            owner=self.user,
            title="Draft Prompt",
            status=Prompt.Status.DRAFT,
        )
        detail_url = reverse("prompt-detail", kwargs={"pk": prompt.id})

        # Attempt to mark Draft directly as Production
        res = self.client.patch(detail_url, {"status": "production"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Draft", str(res.data))

    @patch("apps.executions.services.get_installed_models")
    @patch("apps.executions.views.run_ollama")
    def test_execution_transitions_draft_to_testing(self, mock_run_ollama, mock_models):
        mock_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_run_ollama.return_value = {
            "message": {"content": "Execution output"},
            "total_duration": 1000,
        }

        prompt = Prompt.objects.create(
            owner=self.user,
            title="Draft to Test",
            status=Prompt.Status.DRAFT,
        )
        version = PromptVersion.objects.create(
            prompt=prompt,
            version_number=1,
            content="Hello {{name}}",
            created_by=self.user,
        )

        exec_url = reverse("execution-list-create")
        res = self.client.post(
            exec_url,
            {
                "prompt_version": version.id,
                "model": "gemma3:4b",
                "input_text": "Amal",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["prompt_status"], "testing")

        prompt.refresh_from_db()
        self.assertEqual(prompt.status, Prompt.Status.TESTING)

    @patch("apps.executions.services.get_installed_models")
    @patch("apps.executions.views.run_ollama")
    def test_failed_execution_keeps_prompt_in_draft(self, mock_run_ollama, mock_models):
        mock_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_run_ollama.side_effect = Exception("Ollama connection timed out")

        prompt = Prompt.objects.create(
            owner=self.user,
            title="Draft to Fail",
            status=Prompt.Status.DRAFT,
        )
        version = PromptVersion.objects.create(
            prompt=prompt,
            version_number=1,
            content="Hello {{name}}",
            created_by=self.user,
        )

        exec_url = reverse("execution-list-create")
        res = self.client.post(
            exec_url,
            {
                "prompt_version": version.id,
                "model": "gemma3:4b",
                "input_text": "Amal",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)

        prompt.refresh_from_db()
        self.assertEqual(prompt.status, Prompt.Status.DRAFT)

    @patch("apps.executions.services.get_installed_models")
    @patch("apps.evaluations.views.run_evaluation")
    def test_evaluation_run_transitions_draft_to_testing(self, mock_eval, mock_models):
        mock_models.return_value = [{"name": "gemma3:4b", "model": "gemma3:4b"}]
        mock_eval.return_value = False  # no error

        prompt = Prompt.objects.create(
            owner=self.user,
            title="Draft for Evaluation",
            status=Prompt.Status.DRAFT,
        )
        version = PromptVersion.objects.create(
            prompt=prompt,
            version_number=1,
            content="Hello {{name}}",
            created_by=self.user,
        )
        dataset = EvaluationDataset.objects.create(
            owner=self.user,
            name="Test Dataset",
        )
        EvalTestCase.objects.create(
            dataset=dataset,
            name="Case 1",
            input_text="Test input",
        )

        eval_run_url = reverse("evaluation-run-list-create")
        res = self.client.post(
            eval_run_url,
            {
                "prompt_version": version.id,
                "dataset": dataset.id,
                "model": "gemma3:4b",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["prompt_status"], "testing")

        prompt.refresh_from_db()
        self.assertEqual(prompt.status, Prompt.Status.TESTING)

    def test_new_version_of_production_prompt_returns_to_testing(self):
        prompt = Prompt.objects.create(
            owner=self.user,
            title="Production Prompt",
            status=Prompt.Status.PRODUCTION,
        )
        PromptVersion.objects.create(
            prompt=prompt,
            version_number=1,
            content="Version 1",
            created_by=self.user,
        )

        versions_url = reverse("prompt-version-list-create", kwargs={"prompt_id": prompt.id})
        res = self.client.post(
            versions_url,
            {"content": "Version 2 with updates"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        prompt.refresh_from_db()
        self.assertEqual(prompt.status, Prompt.Status.TESTING)

    def test_testing_prompt_can_be_promoted_to_production(self):
        prompt = Prompt.objects.create(
            owner=self.user,
            title="Tested Prompt",
            status=Prompt.Status.TESTING,
        )
        detail_url = reverse("prompt-detail", kwargs={"pk": prompt.id})

        res = self.client.patch(detail_url, {"status": "production"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "production")

        prompt.refresh_from_db()
        self.assertEqual(prompt.status, Prompt.Status.PRODUCTION)

    def test_archiving_and_restoring_prompt(self):
        prompt = Prompt.objects.create(
            owner=self.user,
            title="Tested Prompt",
            status=Prompt.Status.TESTING,
        )
        detail_url = reverse("prompt-detail", kwargs={"pk": prompt.id})

        # Archive
        res_arch = self.client.patch(detail_url, {"status": "archived"}, format="json")
        self.assertEqual(res_arch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_arch.data["status"], "archived")

        # Restore to Testing
        res_rest = self.client.patch(detail_url, {"status": "testing"}, format="json")
        self.assertEqual(res_rest.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rest.data["status"], "testing")

    def test_user_cannot_update_another_users_prompt_status(self):
        other_user = User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            password="OtherPassword123!",
        )
        other_prompt = Prompt.objects.create(
            owner=other_user,
            title="Other Prompt",
            status=Prompt.Status.TESTING,
        )
        detail_url = reverse("prompt-detail", kwargs={"pk": other_prompt.id})

        # Attempt to modify other user's prompt
        res = self.client.patch(detail_url, {"status": "production"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
