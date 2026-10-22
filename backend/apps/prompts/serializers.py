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

    class Meta:
        model = Prompt
        fields = [
            "title",
            "description",
            "category",
            "status",
            "content",
            "system_prompt",
            "variables",
            "change_summary",
        ]

    def create(self, validated_data):
        content = validated_data.pop("content")
        system_prompt = validated_data.pop("system_prompt", "")
        variables = validated_data.pop("variables", {})
        change_summary = validated_data.pop("change_summary", "")

        request = self.context["request"]

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