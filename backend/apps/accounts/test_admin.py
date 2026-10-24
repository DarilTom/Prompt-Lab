from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.evaluations.models import EvaluationDataset, EvaluationRun
from apps.executions.models import Execution
from apps.prompts.models import Prompt, PromptVersion

User = get_user_model()


class AdminAPITests(APITestCase):
    def setUp(self):
        # Admin user (staff & superuser)
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="AdminPassword123!",
            first_name="Admin",
            is_staff=True,
            is_superuser=True,
        )

        # Staff only admin user
        self.staff_user = User.objects.create_user(
            username="staff_user",
            email="staff@example.com",
            password="StaffPassword123!",
            first_name="Staff",
            is_staff=True,
            is_superuser=False,
        )

        # Regular user
        self.regular_user = User.objects.create_user(
            username="regular_user",
            email="regular@example.com",
            password="RegularPassword123!",
            first_name="Regular",
            is_staff=False,
            is_superuser=False,
        )

        # Inactive user
        self.inactive_user = User.objects.create_user(
            username="inactive_user",
            email="inactive@example.com",
            password="InactivePassword123!",
            first_name="Inactive",
            is_active=False,
        )

        # URLs
        self.stats_url = reverse("admin-stats")
        self.users_url = reverse("admin-users")

    def test_unauthenticated_access_denied(self):
        """Unauthenticated requests must receive 401 Unauthorized."""
        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.get(self.users_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        status_url = reverse("admin-user-status", kwargs={"user_id": self.regular_user.id})
        response = self.client.patch(status_url, {"is_active": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_access_forbidden(self):
        """Regular authenticated users must receive 403 Forbidden."""
        self.client.force_authenticate(user=self.regular_user)

        response = self.client.get(self.stats_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.get(self.users_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        status_url = reverse("admin-user-status", kwargs={"user_id": self.inactive_user.id})
        response = self.client.patch(status_url, {"is_active": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("apps.accounts.admin_views.get_installed_models")
    def test_admin_stats_accuracy(self, mock_get_models):
        """Admin stats endpoint calculates accurate metrics from database and services."""
        mock_get_models.return_value = [
            {"name": "gemma3:4b", "family": "gemma", "parameter_size": "4B", "size_formatted": "3.3 GB"},
            {"name": "llama3.2:1b", "family": "llama", "parameter_size": "1B", "size_formatted": "1.3 GB"},
        ]

        # Create some test prompts, executions, and evaluation runs
        prompt = Prompt.objects.create(
            owner=self.regular_user,
            title="Test Prompt",
            category=Prompt.Category.ENGINEERING,
            status=Prompt.Status.PRODUCTION,
        )
        version = PromptVersion.objects.create(
            prompt=prompt,
            created_by=self.regular_user,
            version_number=1,
            content="Prompt content here",
        )

        Execution.objects.create(
            owner=self.regular_user,
            prompt=prompt,
            prompt_version=version,
            model="gemma3:4b",
            input_text="Sample input",
            output_text="Sample output",
            status="completed",
        )

        dataset = EvaluationDataset.objects.create(
            owner=self.regular_user,
            name="Test Dataset",
        )

        EvaluationRun.objects.create(
            owner=self.regular_user,
            prompt=prompt,
            prompt_version=version,
            dataset=dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.COMPLETED,
        )
        # Incompleted evaluation run should not count towards completed runs
        EvaluationRun.objects.create(
            owner=self.regular_user,
            prompt=prompt,
            prompt_version=version,
            dataset=dataset,
            model="gemma3:4b",
            status=EvaluationRun.Status.RUNNING,
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.stats_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Verify accurate counts
        self.assertEqual(data["users"]["total"], 4)  # admin, staff, regular, inactive
        self.assertEqual(data["users"]["active"], 3)
        self.assertEqual(data["users"]["inactive"], 1)
        self.assertEqual(data["prompts"]["total"], 1)
        self.assertEqual(data["executions"]["total"], 1)
        self.assertEqual(data["evaluations"]["total_completed"], 1)

        # Verify Ollama stats
        self.assertTrue(data["ollama"]["available"])
        self.assertEqual(data["ollama"]["model_count"], 2)
        self.assertIsNone(data["ollama"]["error"])

    @patch("apps.accounts.admin_views.get_installed_models")
    def test_admin_stats_graceful_ollama_failure(self, mock_get_models):
        """Ollama unavailability does not crash stats and returns graceful degraded info."""
        import requests
        mock_get_models.side_effect = requests.exceptions.ConnectionError("Connection refused")

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get(self.stats_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["ollama"]["available"])
        self.assertEqual(response.data["ollama"]["model_count"], 0)
        self.assertIsNotNone(response.data["ollama"]["error"])

    def test_admin_user_list_and_search(self):
        """Admin can list all registered users and search by username/email."""
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(self.users_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 4)
        users = response.data["users"]

        # Verify no sensitive password/token data is exposed
        for u in users:
            self.assertNotIn("password", u)
            self.assertNotIn("token", u)
            self.assertIn("username", u)
            self.assertIn("email", u)
            self.assertIn("is_active", u)
            self.assertIn("is_staff", u)
            self.assertIn("date_joined", u)

        # Test search filter
        search_res = self.client.get(f"{self.users_url}?search=regular")
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertEqual(search_res.data["count"], 1)
        self.assertEqual(search_res.data["users"][0]["email"], "regular@example.com")

    def test_admin_can_deactivate_and_activate_user(self):
        """Admin can deactivate an active user, and activate an inactive user."""
        self.client.force_authenticate(user=self.admin_user)

        # Deactivate regular user
        status_url = reverse("admin-user-status", kwargs={"user_id": self.regular_user.id})
        deactivate_res = self.client.patch(status_url, {"is_active": False}, format="json")
        self.assertEqual(deactivate_res.status_code, status.HTTP_200_OK)
        self.assertFalse(deactivate_res.data["user"]["is_active"])

        self.regular_user.refresh_from_db()
        self.assertFalse(self.regular_user.is_active)

        # Reactivate user
        activate_res = self.client.patch(status_url, {"is_active": True}, format="json")
        self.assertEqual(activate_res.status_code, status.HTTP_200_OK)
        self.assertTrue(activate_res.data["user"]["is_active"])

        self.regular_user.refresh_from_db()
        self.assertTrue(self.regular_user.is_active)

    def test_self_deactivation_is_strictly_blocked(self):
        """An admin cannot deactivate their own account through the interface."""
        self.client.force_authenticate(user=self.admin_user)

        self_url = reverse("admin-user-status", kwargs={"user_id": self.admin_user.id})
        response = self.client.patch(self_url, {"is_active": False}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("own account", response.data["detail"].lower())

        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.is_active)

    def test_me_endpoint_returns_admin_status(self):
        """The /api/auth/me/ endpoint returns is_staff, is_superuser, and is_admin safely."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_staff"])
        self.assertTrue(res.data["is_superuser"])
        self.assertTrue(res.data["is_admin"])

        self.client.force_authenticate(user=self.regular_user)
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["is_staff"])
        self.assertFalse(res.data["is_superuser"])
        self.assertFalse(res.data["is_admin"])

    def test_promote_admin_command(self):
        """Management command promote_admin promotes and demotes users correctly."""
        user = User.objects.create_user(
            username="candidate",
            email="candidate@example.com",
            password="TestPassword123!",
            is_staff=False,
            is_superuser=False,
        )

        call_command("promote_admin", "candidate@example.com")
        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)

        # Demote
        call_command("promote_admin", "candidate@example.com", demote=True)
        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
