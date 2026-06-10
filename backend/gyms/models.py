import uuid
from django.db import models
from django.conf import settings
from cloudinary.models import CloudinaryField

class Gym(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    active = models.BooleanField(default=True)
    logo = CloudinaryField(
        "logo",
        blank=True,
        null=True,
    )

    onboarding_code = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    whatsapp = models.CharField(
        max_length=30,
        blank=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    email = models.EmailField(
        blank=True,
    )

    default_schedule_capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    allow_member_schedule_changes = models.BooleanField(
        default=False,
    )

    schedule_change_notice_hours = models.PositiveIntegerField(
        default=24,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def get_onboarding_url(self):
        return (
            settings.FRONTEND_URL+
            f"/onboarding/{self.onboarding_code}"
        )

    def get_public_register_url(self):
        return (
            settings.FRONTEND_URL+
            f"/register/{self.onboarding_code}"
        )