import logging
import secrets
from datetime import timedelta

import cloudinary

from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
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

    whatsapp = models.CharField(
        max_length=30,
        blank=True,
        verbose_name="Whatsapp",
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

    address = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Dirección",
        help_text="Dirección del socio (ej: domicilio donde entrena el personal trainer).",
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

    access_token_issued_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Token de acceso emitido el",
        help_text=(
            "Fecha de emisión del token de portal actual. Controla la "
            "rotación automática (P1-1): al leer los datos del socio, un "
            "token más viejo que MEMBER_ACCESS_TOKEN_TTL_DAYS se reemplaza "
            "por uno nuevo y se devuelve en la respuesta."
        ),
    )

    access_token_previous = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        verbose_name="Token de acceso anterior",
        help_text=(
            "Token de una generación anterior, aceptado brevemente para no "
            "romper URLs/links ya impresos cuando el portal rota el token."
        ),
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

    def _get_token_ttl(self):
        return timedelta(
            days=int(getattr(settings, "MEMBER_ACCESS_TOKEN_TTL_DAYS", 30))
        )

    def token_is_current(self, issued_at, now=None):
        """True si el token (por su fecha de emisión) está dentro del TTL."""
        now = now or timezone.now()
        if issued_at is None:
            return False
        return now - issued_at < self._get_token_ttl()

    def rotate_access_token(self, now=None):
        """Emite un token nuevo y conserva el anterior una generación."""
        now = now or timezone.now()
        self.access_token_previous = self.access_token
        self.access_token = secrets.token_urlsafe(32)
        self.access_token_issued_at = now
        self.save(update_fields=[
            "access_token",
            "access_token_previous",
            "access_token_issued_at",
        ])

    def maybe_rotate_access_token(self, now=None):
        """Rota si el token es legacy (sin fecha) o venció su TTL.

        Devuelve el token vigente resultante (nuevo si rotó). No rotar de
        nuevo si ya se rotó en esta request (guarda contra double-read).
        """
        now = now or timezone.now()
        if self.token_is_current(self.access_token_issued_at, now=now):
            return self.access_token

        self.rotate_access_token(now=now)
        return self.access_token

    def __str__(self):
        return (
            f"{self.first_name} "
            f"{self.last_name}"
        )


def resolve_public_portal_member(token):
    """Resuelve un socio por su token de portal, aceptando también el de la
    generación anterior (para no romper URLs ya compartidas al rotar).

    Fuente única para los endpoints del portal del socio. Los endpoints que
    exigen el "token vigente" (adjuntos, foto, checkins) resuelven solo por
    ``access_token`` y quedan invalidados al rotar.
    """
    if not token:
        return None
    return (
        Member.objects
        .filter(
            models.Q(access_token=token) |
            models.Q(access_token_previous=token)
        )
        .first()
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