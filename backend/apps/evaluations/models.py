from django.conf import settings
from django.db import models


class EvaluationDataset(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="evaluation_datasets",
    )

    name = models.CharField(max_length=200)

    description = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name


class TestCase(models.Model):
    dataset = models.ForeignKey(
        EvaluationDataset,
        on_delete=models.CASCADE,
        related_name="test_cases",
    )

    name = models.CharField(max_length=200)

    input_text = models.TextField()

    expected_output = models.TextField(
        blank=True,
        default="",
    )

    expected_behavior = models.TextField(
        blank=True,
        default="",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    sort_order = models.PositiveIntegerField(
        default=0,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"{self.dataset.name} — {self.name}"


class EvaluationRun(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="evaluation_runs",
    )

    prompt = models.ForeignKey(
        "prompts.Prompt",
        on_delete=models.CASCADE,
        related_name="evaluation_runs",
    )

    prompt_version = models.ForeignKey(
        "prompts.PromptVersion",
        on_delete=models.CASCADE,
        related_name="evaluation_runs",
    )

    dataset = models.ForeignKey(
        EvaluationDataset,
        on_delete=models.CASCADE,
        related_name="evaluation_runs",
    )

    model = models.CharField(
        max_length=200,
    )

    judge_model = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    total_cases = models.PositiveIntegerField(
        default=0,
    )

    passed_cases = models.PositiveIntegerField(
        default=0,
    )

    failed_cases = models.PositiveIntegerField(
        default=0,
    )

    overall_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

    total_duration = models.BigIntegerField(
        null=True,
        blank=True,
    )

    total_input_tokens = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    total_output_tokens = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    error_message = models.TextField(
        blank=True,
        default="",
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"Evaluation #{self.id} — "
            f"{self.prompt.title} v{self.prompt_version.version_number}"
        )


class EvaluationResult(models.Model):
    class Status(models.TextChoices):
        PASSED = "passed", "Passed"
        FAILED = "failed", "Failed"
        ERROR = "error", "Error"

    evaluation_run = models.ForeignKey(
        EvaluationRun,
        on_delete=models.CASCADE,
        related_name="results",
    )

    test_case = models.ForeignKey(
        TestCase,
        on_delete=models.CASCADE,
        related_name="evaluation_results",
    )

    execution = models.ForeignKey(
        "executions.Execution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evaluation_results",
    )

    judge_model = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
    )

    score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )

    criteria_scores = models.JSONField(
        default=dict,
        blank=True,
    )

    feedback = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["test_case__sort_order", "id"]

    def __str__(self):
        return (
            f"Evaluation #{self.evaluation_run_id} — "
            f"{self.test_case.name}"
        )