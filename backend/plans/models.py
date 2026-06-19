from django.db import models
from gyms.models import Gym


class MembershipPlan(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="plans",
        verbose_name="Gimnasio",
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