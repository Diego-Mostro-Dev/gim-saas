from django.db import models
from django.contrib.auth.models import User
from gyms.models import Gym


class UserProfile(models.Model):
    ROLE_OWNER = "owner"
    ROLE_STAFF = "staff"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Dueño"),
        (ROLE_STAFF, "Staff"),
    ]

    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default=ROLE_STAFF,
        verbose_name="Rol",
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name="Usuario",
    )

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        verbose_name="Gimnasio",
    )

    must_change_password = models.BooleanField(
        default=True,
        verbose_name="Debe cambiar la contraseña",
    )

    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuario"

    def __str__(self):
        return self.user.username