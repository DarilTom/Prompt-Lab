from rest_framework import serializers

from .models import (
    EvaluationDataset,
    EvaluationResult,
    EvaluationRun,
    TestCase,
)


class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase

        fields = [
            "id",
            "dataset",
            "name",
            "input_text",
            "expected_output",
            "expected_behavior",
            "metadata",
            "sort_order",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "dataset",
            "created_at",
            "updated_at",
        ]


class EvaluationDatasetSerializer(serializers.ModelSerializer):
    test_cases = TestCaseSerializer(
        many=True,
        read_only=True,
    )

    test_case_count = serializers.IntegerField(
        source="test_cases.count",
        read_only=True,
    )

    class Meta:
        model = EvaluationDataset

        fields = [
            "id",
            "name",
            "description",
            "test_case_count",
            "test_cases",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "test_case_count",
            "test_cases",
            "created_at",
            "updated_at",
        ]


class EvaluationResultSerializer(serializers.ModelSerializer):
    test_case_name = serializers.CharField(
        source="test_case.name",
        read_only=True,
    )

    execution_id = serializers.IntegerField(
        source="execution.id",
        read_only=True,
    )

    execution_output = serializers.CharField(
        source="execution.output_text",
        read_only=True,
    )

    execution_duration = serializers.IntegerField(
        source="execution.total_duration",
        read_only=True,
    )

    prompt_eval_count = serializers.IntegerField(
        source="execution.prompt_eval_count",
        read_only=True,
    )

    eval_count = serializers.IntegerField(
        source="execution.eval_count",
        read_only=True,
    )

    execution_model = serializers.CharField(
        source="execution.model",
        read_only=True,
    )

    judge_model = serializers.CharField(
        read_only=True,
    )

    class Meta:
        model = EvaluationResult

        fields = [
            "id",
            "test_case",
            "test_case_name",
            "execution",
            "execution_id",
            "execution_output",
            "execution_duration",
            "prompt_eval_count",
            "eval_count",
            "execution_model",
            "judge_model",
            "status",
            "score",
            "criteria_scores",
            "feedback",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "test_case",
            "test_case_name",
            "execution",
            "execution_id",
            "execution_output",
            "execution_duration",
            "prompt_eval_count",
            "eval_count",
            "execution_model",
            "judge_model",
            "status",
            "score",
            "criteria_scores",
            "feedback",
            "created_at",
        ]


class EvaluationRunSerializer(serializers.ModelSerializer):
    prompt_title = serializers.CharField(
        source="prompt.title",
        read_only=True,
    )

    version_number = serializers.IntegerField(
        source="prompt_version.version_number",
        read_only=True,
    )

    prompt_status = serializers.CharField(
        source="prompt.status",
        read_only=True,
    )

    dataset_name = serializers.CharField(
        source="dataset.name",
        read_only=True,
    )

    results = EvaluationResultSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = EvaluationRun

        fields = [
            "id",
            "prompt",
            "prompt_version",
            "prompt_title",
            "prompt_status",
            "version_number",
            "dataset",
            "dataset_name",
            "model",
            "judge_model",
            "status",
            "total_cases",
            "passed_cases",
            "failed_cases",
            "overall_score",
            "total_duration",
            "total_input_tokens",
            "total_output_tokens",
            "error_message",
            "started_at",
            "completed_at",
            "created_at",
            "results",
        ]

        read_only_fields = [
            "id",
            "prompt",
            "prompt_version",
            "prompt_title",
            "version_number",
            "dataset",
            "dataset_name",
            "model",
            "judge_model",
            "status",
            "total_cases",
            "passed_cases",
            "failed_cases",
            "overall_score",
            "total_duration",
            "total_input_tokens",
            "total_output_tokens",
            "error_message",
            "started_at",
            "completed_at",
            "created_at",
            "results",
        ]


class EvaluationRunCreateSerializer(serializers.Serializer):
    prompt_version = serializers.IntegerField()

    dataset = serializers.IntegerField()

    model = serializers.CharField(
        max_length=200
    )

    judge_model = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
        default="",
    )