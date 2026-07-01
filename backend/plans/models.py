from django.db import models
from gyms.models import Gym


class Service(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="services",
        verbose_name="Gimnasio",
    )
    name = models.CharField(max_length=100, verbose_name="Nombre")
    slug = models.SlugField(max_length=100, verbose_name="Slug")
    description = models.TextField(blank=True, verbose_name="Descripción")
    active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Fecha de actualización")

    class Meta:
        verbose_name = "Servicio"
        verbose_name_plural = "Servicios"
        unique_together = ("gym", "slug")

    def __str__(self):
        return f"{self.name} ({self.gym.name})"

    @classmethod
    def get_default_for_gym(cls, gym):
        service, _ = cls.objects.get_or_create(
            gym=gym,
            slug="gym",
            defaults={
                "name": "Gimnasio",
                "description": "Acceso al gimnasio",
                "active": True,
            },
        )
        return service


class MembershipPlan(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="plans",
        verbose_name="Gimnasio",
    )

    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="plans",
        verbose_name="Servicio",
    )

    name = models.CharField(max_length=100, verbose_name="Nombre del plan")
    description = models.TextField(blank=True, verbose_name="Descripción")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Precio")
    duration_days = models.IntegerField(verbose_name="Duración (días)")
    weekly_visits = models.PositiveIntegerField(null=True, blank=True, verbose_name="Visitas semanales")
    active = models.BooleanField(default=True, verbose_name="Activo")

    class Meta:
        verbose_name = "Plan"
        verbose_name_plural = "Planes"
        unique_together = ("gym", "name")

    def __str__(self):
        return self.name