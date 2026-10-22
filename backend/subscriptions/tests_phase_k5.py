"""Fase K5 — DIN-17: el total de una suscripción sale sólo de sus ítems.

`calculate_subscription_total` se armaba con los snapshots de precio de los
`SubscriptionItem` y, si a la suscripción le faltaba el ítem de plan, caía en
un fallback que le sumaba el **precio vigente** del plan. Ese fallback:

- inventaba un precio que el socio nunca contrató (un período de 2025
  facturado al precio de hoy);
- dejaba al período con saldo pendiente y en contradicción con el flag
  `paid` (invariante I3 del arnés de dinero);
- metía al gym en la lista de deudores por períodos vencidos que nadie le
  iba a cobrar (deuda fantasma).

Con el fix, el total es lo que dicen los ítems y, si falta el de plan, el
hueco se reporta en el log. La migración `0024_backfill_missing_plan_items`
crea el ítem que falta en las filas legacy con el snapshot de **lo cobrado**
(cero en las 65 filas que nunca tuvieron un pago), que es lo que deja el
total y el flag `paid` de acuerdo.

Sobre los datos reales (medido en staging y en producción, read-only):

- 65 suscripciones sin ítem de plan, todas `origin="onboarding"`, todas
  vencidas, sin ningún pago y sin ítems de ningún tipo;
- 32 con `paid=False` y 33 con `paid=True`;
- antes del fix: 65 violaciones de I1 y 33 de I3 (98 en total);
- después del fix y de la migración: 0 violaciones de I1 y 0 de I3.
"""

from datetime import date
from decimal import Decimal
from importlib import import_module

from core.testing import BaseAPITest
from payments.models import Payment
from subscriptions import services
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import (
    calculate_subscription_total,
    gym_outstanding_subscriptions,
    member_total_outstanding_debt,
    subscription_remaining_balance,
)


MIGRATION_0024 = import_module(
    "subscriptions.migrations.0024_backfill_missing_plan_items"
)

PLAN_PRICE = Decimal("5000.00")
LIVE_PRICE = Decimal("9000.00")


class Din17TotalSinFallbackTests(BaseAPITest):
    """El total se arma con los ítems, nunca con el precio vivo del plan."""

    def setUp(self):
        super().setUp()
        # El reporte de "falta el ítem de plan" es por proceso: se limpia
        # para que cada test pueda assertar el log.
        services._MISSING_PLAN_ITEM_REPORTED.clear()

        self.gym = self.create_gym(name="Gym DIN-17")
        self.plan = self.create_plan(self.gym, price=PLAN_PRICE)
        self.member = self.create_member(self.gym, phone="11-din17-ana")

    def _legacy_subscription(self, *, paid=False, price=None):
        """Subscription without any item, as the rows created before the backfill."""
        plan = self.plan
        if price is not None:
            plan.price = price
            plan.save(update_fields=["price"])
        return Subscription.objects.create(
            gym=self.gym,
            member=self.member,
            plan=plan,
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 31),
            paid=paid,
            origin="onboarding",
        )

    def test_el_total_no_cambia_al_actualizar_el_precio_del_plan(self):
        subscription = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
        )

        self.plan.price = LIVE_PRICE
        self.plan.save(update_fields=["price"])
        subscription.refresh_from_db()

        self.assertEqual(calculate_subscription_total(subscription), PLAN_PRICE)

    def test_sin_item_de_plan_el_total_es_cero_y_no_usa_el_precio_vivo(self):
        subscription = self._legacy_subscription(price=LIVE_PRICE)

        self.assertEqual(calculate_subscription_total(subscription), Decimal("0.00"))

    def test_el_item_de_plan_faltante_se_reporta_en_el_log(self):
        subscription = self._legacy_subscription()

        with self.assertLogs("subscriptions.services", level="ERROR") as logs:
            calculate_subscription_total(subscription)

        self.assertTrue(
            any(str(subscription.pk) in line for line in logs.output),
            f"No se reportó la suscripción {subscription.pk}: {logs.output}",
        )

    def test_la_deuda_fantasma_del_periodo_vencido_desaparece(self):
        subscription = self._legacy_subscription(price=LIVE_PRICE)

        self.assertNotIn(
            subscription,
            list(gym_outstanding_subscriptions(self.gym)),
        )
        self.assertEqual(
            member_total_outstanding_debt(self.member)["total"],
            Decimal("0.00"),
        )

    def test_un_periodo_con_pago_no_genera_sobrepago_sin_el_fallback(self):
        """Sin ítem de plan, un pago hecho queda como sobrepago.

        Por eso la migración va en el mismo commit: crea el ítem con el
        snapshot de lo cobrado y el pago vuelve a estar respaldado por el
        período (ver ``Din17MigracionBackfillTests``).
        """
        subscription = self._legacy_subscription(price=LIVE_PRICE)
        Payment.objects.create(
            gym=self.gym,
            member=self.member,
            subscription=subscription,
            amount=LIVE_PRICE,
            payment_method="cash",
            member_name=str(self.member),
            plan_name=self.plan.name,
        )

        balance = subscription_remaining_balance(subscription)

        self.assertEqual(balance["total"], Decimal("0.00"))
        self.assertEqual(balance["overpayment"], LIVE_PRICE)


class Din17MigracionBackfillTests(BaseAPITest):
    """La migración crea el ítem de plan que falta, con lo cobrado."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym(name="Gym DIN-17 Migracion")
        self.plan = self.create_plan(self.gym, price=PLAN_PRICE)
        self.member = self.create_member(self.gym, phone="11-din17-mig")

    def _run_migration(self):
        from django.apps import apps as django_apps

        MIGRATION_0024.backfill_missing_plan_items(django_apps, None)

    def _legacy_subscription(self, *, paid=False):
        return Subscription.objects.create(
            gym=self.gym,
            member=self.member,
            plan=self.plan,
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 31),
            paid=paid,
            origin="onboarding",
        )

    def test_crea_el_item_de_plan_con_snapshot_en_cero(self):
        subscription = self._legacy_subscription(paid=True)

        self._run_migration()

        item = SubscriptionItem.objects.get(subscription=subscription)
        self.assertEqual(item.item_type, "plan")
        self.assertEqual(item.status, "active")
        self.assertEqual(item.price_snapshot, Decimal("0.00"))
        self.assertEqual(item.plan, self.plan)
        self.assertEqual(item.start_date, subscription.start_date)
        self.assertEqual(item.end_date, subscription.end_date)

    def test_el_snapshot_es_lo_cobrado_y_no_el_precio_del_plan(self):
        subscription = self._legacy_subscription()
        Payment.objects.create(
            gym=self.gym,
            member=self.member,
            subscription=subscription,
            amount=Decimal("3000.00"),
            payment_method="cash",
            member_name=str(self.member),
            plan_name=self.plan.name,
        )

        self._run_migration()

        item = SubscriptionItem.objects.get(subscription=subscription)
        self.assertEqual(item.price_snapshot, Decimal("3000.00"))

    def test_normaliza_el_flag_paid(self):
        subscription = self._legacy_subscription(paid=False)

        self._run_migration()

        subscription.refresh_from_db()
        self.assertTrue(subscription.paid)

    def test_no_pisa_un_item_que_ya_existe(self):
        subscription = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
        )

        self._run_migration()

        items = SubscriptionItem.objects.filter(subscription=subscription)
        self.assertEqual(items.count(), 1)
        self.assertEqual(items.get().price_snapshot, PLAN_PRICE)

    def test_el_pago_de_un_periodo_legacy_queda_respaldado(self):
        """Con el ítem de snapshot 0 y un pago, el sobrepago se evita."""
        subscription = self._legacy_subscription()
        Payment.objects.create(
            gym=self.gym,
            member=self.member,
            subscription=subscription,
            amount=Decimal("3000.00"),
            payment_method="cash",
            member_name=str(self.member),
            plan_name=self.plan.name,
        )

        self._run_migration()
        subscription.refresh_from_db()

        balance = subscription_remaining_balance(subscription)
        self.assertEqual(balance["total"], Decimal("3000.00"))
        self.assertEqual(balance["remaining"], Decimal("0.00"))
        self.assertEqual(balance["overpayment"], Decimal("0.00"))

    def test_el_total_tras_la_migracion_es_el_cobrado(self):
        subscription = self._legacy_subscription(paid=False)

        self._run_migration()
        subscription.refresh_from_db()

        self.assertEqual(calculate_subscription_total(subscription), Decimal("0.00"))
        self.assertEqual(
            subscription_remaining_balance(subscription)["remaining"],
            Decimal("0.00"),
        )
