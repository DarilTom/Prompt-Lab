from django.contrib.admin.sites import site
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.test import TestCase, override_settings
from django.urls import reverse

from apps.accounts.admin import UserAdmin, UserChangeForm, UserCreationForm

User = get_user_model()


@override_settings(
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
)
class DjangoAdminUserRegistrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser(
            username="adminuser",
            email="adminuser@example.com",
            password="AdminPassword123!",
            first_name="Admin",
            last_name="Owner",
            default_model="gemma3:4b",
        )
        cls.regular_user = User.objects.create_user(
            username="regularuser",
            email="regularuser@example.com",
            password="RegularPassword123!",
            first_name="Regular",
            last_name="Member",
        )

    def test_user_model_registered_in_admin(self):
        """User model must be registered with the default Django admin site."""
        self.assertIn(User, site._registry)
        admin_instance = site._registry[User]
        self.assertIsInstance(admin_instance, UserAdmin)
        self.assertTrue(issubclass(UserAdmin, BaseUserAdmin))

    def test_admin_form_models(self):
        """Admin forms must explicitly bind to the custom User model."""
        self.assertEqual(UserAdmin.form, UserChangeForm)
        self.assertEqual(UserAdmin.add_form, UserCreationForm)
        self.assertEqual(UserChangeForm._meta.model, User)
        self.assertEqual(UserCreationForm._meta.model, User)

    def test_admin_columns_filters_and_search(self):
        """Admin class must define necessary columns, search fields, and filters."""
        admin_instance = site._registry[User]

        for field in ("username", "email", "first_name", "last_name", "is_staff", "is_active", "date_joined"):
            self.assertIn(field, admin_instance.list_display)

        for search_field in ("username", "email", "first_name", "last_name"):
            self.assertIn(search_field, admin_instance.search_fields)

        for filter_field in ("is_staff", "is_superuser", "is_active", "groups", "date_joined"):
            self.assertIn(filter_field, admin_instance.list_filter)

    def test_prompt_lab_preferences_in_fieldsets(self):
        """Prompt Lab user preference fields must be present in fieldsets."""
        admin_instance = site._registry[User]
        all_change_fields = [
            f for section in admin_instance.fieldsets for f in section[1].get("fields", ())
        ]
        self.assertIn("default_model", all_change_fields)
        self.assertIn("notify_on_completion", all_change_fields)
        self.assertIn("auto_scroll_results", all_change_fields)

        all_add_fields = [
            f for section in admin_instance.add_fieldsets for f in section[1].get("fields", ())
        ]
        self.assertIn("default_model", all_add_fields)
        self.assertIn("notify_on_completion", all_add_fields)
        self.assertIn("auto_scroll_results", all_add_fields)

    def test_safe_password_representation(self):
        """User change form must use ReadOnlyPasswordHashField, never raw plaintext or hash."""
        form = UserChangeForm(instance=self.superuser)
        password_field = form.fields["password"]
        self.assertEqual(
            password_field.__class__.__name__,
            "ReadOnlyPasswordHashField",
        )

    def test_admin_index_displays_users_section_for_staff(self):
        """Admin index (/admin/) must include Users section for authorized staff."""
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Users")
        self.assertContains(response, reverse("admin:accounts_user_changelist"))

    def test_admin_user_views_accessible_to_staff(self):
        """Staff user can access changelist, add view, and change view."""
        self.client.force_login(self.superuser)

        changelist_url = reverse("admin:accounts_user_changelist")
        response = self.client.get(changelist_url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "adminuser@example.com")
        self.assertContains(response, "regularuser@example.com")

        add_url = reverse("admin:accounts_user_add")
        response = self.client.get(add_url)
        self.assertEqual(response.status_code, 200)

        change_url = reverse("admin:accounts_user_change", args=[self.regular_user.id])
        response = self.client.get(change_url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "regularuser@example.com")

    def test_admin_user_views_forbidden_for_regular_users(self):
        """Regular users without staff status cannot access admin user views."""
        self.client.force_login(self.regular_user)
        changelist_url = reverse("admin:accounts_user_changelist")
        response = self.client.get(changelist_url)
        # Django admin redirects non-staff users to login page
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("admin:login"), response.url)

    def test_admin_login_with_email(self):
        """Admin can authenticate into Django admin using email address via EmailBackend."""
        login_success = self.client.login(
            username="adminuser@example.com",
            password="AdminPassword123!",
        )
        self.assertTrue(login_success)
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Users")
