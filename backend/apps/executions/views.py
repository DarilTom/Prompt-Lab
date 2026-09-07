from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.prompts.models import PromptVersion

from .models import Execution
from .serializers import ExecutionSerializer
from .services import run_ollama


class ExecutionListCreateView(generics.ListCreateAPIView):
    serializer_class = ExecutionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Execution.objects
            .filter(owner=self.request.user)
            .select_related("prompt", "prompt_version")
        )

        prompt_id = self.request.query_params.get("prompt")

        if prompt_id:
            queryset = queryset.filter(prompt_id=prompt_id)

        return queryset

    def create(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return Response(
                {
                    "detail": (
                        "Authentication credentials were not provided."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        prompt_version_id = request.data.get("prompt_version")
        model = request.data.get("model")
        input_text = request.data.get("input_text", "")

        if not prompt_version_id:
            return Response(
                {"detail": "prompt_version is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not model:
            return Response(
                {"detail": "model is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not input_text.strip():
            return Response(
                {"detail": "input_text is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt_version = get_object_or_404(
            PromptVersion.objects.select_related("prompt"),
            pk=prompt_version_id,
            prompt__owner=request.user,
        )

        execution = Execution.objects.create(
            owner=request.user,
            prompt=prompt_version.prompt,
            prompt_version=prompt_version,
            model=model,
            input_text=input_text,
            status="running",
        )

        try:
            result = run_ollama(
                model=model,
                user_prompt=input_text,
                system_prompt=prompt_version.system_prompt,
            )

            message = result.get("message", {})

            execution.output_text = message.get("content", "")
            execution.status = "completed"

            execution.total_duration = result.get(
                "total_duration"
            )

            execution.load_duration = result.get(
                "load_duration"
            )

            execution.prompt_eval_count = result.get(
                "prompt_eval_count"
            )

            execution.eval_count = result.get(
                "eval_count"
            )

            execution.save()

            return Response(
                self.get_serializer(execution).data,
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            execution.status = "failed"
            execution.error_message = str(exc)

            execution.save(
                update_fields=[
                    "status",
                    "error_message",
                ]
            )

            return Response(
                {
                    "detail": "Ollama execution failed.",
                    "error": str(exc),
                    "execution_id": execution.id,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )


class ExecutionDetailView(generics.RetrieveAPIView):
    serializer_class = ExecutionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Execution.objects
            .filter(owner=self.request.user)
            .select_related("prompt", "prompt_version")
        )