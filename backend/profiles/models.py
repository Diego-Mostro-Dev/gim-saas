from django.db import models
from django.contrib.auth.models import User
from gyms.models import Gym


class UserProfile(models.Model):
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