from django.db import models


class MembershipPlan(models.Model):
    """A membership plan for the gym."""
    name = models.CharField(max_length=100)

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    duration_days = models.IntegerField()

    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
