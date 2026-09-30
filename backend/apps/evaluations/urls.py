from django.urls import path

from .views import (
    DatasetTestCaseListCreateView,
    EvaluationDatasetDetailView,
    EvaluationDatasetListCreateView,
    EvaluationRunDetailView,
    EvaluationRunListCreateView,
    TestCaseDetailView,
)


urlpatterns = [
    # Datasets
    path(
        "datasets/",
        EvaluationDatasetListCreateView.as_view(),
        name="evaluation-dataset-list-create",
    ),

    path(
        "datasets/<int:pk>/",
        EvaluationDatasetDetailView.as_view(),
        name="evaluation-dataset-detail",
    ),

    # Test cases
    path(
        "datasets/<int:dataset_id>/test-cases/",
        DatasetTestCaseListCreateView.as_view(),
        name="dataset-test-case-list-create",
    ),

    path(
        "test-cases/<int:pk>/",
        TestCaseDetailView.as_view(),
        name="test-case-detail",
    ),

    # Evaluation runs
    path(
        "runs/",
        EvaluationRunListCreateView.as_view(),
        name="evaluation-run-list-create",
    ),

    path(
        "runs/<int:pk>/",
        EvaluationRunDetailView.as_view(),
        name="evaluation-run-detail",
    ),
]