from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        write_only=True,
        max_length=150,
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
    )

    password_confirm = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "name",
            "email",
            "password",
            "password_confirm",
        ]

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )

        if User.objects.filter(email__iexact=attrs["email"]).exists():
            raise serializers.ValidationError(
                {"email": "An account with this email already exists."}
            )

        return attrs

    def create(self, validated_data):
        name = validated_data.pop("name")
        validated_data.pop("password_confirm")

        email = validated_data.pop("email")
        password = validated_data.pop("password")

        base_username = email.split("@")[0]
        username = base_username
        counter = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=email,
            first_name=name,
        )

        user.set_password(password)
        user.save()

        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")

        user = User.objects.filter(email__iexact=email).first()

        if user is None or not user.check_password(password):
            raise serializers.ValidationError(
                {"detail": "Invalid email or password."}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account is inactive."}
            )

        refresh = self.get_token(user)

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class AdminUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "name",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "name",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        source="first_name",
        required=False,
        allow_blank=True,
        max_length=150,
    )
    display_name = serializers.CharField(read_only=True)
    is_admin = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "name",
            "display_name",
            "default_model",
            "notify_on_completion",
            "auto_scroll_results",
            "is_staff",
            "is_superuser",
            "is_admin",
            "has_usable_password",
            "date_joined",
            "last_login",
        ]
        read_only_fields = [
            "id",
            "username",
            "display_name",
            "is_staff",
            "is_superuser",
            "is_admin",
            "has_usable_password",
            "date_joined",
            "last_login",
        ]

    def get_is_admin(self, obj):
        return bool(obj.is_staff or obj.is_superuser)

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    def validate_email(self, value):
        cleaned = value.lower().strip()
        user = self.instance
        if user and User.objects.filter(email__iexact=cleaned).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return cleaned

    def validate_default_model(self, value):
        return (value or "").strip()


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        style={"input_type": "password"},
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        user = self.context.get("user")
        if not user:
            raise serializers.ValidationError("User context missing.")

        current_password = attrs.get("current_password", "")
        new_password = attrs.get("new_password", "")
        new_password_confirm = attrs.get("new_password_confirm", "")

        # If user has a usable password, verify current password
        if user.has_usable_password():
            if not current_password:
                raise serializers.ValidationError(
                    {"current_password": "Current password is required."}
                )
            if not user.check_password(current_password):
                raise serializers.ValidationError(
                    {"current_password": "The current password entered is incorrect."}
                )

        if new_password != new_password_confirm:
            raise serializers.ValidationError(
                {"new_password_confirm": "New passwords do not match."}
            )

        # Validate with Django's password validators
        try:
            validate_password(new_password, user=user)
        except Exception as exc:
            messages = list(exc.messages) if hasattr(exc, "messages") else [str(exc)]
            raise serializers.ValidationError({"new_password": messages})

        return attrs

    def save(self):
        user = self.context["user"]
        new_password = self.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return user
