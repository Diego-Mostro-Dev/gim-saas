from django.db import models

from gyms.models import Gym
from subscriptions.models import Subscription
from members.models import Member


class Payment(models.Model):

    PAYMENT_METHODS = [
        ("cash", "Efectivo"),
        ("transfer", "Transferencia"),
        ("card", "Tarjeta"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="payments",
        verbose_name="Gimnasio",
    )

    subscription = models.ForeignKey(
    Subscription,
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="payments",
    verbose_name="Suscripción",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
        verbose_name="Miembro",
    )

    member_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Nombre del miembro",
    )

    plan_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Nombre del plan",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Monto",
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        default="cash",
        verbose_name="Método de pago",
    )

    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notas",
    )

    paid_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Fecha de pago",
    )

    subscription_end_date = models.DateField(
    null=True,
    blank=True,
    verbose_name="Fecha de vencimiento de suscripción",
)

    class Meta:
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"

    def __str__(self):
        return (
            f"{self.member_name} - "
            f"${self.amount}"
        )