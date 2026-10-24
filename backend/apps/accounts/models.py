from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for Prompt Lab.

    The model extends Django's built-in AbstractUser with custom
    email uniqueness and user preferences for Ollama models and UI notifications.
    """

    email = models.EmailField(unique=True)
    default_model = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Preferred Ollama model for executions, improvisations, and evaluations.",
    )
    notify_on_completion = models.BooleanField(
        default=True,
        help_text="Whether to show completion notifications for background tasks.",
    )
    auto_scroll_results = models.BooleanField(
        default=True,
        help_text="Whether to auto-scroll to results when an execution completes.",
    )

    @property
    def display_name(self):
        return self.first_name or self.username

    def __str__(self):
        return self.username
