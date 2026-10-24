"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path

from apps.executions.views import OllamaModelListView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/prompts/", include("apps.prompts.urls")),
    path("api/executions/", include("apps.executions.urls")),
    path("api/evaluations/", include("apps.evaluations.urls")),
    path("api/models/", OllamaModelListView.as_view(), name="ollama-model-list-root"),
]
