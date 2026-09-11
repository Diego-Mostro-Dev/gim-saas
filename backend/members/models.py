import logging
import secrets

import cloudinary

from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from cloudinary.models import CloudinaryField

# desde config.api.backup se usa el mismo patrón:
# guardar el public_id y armar la URL firmada al serializar.
logger = logging.getLogger(__name__)

from gyms.models import Discount, Gym


class HealthInsurance(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="health_insurances",
        verbose_name="Gimnasio",
    )
    name = models.CharField(
        max_length=120,
        verbose_name="Obra social / seguro médico",
    )
    session_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Coseguro por sesión",
        help_text=(
            "Coseguro que paga el socio por cada sesión de actividades por "
            "sesiones (ej. IAPOS cobra $6.000 por sesión). Si la obra social "
            "cubre las sesiones, dejalo en 0."
        ),
    )
    sellado_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Sellado (monto único)",
        help_text=(
            "Monto único que paga el socio al inscribirse en un paquete de "
            "sesiones (ej. IAPOS cobra $6.000 de sellado). Opcional."
        ),
    )
    active = models.BooleanField(
        default=True,
        verbose_name="Activo",
        help_text=(
            "Inactivar oculta la obra social en los selectores y desvincula "
            "a los socios al volver a cargar la ficha."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Obra social"
        verbose_name_plural = "Obras sociales"
        unique_together = ("gym", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Member(models.Model):
    class EntryMode(models.TextChoices):
        GYM = "GYM", "Gimnasio"
        ACTIVITY_ONLY = "ACTIVITY_ONLY", "Solo actividades"

    entry_mode = models.CharField(
        max_length=20,
        choices=EntryMode.choices,
        default=EntryMode.GYM,
        verbose_name="Modo de ingreso",
    )

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

    document_number = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Nº de documento",
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de nacimiento",
    )

    health_insurance = models.CharField(
        max_length=120,
        blank=True,
        verbose_name="Obra social / seguro médico",
    )

    affiliate_number = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Nº de afiliado",
    )

    insurance = models.ForeignKey(
        HealthInsurance,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
        verbose_name="Obra social configurada",
        help_text="Obra social configurada, define el precio por sesión.",
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

    is_comp = models.BooleanField(
        default=False,
        verbose_name="Pase de cortesía",
        help_text=(
            "Socio con acceso de cortesía: no se le cobra por la membresía "
            "ni por las actividades y nunca se le bloquea por falta de pago."
        ),
    )

    discount = models.ForeignKey(
        Discount,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
        verbose_name="Descuento",
        help_text=(
            "Descuento porcentual asignado por el gimnasio a este socio. "
            "Se aplica sobre el total mensual (plan + actividades)."
        ),
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


class MemberAttachment(models.Model):
    class Category(models.TextChoices):
        MEDICAL_ORDER = "medical_order", "Orden médica / sesiones"
        PAYMENT_PROOF = "payment_proof", "Comprobante de pago"
        ELECTROCARDIOGRAM = "electro", "Electrocardiograma / estudios"
        OTHER = "other", "Otro"

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="Socio",
    )
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="Gimnasio",
    )
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        verbose_name="Categoría",
    )
    file = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Adjunto (public_id de Cloudinary)",
    )
    note = models.TextField(
        blank=True,
        verbose_name="Nota",
        help_text="Aclaración opcional del socio (ej. nombre del titular de la transferencia).",
    )
    reviewed = models.BooleanField(
        default=False,
        verbose_name="Revisado por el staff",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de subida",
    )

    class Meta:
        verbose_name = "Adjunto del socio"
        verbose_name_plural = "Adjuntos de los socios"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["gym", "reviewed"]),
            models.Index(fields=["member", "created_at"]),
        ]

    def __str__(self):
        return f"{self.member_id} · {self.category} · {self.file or 'sin archivo'}"

    def delete_cloudinary_asset(self):
        """Elimina el asset de Cloudinary cuando se borra el adjunto."""
        if not self.file:
            return
        try:
            cloudinary.uploader.destroy(
                self.file,
                resource_type="image",
                type="private",
            )
        except Exception:
            logger.exception(
                "No se pudo borrar el adjunto de Cloudinary: %s",
                self.file,
            )


@receiver(post_delete, sender=MemberAttachment)
def _member_attachment_post_delete(sender, instance, **kwargs):
    instance.delete_cloudinary_asset()