import secrets

from django.db import models
from cloudinary.models import CloudinaryField

from gyms.models import Gym


class Member(models.Model):
    first_name = models.CharField(
        max_length=100,
        verbose_name="Nombre",
    )

    last_name = models.CharField(
        max_length=100,
        verbose_name="Apellido",
    )

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="members",
        verbose_name="Gimnasio",
    )

    photo = CloudinaryField(
        "Foto",
        blank=True,
        null=True,
    )

    phone = models.CharField(
        max_length=30,
        verbose_name="Teléfono",
    )

    email = models.EmailField(
        blank=True,
        verbose_name="Email",
    )

    access_token = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        null=True,
        verbose_name="Token de acceso",
    )

    active = models.BooleanField(
        default=True,
        verbose_name="Activo",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de creación",
    )

    class Meta:
        verbose_name = "Miembro"
        verbose_name_plural = "Miembros"

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