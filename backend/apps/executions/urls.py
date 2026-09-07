from django.urls import path

from .views import (
    ExecutionDetailView,
    ExecutionListCreateView,
)


urlpatterns = [
    path(
        "",
        ExecutionListCreateView.as_view(),
        name="execution-list-create",
    ),
    path(
        "<int:pk>/",
        ExecutionDetailView.as_view(),
        name="execution-detail",
    ),
]