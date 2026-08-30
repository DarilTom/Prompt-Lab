from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for Prompt Lab.

    The model currently extends Django's built-in AbstractUser
    so we retain Django's authentication features while keeping
    the project ready for future account-related fields.
    """

    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username