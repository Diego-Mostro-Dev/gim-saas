from django.db import models
from django.contrib.auth.models import User
from gyms.models import Gym


class UserProfile(models.Model):
    ROLE_OWNER = "owner"
    ROLE_STAFF = "staff"
    ROLE_PROFESSOR = "professor"
    ROLE_TRAINER = "trainer"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Dueño"),
        (ROLE_STAFF, "Staff"),
        (ROLE_PROFESSOR, "Profesor"),
        (ROLE_TRAINER, "Entrenador/a"),
    ]

    GENDER_CHOICES = [
        ("male", "Varón"),
        ("female", "Mujer"),
    ]

    role = models.CharField(
        max_length=12,
        choices=ROLE_CHOICES,
        default=ROLE_STAFF,
        verbose_name="Rol",
    )

    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        blank=True,
        verbose_name="Género",
        help_text="Género del/la entrenador/a, usado para filtrar trainers compatibles.",
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

    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Teléfono",
    )

    whatsapp = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Whatsapp",
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