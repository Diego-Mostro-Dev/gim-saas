from django.db import models

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

    class Meta:
        verbose_name = "Local adherido"
        verbose_name_plural = "Locales adheridos"
        ordering = ["gym", "name"]

    def __str__(self):
        return self.name