import uuid
from typing import ClassVar
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
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
    payment_due_day = models.PositiveIntegerField(default=10, verbose_name="Día de vencimiento")
    access_block_day = models.PositiveIntegerField(default=16, verbose_name="Día de bloqueo")
    allow_plan_changes = models.BooleanField(default=True, verbose_name="Permitir cambios de plan")
    allow_schedule_changes = models.BooleanField(default=True, verbose_name="Permitir cambios de horario")
    schedule_change_cooldown_hours = models.PositiveIntegerField(default=168, verbose_name="Horas de espera entre cambios")
    max_schedule_changes_per_month = models.PositiveIntegerField(default=4, verbose_name="Máximo de cambios por mes")
    schedule_change_notice_days = models.PositiveIntegerField(default=0, verbose_name="Días de aviso para cambios")

    features = models.JSONField(default=dict, blank=True, verbose_name="Características")

    FEATURE_REGISTRY: ClassVar[dict[str, dict]] = {
        "extra_activities": {
            "default": False,
            "label": "Actividades Extra",
            "group": "modules",
        },
    }

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

    def has_feature(self, feature_name: str) -> bool:
        entry = self.FEATURE_REGISTRY.get(feature_name)
        if entry is None:
            return False
        return self.features.get(feature_name, entry["default"])

    def enabled_features(self) -> list[str]:
        return [
            name for name in self.FEATURE_REGISTRY
            if self.features.get(name, self.FEATURE_REGISTRY[name]["default"])
        ]

    def clean(self):
        unknown = set(self.features.keys()) - set(self.FEATURE_REGISTRY.keys())
        if unknown:
            raise ValidationError(
                f"Características desconocidas: {', '.join(sorted(unknown))}. "
                f"Características válidas: {', '.join(self.FEATURE_REGISTRY.keys())}."
            )