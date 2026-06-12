from django.db import models
from gyms.models import Gym


class MembershipPlan(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="plans",
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.IntegerField()
    weekly_visits = models.PositiveIntegerField(null=True, blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("gym", "name")

    def __str__(self):
        return self.name