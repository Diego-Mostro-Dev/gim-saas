from django.db import models
from gyms.models import Gym
from members.models import Member
from subscriptions.models import Subscription


class Payment(models.Model):
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    gym = models.ForeignKey(
    Gym,
    on_delete=models.CASCADE,
    null=True,
    blank=True,
    related_name="payments",
)
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    payment_method = models.CharField(
        max_length=50,
    )

    paid_at = models.DateTimeField(
        auto_now_add=True,
    )

    notes = models.TextField(
        blank=True,
    )

    def __str__(self):
        return f"{self.member} - ${self.amount}"