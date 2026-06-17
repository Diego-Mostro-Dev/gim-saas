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

    # --- Phase 8A Gym Configuration ---
    payment_due_day = models.PositiveIntegerField(default=10)
    access_block_day = models.PositiveIntegerField(default=16)
    allow_plan_changes = models.BooleanField(default=True)
    allow_schedule_changes = models.BooleanField(default=True)
    schedule_change_cooldown_hours = models.PositiveIntegerField(default=168)
    max_schedule_changes_per_month = models.PositiveIntegerField(default=4)
    schedule_change_notice_days = models.PositiveIntegerField(default=0)

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