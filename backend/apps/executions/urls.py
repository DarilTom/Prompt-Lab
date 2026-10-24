from django.urls import path

from .views import (
    ExecutionDetailView,
    ExecutionListCreateView,
    OllamaModelListView,
)


urlpatterns = [
    path(
        "",
        ExecutionListCreateView.as_view(),
        name="execution-list-create",
    ),
    path(
        "models/",
        OllamaModelListView.as_view(),
        name="ollama-model-list",
    ),
    path(
        "<int:pk>/",
        ExecutionDetailView.as_view(),
        name="execution-detail",
    ),
]
