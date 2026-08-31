import uuid

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from cloudinary.models import CloudinaryField

class Gym(models.Model):
    name = models.CharField(max_length=100, verbose_name="Nombre")
    slug = models.SlugField(unique=True, verbose_name="Slug")
    active = models.BooleanField(default=True, verbose_name="Activo")
    logo = CloudinaryField(
        "logo",
        blank=True,
        null=True,
    )

    app_icon = CloudinaryField(
        "app_icon",
        blank=True,
        null=True,
    )

    qr_attendance_message = models.CharField(
        max_length=120,
        blank=True,
        default="Marcá tu asistencia escaneando este código",
        verbose_name="Mensaje del QR de asistencia",
    )

    qr_registration_message = models.CharField(
        max_length=120,
        blank=True,
        default="Registrate como socio escaneando este código",
        verbose_name="Mensaje del QR de registro",
    )

    onboarding_code = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name="Código de registro",
    )

    whatsapp = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="WhatsApp",
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Teléfono",
    )

    email = models.EmailField(
        blank=True,
        verbose_name="Email",
    )

    default_schedule_capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Capacidad por defecto",
    )

    allow_member_schedule_changes = models.BooleanField(
        default=False,
        verbose_name="Permitir cambios de horario",
    )

    schedule_change_notice_hours = models.PositiveIntegerField(
        default=24,
        verbose_name="Horas de aviso para cambios",
    )

    # --- Phase 8A Gym Configuration ---
    payment_due_day = models.PositiveIntegerField(
        default=10,
        verbose_name="Día de vencimiento",
        validators=[MinValueValidator(1), MaxValueValidator(31)],
    )
    access_block_day = models.PositiveIntegerField(
        default=16,
        verbose_name="Día de bloqueo",
        validators=[MinValueValidator(1), MaxValueValidator(31)],
    )
    allow_activity_without_membership = models.BooleanField(
        default=True,
        verbose_name="Renovar socios solo-actividad",
        help_text=(
            "Control de plataforma: cuando está activo, los socios con plan base "
            "(solo actividades, sin membresía de gimnasio) se renuevan "
            "automáticamente en cada ciclo. Se oculta al staff del gimnasio y se "
            "gestiona desde el admin central."
        ),
    )

    allow_plan_changes = models.BooleanField(default=True, verbose_name="Permitir cambios de plan")
    allow_schedule_changes = models.BooleanField(default=True, verbose_name="Permitir cambios de horario")
    schedule_change_cooldown_hours = models.PositiveIntegerField(default=168, verbose_name="Horas de espera entre cambios")
    max_schedule_changes_per_month = models.PositiveIntegerField(default=4, verbose_name="Máximo de cambios por mes")

    features = models.JSONField(default=dict, blank=True, verbose_name="Características")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")

    class Meta:
        verbose_name = "Gimnasio"
        verbose_name_plural = "Gimnasios"

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

    def clean(self):
        """Ensure features is a dict if set."""
        if not isinstance(self.features, dict):
            from django.core.exceptions import ValidationError
            raise ValidationError("features debe ser un diccionario.")

        if self.access_block_day <= self.payment_due_day:
            from django.core.exceptions import ValidationError
            raise ValidationError(
                {
                    "access_block_day": (
                        "El día de bloqueo debe ser posterior al día de vencimiento "
                        "(payment_due_day={}, access_block_day={}).".format(
                            self.payment_due_day, self.access_block_day
                        )
                    )
                }
            )