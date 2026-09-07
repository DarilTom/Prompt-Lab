from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Prompt, PromptVersion


@admin.register(Prompt)
class PromptAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "owner",
        "category",
        "status",
        "created_at",
        "updated_at",
    )

    list_filter = (
        "category",
        "status",
    )

    search_fields = (
        "title",
        "description",
        "owner__email",
    )


@admin.register(PromptVersion)
class PromptVersionAdmin(admin.ModelAdmin):
    list_display = (
        "prompt",
        "version_number",
        "created_by",
        "created_at",
    )

    list_filter = (
        "created_at",
    )

    search_fields = (
        "prompt__title",
        "content",
    )