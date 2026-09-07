from django.db import models

# Create your models here.
from django.conf import settings
from django.db import models


class Execution(models.Model):
    STATUS_CHOICES = [
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="executions",
    )

    prompt = models.ForeignKey(
        "prompts.Prompt",
        on_delete=models.CASCADE,
        related_name="executions",
    )

    prompt_version = models.ForeignKey(
        "prompts.PromptVersion",
        on_delete=models.CASCADE,
        related_name="executions",
    )

    model = models.CharField(max_length=200)

    input_text = models.TextField()

    output_text = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="running",
    )

    total_duration = models.BigIntegerField(
        null=True,
        blank=True,
    )

    load_duration = models.BigIntegerField(
        null=True,
        blank=True,
    )

    prompt_eval_count = models.IntegerField(
        null=True,
        blank=True,
    )

    eval_count = models.IntegerField(
        null=True,
        blank=True,
    )

    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.prompt.title} "
            f"v{self.prompt_version.version_number} "
            f"- {self.model}"
        )