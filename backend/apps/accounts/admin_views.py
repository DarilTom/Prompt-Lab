import logging
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminUser
from apps.accounts.serializers import AdminUserSerializer
from apps.evaluations.models import EvaluationRun
from apps.executions.models import Execution
from apps.executions.services import get_installed_models, get_ollama_base_url
from apps.prompts.models import Prompt

logger = logging.getLogger(__name__)
User = get_user_model()


class AdminOverviewStatsView(APIView):
    """
    Returns high-level aggregate statistics across Prompt Lab.
    Strictly admin-only; handles empty database records and Ollama
    availability/unavailability gracefully without crashing.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        # Database counts (always return 0 if empty)
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        inactive_users = total_users - active_users

        total_prompts = Prompt.objects.count()
        total_executions = Execution.objects.count()
        total_completed_evaluations = EvaluationRun.objects.filter(
            status=EvaluationRun.Status.COMPLETED
        ).count()

        # Ollama health & discovery
        ollama_data = {
            "available": False,
            "model_count": 0,
            "models": [],
            "error": None,
        }

        try:
            installed = get_installed_models()
            ollama_data["available"] = True
            ollama_data["model_count"] = len(installed)
            ollama_data["models"] = [
                {
                    "name": m.get("name") or m.get("model") or "",
                    "family": m.get("family") or "",
                    "parameter_size": m.get("parameter_size") or "",
                    "size_formatted": m.get("size_formatted") or "",
                }
                for m in installed
            ]
        except Exception as exc:
            logger.warning("Failed to reach Ollama for admin overview: %s", exc)
            ollama_data["available"] = False
            base_url = get_ollama_base_url()
            ollama_data["error"] = (
                f"Unable to connect to Ollama runtime at {base_url}. "
                "Ensure the Ollama daemon or tunnel is running."
            )

        return Response(
            {
                "users": {
                    "total": total_users,
                    "active": active_users,
                    "inactive": inactive_users,
                },
                "prompts": {
                    "total": total_prompts,
                },
                "executions": {
                    "total": total_executions,
                },
                "evaluations": {
                    "total_completed": total_completed_evaluations,
                },
                "ollama": ollama_data,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserListView(APIView):
    """
    Searchable, admin-only list of registered users.
    Excludes sensitive data (passwords, tokens, etc.).
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        search_query = request.query_params.get("search", "").strip()

        users_qs = User.objects.all().order_by("-date_joined")

        if search_query:
            users_qs = users_qs.filter(
                Q(username__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )

        serializer = AdminUserSerializer(users_qs, many=True)
        return Response(
            {
                "users": serializer.data,
                "count": users_qs.count(),
            },
            status=status.HTTP_200_OK,
        )


class AdminUserStatusUpdateView(APIView):
    """
    Admin-only endpoint to activate or deactivate a user account.
    Guards against self-deactivation.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, user_id):
        target_user = get_object_or_404(User, id=user_id)

        # Protection against self-deactivation
        if target_user.id == request.user.id:
            return Response(
                {
                    "detail": "You cannot change the active status of your own account."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_active = request.data.get("is_active")
        if is_active is None or not isinstance(is_active, bool):
            return Response(
                {"detail": "Field 'is_active' must be a valid boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_user.is_active = is_active
        target_user.save(update_fields=["is_active"])

        action_word = "activated" if is_active else "deactivated"
        return Response(
            {
                "detail": f"User '{target_user.username}' has been {action_word}.",
                "user": AdminUserSerializer(target_user).data,
            },
            status=status.HTTP_200_OK,
        )
