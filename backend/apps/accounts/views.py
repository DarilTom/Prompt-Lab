import os
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import (
    urlsafe_base64_decode,
    urlsafe_base64_encode,
)

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    EmailTokenObtainPairSerializer,
    RegisterSerializer,
)

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(
            data=request.data
        )

        if serializer.is_valid():
            user = serializer.save()

            return Response(
                {
                    "message": "Account created successfully.",
                    "user": {
                        "id": user.id,
                        "name": user.first_name,
                        "email": user.email,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailTokenObtainPairSerializer(
            data=request.data
        )

        if serializer.is_valid():
            return Response(
                serializer.validated_data,
                status=status.HTTP_200_OK,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_401_UNAUTHORIZED,
        )

class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get("credential", "").strip()

        if not credential:
            return Response(
                {"detail": "Google credential is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        google_client_id = os.getenv("GOOGLE_CLIENT_ID")

        if not google_client_id:
            return Response(
                {"detail": "Google Sign-In is not configured on the server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            google_user = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                google_client_id,
            )
        except ValueError:
            return Response(
                {"detail": "Invalid Google credential."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        google_sub = google_user.get("sub")
        email = google_user.get("email", "").strip().lower()
        email_verified = google_user.get("email_verified", False)
        name = google_user.get("name", "").strip()

        if not google_sub:
            return Response(
                {"detail": "Google account ID is missing."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email or not email_verified:
            return Response(
                {"detail": "A verified Google email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()

        if user is None:
            username_base = email.split("@")[0]
            username = username_base
            counter = 1

            while User.objects.filter(username=username).exists():
                username = f"{username_base}{counter}"
                counter += 1

            user = User.objects.create(
                username=username,
                first_name=name or username_base,
                email=email,
            )

            user.set_unusable_password()
            user.save(
                update_fields=[
                    "password",
                    "first_name",
                    "email",
                ]
            )

        if not user.is_active:
            return Response(
                {"detail": "This account is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "name": user.first_name,
                    "email": user.email,
                },
            },
            status=status.HTTP_200_OK,
        )

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        return Response(
            {
                "id": user.id,
                "name": user.first_name,
                "email": user.email,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get(
            "email",
            "",
        ).strip().lower()

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(
            email__iexact=email,
            is_active=True,
        ).first()

        # Do not reveal whether an account exists.
        if user and user.has_usable_password():

            uid = urlsafe_base64_encode(
                force_bytes(user.pk)
            )

            token = default_token_generator.make_token(
                user
            )

            frontend_url = os.getenv(
            "FRONTEND_URL",
            "http://localhost:5173",
            ).rstrip("/")

            reset_url = (
            f"{frontend_url}/reset-password/"
            f"{uid}/{token}/"
)

            send_mail(
    subject="Reset your Prompt Lab password",
    message=(
        "Hello,\n\n"
        "We received a request to reset your Prompt Lab "
        "password.\n\n"
        "Reset your password using this link:\n\n"
        f"{reset_url}\n\n"
        "For your security, this link is single-use and "
        "will expire automatically.\n\n"
        "If you did not request this password reset, "
        "you can safely ignore this email.\n\n"
        "— Prompt Lab"
    ),
    from_email=None,
    recipient_list=[user.email],
    fail_silently=False,
)
            
           

        return Response(
            {
                "detail": (
                    "If an account exists for that email, "
                    "a password reset link has been sent."
                )
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, uidb64, token):

        password = request.data.get(
            "password",
            "",
        )

        password_confirm = request.data.get(
            "password_confirm",
            "",
        )

        if not password:
            return Response(
                {"detail": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if password != password_confirm:
            return Response(
                {"detail": "Passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = urlsafe_base64_decode(
                uidb64
            ).decode()

            user = User.objects.get(
                pk=uid
            )

        except (
            TypeError,
            ValueError,
            OverflowError,
            User.DoesNotExist,
        ):
            return Response(
                {"detail": "Invalid reset link."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(
            user,
            token,
        ):
            return Response(
                {
                    "detail": (
                        "Invalid or expired reset link."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        form = SetPasswordForm(
            user,
            {
                "new_password1": password,
                "new_password2": password_confirm,
            },
        )

        if not form.is_valid():
            return Response(
                {
                    "detail": (
                        "Password does not meet the "
                        "requirements."
                    ),
                    "errors": form.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(password)

        user.save(
            update_fields=["password"]
        )

        return Response(
            {
                "detail": (
                    "Password has been reset successfully."
                )
            },
            status=status.HTTP_200_OK,
        )