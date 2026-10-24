from rest_framework import serializers

from .models import Execution


class ExecutionSerializer(serializers.ModelSerializer):
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

    class Meta:
        model = Execution
        fields = [
            "id",
            "prompt",
            "prompt_version",
            "prompt_title",
            "prompt_status",
            "version_number",
            "model",
            "input_text",
            "output_text",
            "status",
            "total_duration",
            "load_duration",
            "prompt_eval_count",
            "eval_count",
            "error_message",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "owner",
            "prompt",
            "prompt_title",
            "prompt_status",
            "version_number",
            "output_text",
            "status",
            "total_duration",
            "load_duration",
            "prompt_eval_count",
            "eval_count",
            "error_message",
            "created_at",
        ]