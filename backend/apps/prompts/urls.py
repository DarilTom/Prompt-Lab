from django.urls import path

from .views import (
    PromptDetailView,
    PromptImproveView,
    PromptListCreateView,
    PromptVersionListCreateView,
)

urlpatterns = [
    path(
        "",
        PromptListCreateView.as_view(),
        name="prompt-list-create",
    ),
    path(
        "improve/",
        PromptImproveView.as_view(),
        name="prompt-improve",
    ),
    path(
        "<int:pk>/",
        PromptDetailView.as_view(),
        name="prompt-detail",
    ),
    path(
        "<int:prompt_id>/versions/",
        PromptVersionListCreateView.as_view(),
        name="prompt-version-list-create",
    ),
]