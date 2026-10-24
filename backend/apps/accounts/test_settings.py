from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AccountSettingsAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="settings_user",
            email="settings_user@example.com",
            password="OldPassword123!",
            first_name="Jane Doe",
        )
        self.client.force_authenticate(user=self.user)

    def test_get_current_user_profile(self):
        response = self.client.get(reverse("me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["username"], "settings_user")
        self.assertEqual(data["name"], "Jane Doe")
        self.assertEqual(data["display_name"], "Jane Doe")
        self.assertEqual(data["email"], "settings_user@example.com")
        self.assertEqual(data["default_model"], "")
        self.assertTrue(data["notify_on_completion"])
        self.assertTrue(data["auto_scroll_results"])
        self.assertFalse(data["is_staff"])
        self.assertFalse(data["is_superuser"])
        self.assertFalse(data["is_admin"])
        self.assertTrue(data["has_usable_password"])

    def test_patch_profile_and_preferences(self):
        response = self.client.patch(
            reverse("me"),
            {
                "name": "Jane Developer",
                "default_model": "qwen3:4b",
                "notify_on_completion": False,
                "auto_scroll_results": False,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Jane Developer")
        self.assertEqual(self.user.default_model, "qwen3:4b")
        self.assertFalse(self.user.notify_on_completion)
        self.assertFalse(self.user.auto_scroll_results)

    def test_patch_cannot_escalate_privileges(self):
        response = self.client.patch(
            reverse("me"),
            {
                "is_staff": True,
                "is_superuser": True,
                "is_admin": True,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)
        self.assertFalse(self.user.is_superuser)

    def test_change_password_success(self):
        response = self.client.post(
            reverse("change-password"),
            {
                "current_password": "OldPassword123!",
                "new_password": "NewSecretPassword456!",
                "new_password_confirm": "NewSecretPassword456!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewSecretPassword456!"))
        self.assertFalse(self.user.check_password("OldPassword123!"))

    def test_change_password_wrong_current_password(self):
        response = self.client.post(
            reverse("change-password"),
            {
                "current_password": "WrongPassword!",
                "new_password": "NewSecretPassword456!",
                "new_password_confirm": "NewSecretPassword456!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_change_password_mismatch(self):
        response = self.client.post(
            reverse("change-password"),
            {
                "current_password": "OldPassword123!",
                "new_password": "NewSecretPassword456!",
                "new_password_confirm": "MismatchPassword456!",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password_confirm", response.data)

    def test_unauthenticated_cannot_access_profile_or_change_password(self):
        self.client.force_authenticate(user=None)
        me_resp = self.client.get(reverse("me"))
        self.assertEqual(me_resp.status_code, status.HTTP_401_UNAUTHORIZED)

        pw_resp = self.client.post(
            reverse("change-password"),
            {
                "current_password": "OldPassword123!",
                "new_password": "NewSecretPassword456!",
                "new_password_confirm": "NewSecretPassword456!",
            },
        )
        self.assertEqual(pw_resp.status_code, status.HTTP_401_UNAUTHORIZED)
