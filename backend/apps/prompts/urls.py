from django.urls import path

from .views import (
    PromptDetailView,
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