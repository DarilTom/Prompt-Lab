from django.urls import path
from apps.accounts.admin_views import (
    AdminOverviewStatsView,
    AdminUserListView,
    AdminUserStatusUpdateView,
)

urlpatterns = [
    path("stats/", AdminOverviewStatsView.as_view(), name="admin-stats"),
    path("users/", AdminUserListView.as_view(), name="admin-users"),
    path(
        "users/<int:user_id>/status/",
        AdminUserStatusUpdateView.as_view(),
        name="admin-user-status",
    ),
]
