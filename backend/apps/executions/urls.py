from django.urls import path

from .views import (
    ExecutionCompareRecommendView,
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
        "compare-recommend/",
        ExecutionCompareRecommendView.as_view(),
        name="execution-compare-recommend",
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
