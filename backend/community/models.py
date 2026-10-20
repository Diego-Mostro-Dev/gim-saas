from django.db import models
from django.db.models import Q

from gyms.models import Gym


class CommunityBusiness(models.Model):
    """Local adherido al programa de descuentos del gimnasio.

    Es un dato informativo: el socio muestra su tarjeta de comunidad (QR)
    en el local y accede al beneficio indicado en ``discount``.
    """

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="community_businesses",
        verbose_name="Gimnasio",
    )
    name = models.CharField(max_length=120, verbose_name="Nombre del local")
    category = models.CharField(
        max_length=60,
        blank=True,
        verbose_name="Categoría / tipo",
    )
    address = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Dirección",
    )
    contact = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Contacto (teléfono / WhatsApp)",
    )
    discount = models.CharField(
        max_length=120,
        verbose_name="Descuento / beneficio",
        help_text="Texto libre, ej: 10% de descuento, 2x1, $500.",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Descripción / condiciones",
    )
    active = models.BooleanField(
        default=True,
        verbose_name="Activo",
    )

    class Meta:
        verbose_name = "Local adherido"
        verbose_name_plural = "Locales adheridos"
        ordering = ["gym", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["gym", "name"],
                condition=Q(active=True),
                name="uniq_community_business_name_per_gym",
            ),
        ]

    def delete(self, *args, **kwargs):
        """COM-04: baja lógica; la fila se conserva para no perder histórico."""
        self.active = False
        self.save(update_fields=["active"])

    def __str__(self):
        return self.name