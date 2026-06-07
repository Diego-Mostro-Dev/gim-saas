import secrets

from django.db import models
from cloudinary.models import CloudinaryField

from gyms.models import Gym


class Member(models.Model):
    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100
    )

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="members",
    )

    photo = CloudinaryField(
        "member_photo",
        blank=True,
        null=True,
    )

    phone = models.CharField(
        max_length=30
    )

    email = models.EmailField(
        blank=True
    )

    access_token = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        null=True,
    )

    active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def save(self, *args, **kwargs):
        if not self.access_token:
            self.access_token = (
                secrets.token_urlsafe(32)
            )

        super().save(
            *args,
            **kwargs,
        )

    def __str__(self):
        return (
            f"{self.first_name} "
            f"{self.last_name}"
        )