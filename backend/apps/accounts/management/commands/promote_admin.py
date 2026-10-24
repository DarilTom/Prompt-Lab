from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

User = get_user_model()


class Command(BaseCommand):
    help = "Promote or demote a Prompt Lab user to/from administrator (staff and superuser status)."

    def add_arguments(self, parser):
        parser.add_argument(
            "identifier",
            type=str,
            help="The username or email address of the user to promote/demote.",
        )
        parser.add_argument(
            "--demote",
            action="store_true",
            help="Demote the user by removing admin and staff privileges.",
        )
        parser.add_argument(
            "--staff-only",
            action="store_true",
            help="Grant staff access only (is_staff=True, is_superuser=False).",
        )

    def handle(self, *args, **options):
        identifier = options["identifier"].strip()
        demote = options["demote"]
        staff_only = options["staff_only"]

        user = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()

        if not user:
            raise CommandError(
                f"No user found matching identifier '{identifier}'. Please verify the username or email."
            )

        if demote:
            user.is_staff = False
            user.is_superuser = False
            user.save(update_fields=["is_staff", "is_superuser"])
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully demoted '{user.username}' ({user.email}). User is no longer an administrator."
                )
            )
        else:
            user.is_staff = True
            if staff_only:
                user.is_superuser = False
            else:
                user.is_superuser = True
            user.save(update_fields=["is_staff", "is_superuser"])

            role_desc = "Staff Administrator" if staff_only else "Superuser Administrator"
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully promoted '{user.username}' ({user.email}) to {role_desc} "
                    f"(is_staff={user.is_staff}, is_superuser={user.is_superuser})."
                )
            )
