"""Tests focalizados de bugs de dinero (Fase 6 de PLAN-dinero.md).

Cada caso reproduce el escenario descrito en el plan y fija el
comportamiento en los puntos de escritura (renovación automática,
recuperación, cambio de plan, claim concurrente) usando los helpers de
``core.testing``.

Se ejecutan contra SQLite (ver el comando en PLAN-dinero.md), no contra la
base de staging.
"""

import threading
from datetime import date, time as _time
from decimal import Decimal
from unittest import mock

from django.conf import settings
from django.db import connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from activities.models import Activity
from core.testing import BaseAPITest
from payments.models import Payment
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import (
    PlanChangeRequest,
    Subscription,
    SubscriptionItem,
    TaskRun,
)
from subscriptions.services import (
    TASK_NAME,
    _task_interval_seconds,
    auto_renew_subscriptions,
    calculate_subscription_total,
    create_next_subscription,
    get_last_day_of_month,
    recover_member,
    run_scheduled_tasks,
    subscription_remaining_balance,
)


class _MoneyBugBase(BaseAPITest):
    """Fixtures compartidos: períodos relativos a hoy y suscripciones."""

    def _periods(self):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        prev_start, prev_end = self.last_month_period()
        prev2_end = prev_start - timezone.timedelta(days=1)
        return {
            "today": today,
            "month_start": month_start,
            "target_end": get_last_day_of_month(month_start),
            "prev_start": prev_start,
            "prev_end": prev_end,
            "prev2_start": prev2_end.replace(day=1),
            "prev2_end": prev2_end,
        }

    def _settled_sub(self, member, plan, start, end, auto_renew=True):
        sub = self.open_month_subscription(
            member,
            plan,
            start_date=start,
            end_date=end,
            paid=True,
            auto_renew=auto_renew,
        )
        self.settle_subscription(sub)
        return sub

    def _raw_settled_sub(self, member, plan, start, end):
        """Sub creada directo (sin el guard de solapamiento de open_subscription).

        Reproduce filas superpuestas como las que viven hoy en staging y que
        el renovador debe tolerar: sin ítems, el total cae al precio del plan.
        """
        sub = Subscription.objects.create(
            gym=member.gym,
            member=member,
            plan=plan,
            start_date=start,
            end_date=end,
            paid=True,
            auto_renew=True,
        )
        Payment.objects.create(
            gym=member.gym,
            member=member,
            subscription=sub,
            amount=plan.price,
            payment_method="cash",
            member_name=str(member),
            plan_name=plan.name,
        )
        return sub


class MoneyBugRenewalTests(_MoneyBugBase):
    """Bugs #1 (H1), #19 y los guards de pago en la renovación."""

    def test_h1_successor_on_old_period_does_not_mask_missing_new_period(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        self._settled_sub(member, plan, p["prev2_start"], p["prev2_end"])
        self._settled_sub(member, plan, p["prev_start"], p["prev_end"])

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 1)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["covered"], 1)
        self.assertEqual(result["candidates"], 1)
        self.assertEqual(result["skipped_already"], 1)

        new_subs = Subscription.objects.filter(
            member=member, start_date=p["month_start"]
        )
        self.assertEqual(new_subs.count(), 1)
        new_sub = new_subs.first()
        self.assertEqual(new_sub.origin, "auto_renewal")
        self.assertEqual(new_sub.plan, plan)

        old_sub = Subscription.objects.get(
            member=member, start_date=p["prev2_start"]
        )
        old_sub.refresh_from_db()
        self.assertFalse(old_sub.auto_renew)

    def test_mid_month_successor_covering_target_blocks_renewal(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        mid_start = date(p["today"].year, p["today"].month, 17)
        self._settled_sub(member, plan, mid_start, p["target_end"], auto_renew=False)

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 0)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["covered"], 1)
        self.assertEqual(result["candidates"], 0)
        self.assertEqual(result["skipped_already"], 1)
        self.assertEqual(Subscription.objects.filter(member=member).count(), 2)

        sub.refresh_from_db()
        self.assertFalse(sub.auto_renew)

    def test_duplicate_candidates_same_period_create_single_subscription(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        self._raw_settled_sub(member, plan, p["prev2_start"], p["prev_end"])
        self._raw_settled_sub(member, plan, p["prev_start"], p["prev_end"])

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 1)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["candidates"], 2)
        self.assertEqual(result["skipped_already"], 1)
        self.assertEqual(
            Subscription.objects.filter(
                member=member, start_date=p["month_start"]
            ).count(),
            1,
        )

    def test_closed_month_backlog_never_creates_retroactive_subscription(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        sub = self._settled_sub(member, plan, p["prev2_start"], p["prev2_end"])

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 0)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(result["skipped_stale_backlog"], 1)
        self.assertEqual(result["candidates"], 0)
        self.assertEqual(result["skipped_already"], 1)
        self.assertEqual(Subscription.objects.filter(member=member).count(), 1)

        sub.refresh_from_db()
        self.assertFalse(sub.auto_renew)

    def test_inactive_gym_candidate_is_never_renewed(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        gym.active = False
        gym.save(update_fields=["active"])

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 0)
        self.assertEqual(result["skipped_inactive_gym"], 1)
        self.assertEqual(result["candidates"], 0)
        self.assertEqual(Subscription.objects.filter(member=member).count(), 1)

        sub.refresh_from_db()
        self.assertTrue(sub.auto_renew)

    def test_blocked_debtor_renews_after_paying(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        self._settled_sub(member, plan, p["prev2_start"], p["prev2_end"])
        debt_sub = self.open_month_subscription(
            member,
            plan,
            start_date=p["prev_start"],
            end_date=p["prev_end"],
            paid=False,
            auto_renew=True,
        )

        first = auto_renew_subscriptions()

        self.assertEqual(first["renewed"], 0)
        self.assertEqual(first["failed"], 0)
        self.assertEqual(first["covered"], 1)
        self.assertEqual(first["skipped_blocked"], 1)
        self.assertEqual(first["candidates"], 0)
        self.assertEqual(first["skipped_already"], 1)

        debt_sub.refresh_from_db()
        self.assertTrue(debt_sub.auto_renew)

        self.settle_subscription(debt_sub)

        second = auto_renew_subscriptions()

        self.assertEqual(second["renewed"], 1)
        self.assertEqual(second["skipped_blocked"], 0)
        self.assertEqual(
            Subscription.objects.filter(
                member=member, start_date=p["month_start"]
            ).count(),
            1,
        )

    def test_due_plan_change_applies_for_non_candidate(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym, price=Decimal("7000.00"))
        plan2 = self.create_plan(gym, name="Plan Dorado", price=Decimal("8000.00"))
        member = self.create_member(gym)

        self.open_month_subscription(
            member,
            plan,
            start_date=p["month_start"],
            end_date=p["target_end"],
            paid=False,
            auto_renew=True,
        )
        pcr = PlanChangeRequest.objects.create(
            gym=gym,
            member=member,
            requested_plan=plan2,
            current_schedules_snapshot=[],
            target_schedules_snapshot=[],
            status="approved",
            effective_date=p["month_start"],
        )

        result = auto_renew_subscriptions()

        self.assertEqual(result["plan_changes_applied"], 1)

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")

        sub = Subscription.objects.get(member=member, start_date=p["month_start"])
        self.assertEqual(sub.plan, plan2)
        active = sub.items.filter(item_type="plan", status="active")
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().price_snapshot, Decimal("8000.00"))


class MoneyBugRecoveryAndCompTests(_MoneyBugBase):
    """Bugs #48 y #2: socios comp y ítems faltantes de PT."""

    def test_recovery_creates_missing_pt_item(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        member.active = False
        member.save(update_fields=["active"])

        pt_service = PersonalTrainingService.objects.create(
            gym=gym,
            service=Service.get_default_for_gym(gym),
            name="PT 1 a 1",
            monthly_price=Decimal("3000.00"),
            billing_mode="monthly",
        )
        trainer = self.create_user(gym, username="trainer")
        PersonalTrainingAssignment.objects.create(
            gym=gym,
            member=member,
            trainer=trainer,
            service=pt_service,
            day="monday",
            start_time=_time(10, 0),
            end_time=_time(11, 0),
            modality="monthly",
            active=True,
        )

        new_sub = recover_member(member)

        member.refresh_from_db()
        self.assertTrue(member.active)
        self.assertEqual(new_sub.origin, "recovery")
        self.assertEqual(new_sub.start_date, timezone.localdate())

        pt_items = new_sub.items.filter(
            item_type="personal_training", status="active"
        )
        self.assertEqual(pt_items.count(), 1)
        self.assertEqual(pt_items.first().price_snapshot, Decimal("3000.00"))

        plan_item = new_sub.items.get(item_type="plan", status="active")
        self.assertEqual(plan_item.price_snapshot, Decimal("5000.00"))
        self.assertEqual(
            calculate_subscription_total(new_sub), Decimal("8000.00")
        )

    def test_comp_member_items_are_zeroed_on_write(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)
        member.is_comp = True
        member.save(update_fields=["is_comp"])

        sub = self.open_month_subscription(
            member,
            plan,
            start_date=p["month_start"],
            end_date=p["target_end"],
            paid=True,
            auto_renew=True,
        )

        plan_item = sub.items.get(item_type="plan", status="active")
        self.assertEqual(plan_item.price_snapshot, Decimal("0"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_comp_renewal_opens_zero_items(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)
        member.is_comp = True
        member.save(update_fields=["is_comp"])

        self._settled_sub(member, plan, p["prev_start"], p["prev_end"])

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 1)
        new_sub = Subscription.objects.filter(member=member).order_by(
            "-created_at"
        ).first()
        self.assertEqual(new_sub.start_date, p["month_start"])
        self.assertEqual(new_sub.origin, "auto_renewal")
        self.assertTrue(new_sub.paid)

        plan_item = new_sub.items.get(item_type="plan", status="active")
        self.assertEqual(plan_item.price_snapshot, Decimal("0"))
        self.assertEqual(calculate_subscription_total(new_sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(new_sub)["remaining"], Decimal("0")
        )

    def test_mutating_to_comp_zeroes_paid_items(self):
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)

        sub = self.open_month_subscription(
            member,
            plan,
            start_date=p["month_start"],
            end_date=p["target_end"],
            paid=False,
            auto_renew=True,
        )
        self.assertNotEqual(calculate_subscription_total(sub), Decimal("0"))

        # El pase se da el 1º, así que no hay días ya servidos que facturar y los
        # ítems del período quedan en 0 (Fase 7.1, P3). Una transición a mitad
        # de mes factura lo ya servido: eso va en CourtesyPassProrationTests, y
        # acá la fecha se congela para que el caso no dependa del día en que
        # corra la suite.
        with mock.patch(
            "django.utils.timezone.localdate", return_value=p["month_start"]
        ):
            SubscriptionDomain.mutate_membership(
                member=member, comp=True, origin="plan_change"
            )
        member.is_comp = True
        member.save(update_fields=["is_comp"])

        sub.refresh_from_db()
        self.assertTrue(sub.auto_renew)

        plan_item = sub.items.get(item_type="plan", status="active")
        self.assertEqual(plan_item.price_snapshot, Decimal("0"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )


class CourtesyPassToggleOrderTests(_MoneyBugBase):
    """Fase 7.1 (P2): ``is_comp`` se persiste antes de ``mutate_membership``.

    ``_item_price`` y ``subscription_remaining_balance`` leen ``member.is_comp``,
    así que con el orden anterior (persistir el flag después del dominio) el
    período se escribía con el valor viejo. El bug sólo se vinha manifesting
    **sin suscripción vigente**: con una vigente el dominio reescribe los
    precios a mano y lo tapa.

    Los tres casos van por el endpoint de staff, que es donde vive el toggle, y
    ninguno asserta sobre ``paid``: el flag es derivado y es justo lo que queda
    viejo.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.paid_plan = self.create_plan(self.gym)
        self.pt_price = Decimal("22000.00")
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="PT 1 a 1",
            monthly_price=self.pt_price,
            billing_mode="monthly",
        )
        self.trainer = self.create_user(self.gym, username="trainer")

    def _member_with_monthly_pt(self, is_comp=False):
        """Socio con PT mensual activa y **sin** suscripción vigente."""
        member = self.create_member(self.gym)
        PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=member,
            trainer=self.trainer,
            service=self.pt_service,
            day="monday",
            start_time=_time(10, 0),
            end_time=_time(11, 0),
            modality="monthly",
            active=True,
        )
        if is_comp:
            member.is_comp = True
            member.save(update_fields=["is_comp"])
        return member

    def _toggle(self, member, **payload):
        return self.client.patch(
            f"/api/members/{member.id}/",
            payload,
            format="json",
        )

    def _snapshot(self, member, item_type):
        sub = SubscriptionDomain.get_current_subscription(member)
        return sub.items.get(item_type=item_type, status="active").price_snapshot

    def test_granting_comp_writes_zero_items_without_current_subscription(self):
        member = self._member_with_monthly_pt()

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)

        sub = SubscriptionDomain.get_current_subscription(member)
        self.assertIsNotNone(sub)
        self.assertEqual(self._snapshot(member, "plan"), Decimal("0"))
        self.assertEqual(self._snapshot(member, "personal_training"), Decimal("0"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_removing_comp_writes_real_prices_without_current_subscription(self):
        member = self._member_with_monthly_pt(is_comp=True)

        resp = self._toggle(member, is_comp=False, plan_id=self.paid_plan.id)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertFalse(member.is_comp)

        sub = SubscriptionDomain.get_current_subscription(member)
        self.assertEqual(sub.plan, self.paid_plan)
        self.assertEqual(self._snapshot(member, "plan"), self.paid_plan.price)
        self.assertEqual(
            self._snapshot(member, "personal_training"), self.pt_price
        )

        expected = self.paid_plan.price + self.pt_price
        self.assertEqual(calculate_subscription_total(sub), expected)
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], expected
        )

    def test_failed_comp_off_does_not_persist_flag(self):
        """Sin plan elegido el dominio revienta: el flag tampoco se persiste."""
        member = self._member_with_monthly_pt(is_comp=True)

        resp = self._toggle(member, is_comp=False)

        self.assertEqual(resp.status_code, 400)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)
        self.assertFalse(Subscription.objects.filter(member=member).exists())


class CourtesyPassProrationTests(_MoneyBugBase):
    """Fase 7.1 (P3): el período en curso se factura por días, en las dos
    direcciones.

    El día de la transición cuenta a favor del estado nuevo: al quitar el pase
    el 20 de un mes de 30 se factura 20→30 (11 días) y al darlo se factura 1→19
    (19 días). El denominador es la duración real del período.

    Los montos están elegidos para que el prorrateo caiga exacto: plan $30.000
    + actividad $3.000 + PT $6.000 = $39.000, que da $14.300 con 11/30 y
    $24.700 con 19/30. Sin PT el total es $33.000 → $12.100 / $20.900.
    """

    TRANSITION_DAY = date(2026, 9, 20)
    PERIOD_START = date(2026, 9, 1)
    PERIOD_END = date(2026, 9, 30)
    PLAN_PRICE = Decimal("30000.00")
    ACTIVITY_PRICE = Decimal("3000.00")
    PT_PRICE = Decimal("6000.00")

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.plan = self.create_plan(self.gym, price=self.PLAN_PRICE)
        self.activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            monthly_price=self.ACTIVITY_PRICE,
            billing_mode="monthly",
        )
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="PT mensual",
            monthly_price=self.PT_PRICE,
            billing_mode="monthly",
        )

    def _member_with_september(self, comp_from_start, settle=False, with_pt=False):
        """Socio con la suscripción de septiembre abierta.

        ``comp_from_start`` refleja el estado real del socio desde el 1º:
        cortesía (``is_comp`` e ítems en 0) o pagando (ítems a precio de
        contrato). ``with_pt`` agrega el ítem de PT mensual al período.
        """
        member = self.create_member(self.gym)
        sub = self.open_month_subscription(
            member,
            self.plan,
            start_date=self.PERIOD_START,
            end_date=self.PERIOD_END,
            paid=False,
            auto_renew=True,
        )
        if comp_from_start:
            member.is_comp = True
            member.save(update_fields=["is_comp"])
        snapshot = Decimal("0") if comp_from_start else self.PLAN_PRICE
        sub.items.filter(item_type="plan").update(price_snapshot=snapshot)
        activity_snapshot = (
            Decimal("0") if comp_from_start else self.ACTIVITY_PRICE
        )
        SubscriptionItem.objects.create(
            subscription=sub,
            item_type="activity",
            plan=None,
            activity=self.activity,
            status="active",
            name_snapshot=self.activity.name,
            price_snapshot=activity_snapshot,
            start_date=self.PERIOD_START,
            end_date=self.PERIOD_END,
        )
        if with_pt:
            pt_snapshot = Decimal("0") if comp_from_start else self.PT_PRICE
            SubscriptionItem.objects.create(
                subscription=sub,
                item_type="personal_training",
                plan=None,
                personal_training=self.pt_service,
                status="active",
                name_snapshot=self.pt_service.name,
                price_snapshot=pt_snapshot,
                start_date=self.PERIOD_START,
                end_date=self.PERIOD_END,
            )
        if settle:
            self.settle_subscription(sub)
        return member, sub

    def _toggle(self, member, **payload):
        with mock.patch(
            "django.utils.timezone.localdate",
            return_value=self.TRANSITION_DAY,
        ):
            return self.client.patch(
                f"/api/members/{member.id}/",
                payload,
                format="json",
            )

    def _snapshot(self, subscription, item_type):
        return subscription.items.get(
            item_type=item_type, status="active"
        ).price_snapshot

    def test_removing_comp_on_day_20_bills_remaining_11_of_30(self):
        member, sub = self._member_with_september(True)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertFalse(member.is_comp)

        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("11000.00"))
        self.assertEqual(self._snapshot(sub, "activity"), Decimal("1100.00"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("12100.00"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("12100.00")
        )

    def test_granting_comp_on_day_20_bills_served_19_of_30(self):
        member, sub = self._member_with_september(False, settle=True)

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)

        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("19000.00"))
        self.assertEqual(self._snapshot(sub, "activity"), Decimal("1900.00"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("20900.00"))
        # El socio pagó el mes entero y el total bajó: quedó un excedente de
        # $12.100. ``subscription_remaining_balance`` lo fuerza a 0 para un
        # cortesía, así que el sobrepago no se ve hasta que 7.3 lo convierta
        # en crédito. No se asserta acá a propósito: es el bug de P4.
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_removing_comp_on_day_20_restores_pt_with_11_of_30(self):
        member, sub = self._member_with_september(True, with_pt=True)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertFalse(member.is_comp)

        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("11000.00"))
        self.assertEqual(self._snapshot(sub, "activity"), Decimal("1100.00"))
        self.assertEqual(self._snapshot(sub, "personal_training"), Decimal("2200.00"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("14300.00"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("14300.00")
        )

    def test_granting_comp_on_day_20_bills_served_19_of_30_with_pt(self):
        member, sub = self._member_with_september(False, settle=True, with_pt=True)

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)

        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("19000.00"))
        self.assertEqual(self._snapshot(sub, "activity"), Decimal("1900.00"))
        self.assertEqual(self._snapshot(sub, "personal_training"), Decimal("3800.00"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("24700.00"))
        # El socio pagó el mes entero ($39.000) y el total prorrateado bajó a
        # $24.700: queda un excedente de $14.300 que la rama ``is_comp`` de
        # subscription_remaining_balance fuerza a 0 (P4, hasta 7.3).
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )


class MoneyBugPTPackageFeeTests(_MoneyBugBase):
    """Fase 7 (#2, P1): el PT por paquete no genera cuota mensual.

    El bug tenía dos caminos de escritura, y por eso los casos vienen de a
    dos: corregir sólo el alta deja el cobro vivo en cada renovación, que es
    donde más plata se pierde.
    """

    def _pt_setup(self, gym, modality, monthly_price="22000", billing_mode="sessions"):
        plan = self.create_plan(gym)
        member = self.create_member(gym)
        pt_service = PersonalTrainingService.objects.create(
            gym=gym,
            service=Service.get_default_for_gym(gym),
            name="PT 1 a 1",
            monthly_price=Decimal(monthly_price),
            billing_mode=billing_mode,
        )
        trainer = self.create_user(gym, username="trainer")
        assignment = PersonalTrainingAssignment.objects.create(
            gym=gym,
            member=member,
            trainer=trainer,
            service=pt_service,
            day="monday",
            start_time=_time(10, 0),
            end_time=_time(11, 0),
            modality=modality,
            active=True,
        )
        if modality == "package":
            assignment.package_total_sessions = 10
            assignment.session_price = Decimal("8000")
            assignment.save(
                update_fields=["package_total_sessions", "session_price"]
            )
        return plan, member, pt_service

    def _pt_item(self, subscription):
        return subscription.items.filter(
            item_type="personal_training", status="active"
        )

    def test_package_assignment_adds_no_monthly_fee_on_open(self):
        """Vía 1 (alta): la suscripción nueva no trae cuota de PT."""
        p = self._periods()
        gym = self.create_gym()
        plan, member, _ = self._pt_setup(gym, "package")

        sub = self.open_month_subscription(
            member, plan, start_date=p["month_start"], end_date=p["target_end"]
        )

        self.assertEqual(self._pt_item(sub).count(), 0)
        self.assertEqual(calculate_subscription_total(sub), plan.price)

    def test_package_fee_not_copied_into_next_period(self):
        """Vía 2 (copia): el período anterior ya tenía el ítem y no se renueva.

        Es el caso que falla si sólo se arregla el alta: el socio que ya
        tenía el ítem mal creado lo arrastraba a todos los períodos futuros.
        """
        p = self._periods()
        gym = self.create_gym()
        plan, member, pt_service = self._pt_setup(gym, "package")

        prev_sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        SubscriptionItem.objects.create(
            subscription=prev_sub,
            item_type="personal_training",
            plan=None,
            personal_training=pt_service,
            status="active",
            name_snapshot=pt_service.name,
            price_snapshot=Decimal("22000.00"),
            start_date=prev_sub.start_date,
            end_date=prev_sub.end_date,
        )
        self.settle_subscription(prev_sub)

        new_sub = create_next_subscription(prev_sub)

        self.assertEqual(self._pt_item(new_sub).count(), 0)
        self.assertEqual(calculate_subscription_total(new_sub), plan.price)

    def test_package_fee_dropped_on_autorenewal(self):
        """La renovación automática es el camino que más plata perdía."""
        p = self._periods()
        gym = self.create_gym()
        plan, member, pt_service = self._pt_setup(gym, "package")

        prev_sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        SubscriptionItem.objects.create(
            subscription=prev_sub,
            item_type="personal_training",
            plan=None,
            personal_training=pt_service,
            status="active",
            name_snapshot=pt_service.name,
            price_snapshot=Decimal("22000.00"),
            start_date=prev_sub.start_date,
            end_date=prev_sub.end_date,
        )
        self.settle_subscription(prev_sub)

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 1)
        new_sub = Subscription.objects.get(
            member=member, start_date=p["month_start"]
        )
        self.assertEqual(self._pt_item(new_sub).count(), 0)
        self.assertEqual(calculate_subscription_total(new_sub), plan.price)

    def test_monthly_assignment_still_billed_on_open(self):
        """Control positivo del alta: la modalidad mensual no se toca."""
        p = self._periods()
        gym = self.create_gym()
        plan, member, _ = self._pt_setup(
            gym, "monthly", monthly_price="22000", billing_mode="monthly"
        )

        sub = self.open_month_subscription(
            member, plan, start_date=p["month_start"], end_date=p["target_end"]
        )

        self.assertEqual(self._pt_item(sub).count(), 1)
        self.assertEqual(
            calculate_subscription_total(sub), plan.price + Decimal("22000.00")
        )

    def test_monthly_assignment_still_copied_into_next_period(self):
        """Control positivo de la copia: la modalidad mensual se renueva."""
        p = self._periods()
        gym = self.create_gym()
        plan, member, _ = self._pt_setup(
            gym, "monthly", monthly_price="22000", billing_mode="monthly"
        )

        prev_sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        self.assertEqual(self._pt_item(prev_sub).count(), 1)

        new_sub = create_next_subscription(prev_sub)

        self.assertEqual(self._pt_item(new_sub).count(), 1)
        self.assertEqual(
            self._pt_item(new_sub).first().price_snapshot, Decimal("22000.00")
        )
        self.assertEqual(
            calculate_subscription_total(new_sub), plan.price + Decimal("22000.00")
        )

    def test_two_services_one_package_one_monthly(self):
        """La regla es por oferta, no por socio: conviven sin mezclarse."""
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)
        trainer = self.create_user(gym, username="trainer")
        for name, modality, mode, day, start in (
            ("PT paquete", "package", "sessions", "monday", (10, 0)),
            ("PT mensual", "monthly", "monthly", "tuesday", (12, 0)),
        ):
            service = PersonalTrainingService.objects.create(
                gym=gym,
                service=Service.get_default_for_gym(gym),
                name=name,
                monthly_price=Decimal("22000" if mode == "monthly" else "0"),
                billing_mode=mode,
            )
            PersonalTrainingAssignment.objects.create(
                gym=gym,
                member=member,
                trainer=trainer,
                service=service,
                day=day,
                start_time=_time(*start),
                end_time=_time(start[0] + 1, start[1]),
                modality=modality,
                active=True,
            )

        sub = self.open_month_subscription(
            member, plan, start_date=p["month_start"], end_date=p["target_end"]
        )

        self.assertEqual(
            [i.personal_training.name for i in self._pt_item(sub)], ["PT mensual"]
        )
        self.assertEqual(
            calculate_subscription_total(sub), plan.price + Decimal("22000.00")
        )

    def test_inactive_assignment_does_not_resurrect_fee(self):
        """Sin asignación activa no hay cuota, aunque el período previo la tenga."""
        p = self._periods()
        gym = self.create_gym()
        plan, member, _ = self._pt_setup(
            gym, "monthly", monthly_price="22000", billing_mode="monthly"
        )

        prev_sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])
        self.assertEqual(self._pt_item(prev_sub).count(), 1)
        self.settle_subscription(prev_sub)
        member.personal_training_assignments.update(active=False)

        new_sub = create_next_subscription(prev_sub)

        self.assertEqual(self._pt_item(new_sub).count(), 0)
        self.assertEqual(calculate_subscription_total(new_sub), plan.price)

    def _stale_pt_item(self, subscription, price="22000.00"):
        """Escribe el ítem de PT a mano, como lo dejaba el bug.

        Así el caso depende sólo del fix y no de que hoy ``open_subscription``
        ya no lo cree: el punto es que el período anterior tenga la línea y la
        renovación tenga que decidir si la arrastra.
        """
        service = subscription.member.personal_training_assignments.first().service
        return SubscriptionItem.objects.create(
            subscription=subscription,
            item_type="personal_training",
            plan=None,
            personal_training=service,
            status="active",
            name_snapshot=service.name,
            price_snapshot=Decimal(price),
            start_date=subscription.start_date,
            end_date=subscription.end_date,
        )


@override_settings(
    SCHEDULED_TASKS_KEY="test-key",
    SCHEDULED_TASKS_INTERVAL_SECONDS=60,
)
class ScheduledTaskClaimTests(TransactionTestCase):
    """Fase 4: el claim atómico deja entrar a una sola corrida a la vez."""

    def test_second_concurrent_worker_does_not_claim(self):
        # SQLite serializa escrituras con un busy handler: sin un timeout
        # generoso, dos UPDATEs concurrentes desde hilos distintos explotan
        # con "database is locked" en vez de esperar a la corrida oponente.
        settings.DATABASES["default"]["OPTIONS"] = {"timeout": 30}
        connections["default"].close()

        TaskRun.objects.create(
            name=TASK_NAME,
            last_run=timezone.now() - timezone.timedelta(
                seconds=_task_interval_seconds() * 2
            ),
            last_status="ok",
        )

        barrier = threading.Barrier(2)
        results = [None, None]
        errors = [None, None]

        def worker(idx):
            try:
                barrier.wait()
                results[idx] = run_scheduled_tasks()
            except Exception as exc:  # pragma: no cover - defensivo
                errors[idx] = exc

        t1 = threading.Thread(target=worker, args=(0,))
        t2 = threading.Thread(target=worker, args=(1,))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        self.assertIsNone(errors[0], errors[0])
        self.assertIsNone(errors[1], errors[1])
        self.assertEqual(sorted(r["ran"] for r in results), [False, True])

        loser = next(r for r in results if not r["ran"])
        self.assertEqual(loser["reason"], "not_due")

        run = TaskRun.objects.get(name=TASK_NAME)
        self.assertEqual(run.last_status, "ok")