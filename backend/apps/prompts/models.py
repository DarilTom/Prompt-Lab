
# Create your models here.
from django.conf import settings
from django.db import models


class Prompt(models.Model):
    class Category(models.TextChoices):
        CONTENT = "content", "Content"
        ECOMMERCE = "ecommerce", "E-commerce"
        ENGINEERING = "engineering", "Engineering"
        LEGAL = "legal", "Legal"
        PRODUCTIVITY = "productivity", "Productivity"
        RESEARCH = "research", "Research"
        SUPPORT = "support", "Support"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        TESTING = "testing", "Testing"
        PRODUCTION = "production", "Production"
        ARCHIVED = "archived", "Archived"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prompts",
    )

    title = models.CharField(max_length=200)

    description = models.TextField(
        blank=True,
        default="",
    )

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.ENGINEERING,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title


class PromptVersion(models.Model):
    prompt = models.ForeignKey(
        Prompt,
        on_delete=models.CASCADE,
        related_name="versions",
    )

    version_number = models.PositiveIntegerField()

    content = models.TextField()

    system_prompt = models.TextField(
        blank=True,
        default="",
    )

    variables = models.JSONField(
        default=dict,
        blank=True,
    )

    change_summary = models.TextField(
        blank=True,
        default="",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="prompt_versions",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version_number"]

        constraints = [
            models.UniqueConstraint(
                fields=["prompt", "version_number"],
                name="unique_prompt_version",
            )
        ]

    def __str__(self):
        return f"{self.prompt.title} v{self.version_number}"