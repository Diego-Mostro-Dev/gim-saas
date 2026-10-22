"""Fase K5 · DIN-17: crea el ítem de plan que falta en las suscripciones legacy.

Las suscripciones abiertas antes del backfill de ``SubscriptionItem`` no
tienen snapshot de precio, y ``calculate_subscription_total`` caía en un
fallback que les sumaba el precio **vigente** del plan: el período mostraba
un precio que nadie contrató (y, con el flag ``paid`` en False, una deuda
fantasma que el gym tenía que perseguir).

El snapshot que se graba es lo realmente cobrado por el período -- cero en
las filas legacy, que no registran ningún pago --, de modo que el total
diga lo que se facturó de verdad y el precio vivo del plan no se cuele en
un período cerrado. Con el total en cero, el saldo queda en cero y el flag
``paid`` se normaliza a True para que coincida con el saldo recalculado
(invariante I3).
"""

from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def backfill_missing_plan_items(apps, schema_editor):
    Subscription = apps.get_model("subscriptions", "Subscription")
    SubscriptionItem = apps.get_model("subscriptions", "SubscriptionItem")
    Payment = apps.get_model("payments", "Payment")

    subscriptions_with_item = SubscriptionItem.objects.filter(
        item_type="plan",
        status="active",
    ).values("subscription_id")

    legacy = (
        Subscription.objects.exclude(pk__in=subscriptions_with_item)
        .select_related("plan")
        .order_by("pk")
    )

    created = 0
    with_payments = 0

    for subscription in legacy.iterator():
        paid_amount = (
            Payment.objects.filter(subscription_id=subscription.pk)
            .exclude(concept="credit")
            .aggregate(paid=Sum("amount"))["paid"]
            or Decimal("0")
        )

        SubscriptionItem.objects.create(
            subscription_id=subscription.pk,
            item_type="plan",
            plan_id=subscription.plan_id,
            status="active",
            name_snapshot=subscription.plan.name,
            price_snapshot=paid_amount,
            start_date=subscription.start_date,
            end_date=subscription.end_date,
        )

        # El período pasa a facturar lo cobrado: no queda saldo pendiente.
        if not subscription.paid:
            Subscription.objects.filter(pk=subscription.pk).update(paid=True)

        if paid_amount > 0:
            with_payments += 1

        created += 1

    if created:
        print(
            f"K5 · DIN-17: se creó el ítem de plan faltante en {created} "
            f"suscripciones ({with_payments} con pagos registrados)."
        )


def noop_reverse(apps, schema_editor):
    """El backfill no se revierte.

    Los ítems creados son indistinguibles de los normales (mismo plan, mismo
    snapshot) y borrarlos dejaría esas suscripciones sin precio contractual.
    """


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0014_alter_payment_subscription"),
        ("subscriptions", "0023_subscription_prorated"),
    ]

    operations = [
        migrations.RunPython(backfill_missing_plan_items, noop_reverse),
    ]
