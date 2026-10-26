import re
import requests
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prompts.models import PromptVersion

from .models import Execution
from .serializers import ExecutionSerializer
from .services import (
    compare_and_recommend,
    compose_prompt,
    get_installed_models,
    get_ollama_base_url,
    run_ollama,
    validate_model_installed,
)


class OllamaModelListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            models = get_installed_models()
            return Response({"models": models}, status=status.HTTP_200_OK)
        except requests.exceptions.ConnectionError:
            base_url = get_ollama_base_url()
            return Response(
                {
                    "detail": (
                        f"Unable to connect to Ollama. Please ensure the "
                        f"Ollama service is reachable at {base_url}."
                    ),
                    "error": "connection_error",
                    "models": [],
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except requests.exceptions.Timeout:
            return Response(
                {
                    "detail": (
                        "Ollama request timed out while fetching installed models."
                    ),
                    "error": "timeout",
                    "models": [],
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except requests.exceptions.RequestException as exc:
            return Response(
                {
                    "detail": "Failed to retrieve models from Ollama.",
                    "error": str(exc),
                    "models": [],
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            return Response(
                {
                    "detail": "An unexpected error occurred while fetching models.",
                    "error": str(exc),
                    "models": [],
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


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

        if not model or not str(model).strip():
            return Response(
                {"detail": "model is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model = str(model).strip()
        is_valid, validation_error = validate_model_installed(model)
        if not is_valid:
            return Response(
                {"detail": validation_error},
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

        user_prompt = compose_prompt(
            prompt_version.content,
            input_text,
        )

        run_kwargs = {}
        if "qwen" in model.lower():
            run_kwargs["think"] = False

        try:
            result = run_ollama(
                model=model,
                user_prompt=user_prompt,
                system_prompt=prompt_version.system_prompt,
                **run_kwargs,
            )

            message = result.get("message", {})
            raw_content = message.get("content", "")
            if isinstance(raw_content, list):
                raw_content = "\n".join(str(m) for m in raw_content)
            elif not isinstance(raw_content, str):
                raw_content = str(raw_content) if raw_content else ""

            # Clean any internal reasoning think blocks if present
            cleaned_content = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL)
            cleaned_content = re.sub(r"^.*?</think>", "", cleaned_content, flags=re.DOTALL).strip()

            execution.output_text = cleaned_content if cleaned_content else raw_content
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

            # Lifecycle: Draft -> Testing on first successful execution
            prompt = prompt_version.prompt
            if prompt.transition_to_testing_if_draft():
                execution.prompt.refresh_from_db()

            return Response(
                self.get_serializer(execution).data,
                status=status.HTTP_201_CREATED,
            )

        except requests.exceptions.Timeout as exc:
            execution.status = "failed"
            error_msg = (
                f"Ollama took too long to respond while executing the prompt with model '{model}'. "
                "Please try again."
            )
            execution.error_message = error_msg
            execution.save(update_fields=["status", "error_message"])

            return Response(
                {
                    "detail": error_msg,
                    "error": str(exc),
                    "execution_id": execution.id,
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )

        except requests.exceptions.ConnectionError as exc:
            execution.status = "failed"
            base_url = get_ollama_base_url()
            error_msg = (
                f"Unable to connect to Ollama at {base_url}. "
                "Please ensure the Ollama service is reachable."
            )
            execution.error_message = error_msg
            execution.save(update_fields=["status", "error_message"])

            return Response(
                {
                    "detail": error_msg,
                    "error": str(exc),
                    "execution_id": execution.id,
                },
                status=status.HTTP_502_BAD_GATEWAY,
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


class ExecutionDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = ExecutionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Execution.objects
            .filter(owner=self.request.user)
            .select_related("prompt", "prompt_version")
        )

    def destroy(self, request, *args, **kwargs):
        execution_id = kwargs.get("pk")

        # Explicit authorization check: verify user owns this execution if it exists
        if (
            Execution.objects.filter(pk=execution_id)
            .exclude(owner=request.user)
            .exists()
        ):
            return Response(
                {
                    "detail": "You do not have permission to delete this execution."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        execution = self.get_object()

        # Safeguard: prevent deletion if referenced by evaluation records
        if execution.evaluation_results.exists():
            return Response(
                {
                    "detail": (
                        "This execution cannot be deleted because it is referenced "
                        "by evaluation run results in Evaluation Lab."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_destroy(execution)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExecutionCompareRecommendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        execution_a_id = request.data.get("execution_a_id")
        execution_b_id = request.data.get("execution_b_id")
        judge_model = request.data.get("judge_model")

        if not execution_a_id or not execution_b_id:
            return Response(
                {"detail": "Both execution_a_id and execution_b_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if str(execution_a_id) == str(execution_b_id):
            return Response(
                {
                    "detail": "Cannot compare an execution with itself. Select two different executions."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            exec_a = (
                Execution.objects.select_related("prompt", "prompt_version")
                .filter(owner=request.user)
                .get(id=execution_a_id)
            )
            exec_b = (
                Execution.objects.select_related("prompt", "prompt_version")
                .filter(owner=request.user)
                .get(id=execution_b_id)
            )
        except Execution.DoesNotExist:
            return Response(
                {
                    "detail": "One or both executions were not found or do not belong to you."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if (
            not exec_a.output_text
            or not exec_a.output_text.strip()
            or exec_a.status == "failed"
        ):
            return Response(
                {
                    "detail": (
                        f"Execution RUN-{exec_a.id:03d} has no usable output or has failed. "
                        "Both executions must have completed successfully."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            not exec_b.output_text
            or not exec_b.output_text.strip()
            or exec_b.status == "failed"
        ):
            return Response(
                {
                    "detail": (
                        f"Execution RUN-{exec_b.id:03d} has no usable output or has failed. "
                        "Both executions must have completed successfully."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if judge_model:
            is_installed, err_msg = validate_model_installed(judge_model)
            if not is_installed:
                return Response(
                    {
                        "detail": (
                            err_msg
                            or f"Judging model '{judge_model}' is not installed in local Ollama."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            comparison_result = compare_and_recommend(
                execution_a=exec_a,
                execution_b=exec_b,
                judge_model=judge_model,
            )
            return Response(comparison_result, status=status.HTTP_200_OK)
        except requests.exceptions.Timeout as exc:
            return Response(
                {
                    "detail": (
                        f"Ollama timed out while evaluating the responses with model '{judge_model or 'evaluator'}'. "
                        "Please try again or select a faster model."
                    ),
                    "error": str(exc),
                },
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except requests.exceptions.ConnectionError as exc:
            base_url = get_ollama_base_url()
            return Response(
                {
                    "detail": (
                        f"Unable to connect to Ollama service at {base_url}. "
                        "Please ensure the Ollama service is reachable."
                    ),
                    "error": str(exc),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            return Response(
                {
                    "detail": "Failed to analyze and recommend prompt comparison.",
                    "error": str(exc),
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )