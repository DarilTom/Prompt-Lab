from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm as BaseUserChangeForm

User = get_user_model()


class UserCreationForm(AdminUserCreationForm):
    """
    Form for creating new users in the Django admin.
    Binds explicitly to the custom accounts.User model.
    """

    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("username", "email")


class UserChangeForm(BaseUserChangeForm):
    """
    Form for updating existing users in the Django admin.
    Binds explicitly to the custom accounts.User model and preserves
    safe password-hash management via ReadOnlyPasswordHashField.
    """

    class Meta(BaseUserChangeForm.Meta):
        model = User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Django admin configuration for Prompt Lab's custom User model.
    """

    form = UserChangeForm
    add_form = UserCreationForm
    model = User

    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_filter = (
        "is_staff",
        "is_superuser",
        "is_active",
        "groups",
        "date_joined",
    )
    search_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
    )
    ordering = ("-date_joined",)

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            "Personal info",
            {"fields": ("first_name", "last_name", "email")},
        ),
        (
            "Prompt Lab Preferences",
            {
                "fields": (
                    "default_model",
                    "notify_on_completion",
                    "auto_scroll_results",
                ),
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Important dates",
            {"fields": ("last_login", "date_joined")},
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "usable_password",
                    "password1",
                    "password2",
                ),
            },
        ),
        (
            "Prompt Lab Preferences",
            {
                "classes": ("wide",),
                "fields": (
                    "default_model",
                    "notify_on_completion",
                    "auto_scroll_results",
                ),
            },
        ),
    )
