from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (GoogleLoginView, LoginView, MeView, RegisterView, PasswordResetRequestView, PasswordResetConfirmView)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path(
    "password-reset/",
    PasswordResetRequestView.as_view(),
    name="password-reset-request",
),
path(
    "password-reset-confirm/<uidb64>/<token>/",
    PasswordResetConfirmView.as_view(),
    name="password-reset-confirm",
),
]