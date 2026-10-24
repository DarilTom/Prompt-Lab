from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.db import transaction

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Prompt, PromptVersion
from .serializers import (
    PromptCreateSerializer,
    PromptSerializer,
    PromptVersionSerializer,
)
from apps.executions.services import validate_model_installed
from .services import generate_improved_prompt


class PromptListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Prompt.objects.filter(
            owner=self.request.user
        ).prefetch_related("versions")

        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")
        status = self.request.query_params.get("status")

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
            )

        if category:
            queryset = queryset.filter(category=category)

        if status:
            queryset = queryset.filter(status=status)

        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PromptCreateSerializer

        return PromptSerializer

    
@transaction.atomic
def perform_create(self, serializer):
    prompt = get_object_or_404(
        Prompt,
        pk=self.kwargs["pk"],
        owner=self.request.user,
    )

    latest_version = (
        prompt.versions
        .order_by("-version_number")
        .first()
    )

    next_version = (
        latest_version.version_number + 1
        if latest_version
        else 1
    )

    serializer.save(
        prompt=prompt,
        created_by=self.request.user,
        version_number=next_version,
    )

    prompt.save(update_fields=["updated_at"])
    prompt = get_object_or_404(
        Prompt,
        pk=self.kwargs["pk"],
        owner=self.request.user,
    )

    latest_version = (
        prompt.versions
        .order_by("-version_number")
        .first()
    )

    next_version = (
        latest_version.version_number + 1
        if latest_version
        else 1
    )

    serializer.save(
        prompt=prompt,
        created_by=self.request.user,
        version_number=next_version,
    )

    prompt.save(update_fields=["updated_at"])


class PromptDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PromptSerializer

    def get_queryset(self):
        return Prompt.objects.filter(owner=self.request.user).prefetch_related("versions")


class PromptVersionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_prompt(self):
        return generics.get_object_or_404(
            Prompt,
            id=self.kwargs["prompt_id"],
            owner=self.request.user,
        )

    def get_queryset(self):
        return PromptVersion.objects.filter(
            prompt=self.get_prompt()
        )

    def get_serializer_class(self):
        return PromptVersionSerializer

    def perform_create(self, serializer):
        prompt = self.get_prompt()

        latest_version = (
            PromptVersion.objects
            .filter(prompt=prompt)
            .order_by("-version_number")
            .first()
        )

        next_version = (
            latest_version.version_number + 1
            if latest_version
            else 1
        )

        serializer.save(
            prompt=prompt,
            version_number=next_version,
            created_by=self.request.user,
        )


class PromptImproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        prompt_text = request.data.get("prompt_text", "")
        if isinstance(prompt_text, (list, tuple)):
            prompt_text = "\n".join(
                str(item).strip()
                for item in prompt_text
                if item is not None and str(item).strip()
            )

        if not isinstance(prompt_text, str) or not prompt_text.strip():
            return Response(
                {"detail": "Please describe what you want the AI to accomplish."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        context = request.data.get("context", "")
        if isinstance(context, (list, tuple)):
            context = "\n".join(
                str(c).strip()
                for c in context
                if c is not None and str(c).strip()
            )
        elif not isinstance(context, str):
            context = str(context).strip() if context else ""

        tone = request.data.get("tone", "")
        if isinstance(tone, (list, tuple)):
            tone = ", ".join(
                str(t).strip()
                for t in tone
                if t is not None and str(t).strip()
            )
        elif not isinstance(tone, str):
            tone = str(tone).strip() if tone else ""

        output_format = request.data.get("output_format", "")
        if isinstance(output_format, (list, tuple)):
            output_format = ", ".join(
                str(o).strip()
                for o in output_format
                if o is not None and str(o).strip()
            )
        elif not isinstance(output_format, str):
            output_format = str(output_format).strip() if output_format else ""

        model = request.data.get("model")
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

        try:
            result = generate_improved_prompt(
                prompt_text=prompt_text.strip(),
                context=context.strip() if context else "",
                tone=tone.strip() if tone else "",
                output_format=output_format.strip() if output_format else "",
                model=model,
            )
            return Response(result, status=status.HTTP_200_OK)
        except (ConnectionError, TimeoutError) as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as e:
            return Response(
                {"detail": f"Unable to improve prompt: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
