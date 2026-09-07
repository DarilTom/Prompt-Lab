from django.shortcuts import render

# Create your views here.
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.db import transaction

from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Prompt, PromptVersion
from .serializers import (
    PromptCreateSerializer,
    PromptSerializer,
    PromptVersionSerializer,
)


class PromptListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Prompt.objects.filter(
            owner=self.request.user
        )

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
        return Prompt.objects.filter(owner=self.request.user)


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