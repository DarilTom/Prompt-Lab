from rest_framework import serializers

from .models import Prompt, PromptVersion


class PromptVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptVersion
        fields = [
            "id",
            "version_number",
            "content",
            "system_prompt",
            "variables",
            "change_summary",
            "created_by",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "version_number",
            "created_by",
            "created_at",
        ]


class PromptSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.id")
    latest_version = serializers.SerializerMethodField()
    versions = serializers.SerializerMethodField()

    class Meta:
        model = Prompt
        fields = [
            "id",
            "title",
            "description",
            "category",
            "status",
            "owner",
            "latest_version",
            "versions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "latest_version",
            "versions",
            "created_at",
            "updated_at",
        ]

    def get_latest_version(self, obj):
        version = obj.versions.order_by("-version_number").first()

        if not version:
            return None

        return PromptVersionSerializer(version).data

    def get_versions(self, obj):
        versions = obj.versions.order_by("-version_number")
        return PromptVersionSerializer(versions, many=True).data

    def validate_status(self, new_status):
        if not self.instance:
            return new_status

        current_status = self.instance.status
        if current_status == new_status:
            return new_status

        # Prevent promoting un-tested Draft prompts directly to Production
        if current_status == Prompt.Status.DRAFT and new_status == Prompt.Status.PRODUCTION:
            raise serializers.ValidationError(
                "Prompts in Draft status cannot be marked as Production directly. "
                "Execute or evaluate the prompt first to move it to Testing."
            )

        # Prevent jumping directly from Archived to Production
        if current_status == Prompt.Status.ARCHIVED and new_status == Prompt.Status.PRODUCTION:
            raise serializers.ValidationError(
                "Archived prompts cannot be marked as Production directly. "
                "Restore the prompt to Testing first."
            )

        return new_status


class PromptCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(write_only=True)
    system_prompt = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )
    variables = serializers.JSONField(
        write_only=True,
        required=False,
    )
    change_summary = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )
    status = serializers.ChoiceField(
        choices=Prompt.Status.choices,
        default=Prompt.Status.DRAFT,
        required=False,
    )

    class Meta:
        model = Prompt
        fields = [
            "id",
            "title",
            "description",
            "category",
            "status",
            "content",
            "system_prompt",
            "variables",
            "change_summary",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        content = validated_data.pop("content")
        system_prompt = validated_data.pop("system_prompt", "")
        variables = validated_data.pop("variables", {})
        change_summary = validated_data.pop("change_summary", "")

        request = self.context["request"]

        # Ensure status defaults to Draft when not specified or empty
        if not validated_data.get("status"):
            validated_data["status"] = Prompt.Status.DRAFT

        prompt = Prompt.objects.create(
            owner=request.user,
            **validated_data,
        )

        PromptVersion.objects.create(
            prompt=prompt,
            version_number=1,
            content=content,
            system_prompt=system_prompt,
            variables=variables,
            change_summary=change_summary or "Initial version",
            created_by=request.user,
        )

        return prompt