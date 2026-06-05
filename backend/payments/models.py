from django.db import models

from gyms.models import Gym
from subscriptions.models import Subscription


class Payment(models.Model):

    PAYMENT_METHODS = [
        ("cash", "Cash"),
        ("transfer", "Transfer"),
        ("card", "Card"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="payments",
    )

    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.CASCADE,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        default="cash",
    )

    notes = models.TextField(
        blank=True,
        default="",
    )

    paid_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            f"{self.subscription.member} - "
            f"${self.amount}"
        )
    