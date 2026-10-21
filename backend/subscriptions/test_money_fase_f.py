"""Tests de la Fase F: suscripción y recuperación (DIN-04/05/06/10/12/15).

Cada caso reproduce el escenario de ``BUGS.md`` y fija el comportamiento en
los puntos de escritura (renovación automática, recuperación, cambio de plan,
toggle de cortesía). Se apoyan en los helpers de ``core.testing`` y en los
fixtures de ``test_money_bugs``.

Corren contra Postgres real, nunca contra SQLite ni la base de desarrollo.
"""

from decimal import Decimal
from unittest import mock

from django.db import IntegrityError
from django.utils import timezone

from core.testing import BaseAPITest
from subscriptions.domain import SubscriptionConflictError
from subscriptions.models import Subscription
from subscriptions.services import (
    auto_renew_subscriptions,
    get_last_day_of_month,
    member_credit_balance,
    recover_member,
    subscription_remaining_balance,
)


class _FaseFBase(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.plan = self.create_plan(self.gym, price=Decimal("50000.00"))

    def _settled_sub(self, member, plan, start, end, auto_renew=True):
        sub = self.open_month_subscription(
            member, plan, start_date=start, end_date=end,
            paid=True, auto_renew=auto_renew,
        )
        self.settle_subscription(sub)
        return sub

    def _prev_period(self):
        return self.last_month_period()


class RecoveryReturnValueTests(_FaseFBase):
    """DIN-12: reopen distingue Caso A (reactivación) de Caso B (recuperación)."""

    def test_recovery_returns_created_true_when_it_opens_a_period(self):
        member = self.create_member(self.gym)
        self._settled_sub(member, self.plan, *self._prev_period())
        member.active = False
        member.save(update_fields=["active"])

        sub, created = recover_member(member)

        self.assertTrue(created)
        self.assertEqual(sub.origin, "recovery")

    def test_reactivation_returns_created_false_and_the_current_sub(self):
        member = self.create_member(self.gym)
        today = timezone.localdate()
        month_end = get_last_day_of_month(today)
        current = self._settled_sub(
            member, self.plan, today, month_end
        )
        member.active = False
        member.save(update_fields=["active"])

        sub, created = recover_member(member)

        self.assertFalse(created)
        self.assertEqual(sub.pk, current.pk)

    def test_reopen_endpoint_returns_200_for_reactivation(self):
        member = self.create_member(self.gym)
        today = timezone.localdate()
        month_end = get_last_day_of_month(today)
        self._settled_sub(member, self.plan, today, month_end)
        member.active = False
        member.save(update_fields=["active"])

        resp = self.client.post(
            "/api/subscriptions/reopen/", {"member_id": member.id}, format="json"
        )

        self.assertEqual(resp.status_code, 200)

    def test_reopen_endpoint_returns_201_for_new_period(self):
        member = self.create_member(self.gym)
        self._settled_sub(member, self.plan, *self._prev_period())
        member.active = False
        member.save(update_fields=["active"])

        resp = self.client.post(
            "/api/subscriptions/reopen/", {"member_id": member.id}, format="json"
        )

        self.assertEqual(resp.status_code, 201)


class RecoveryRaceTests(_FaseFBase):
    """DIN-15: la carrera de recuperación devuelve un conflicto, no un 500."""

    def test_conflicting_recovery_raises_controlled_conflict(self):
        """Simula que la fila del período ya la creó otra petición ganadora.

        El segundo intento choca con ``unique_subscription_member_period``;
        ``recover_member`` debe traducir el ``IntegrityError`` a
        ``SubscriptionConflictError`` (400) en vez de dejarlo salir como 500.
        """
        member = self.create_member(self.gym)
        self._settled_sub(member, self.plan, *self._prev_period())
        member.active = False
        member.save(update_fields=["active"])

        original_open = Subscription.objects.create
        calls = {"n": 0}

        def create_and_conflict(*args, **kwargs):
            sub = original_open(*args, **kwargs)
            if calls["n"] == 0:
                calls["n"] += 1
                # La otra petición gana insertando el mismo período.
                raise IntegrityError("duplicate key unique_subscription_member_period")
            return sub

        with mock.patch.object(
            Subscription.objects, "create", side_effect=create_and_conflict
        ):
            with self.assertRaises(SubscriptionConflictError):
                recover_member(member)

    def test_reopen_endpoint_returns_400_not_500_on_race(self):
        member = self.create_member(self.gym)
        self._settled_sub(member, self.plan, *self._prev_period())
        member.active = False
        member.save(update_fields=["active"])

        with mock.patch(
            "subscriptions.views.recover_member",
            side_effect=SubscriptionConflictError("Ya se recuperó."),
        ):
            resp = self.client.post(
                "/api/subscriptions/reopen/", {"member_id": member.id}, format="json"
            )

        self.assertEqual(resp.status_code, 400)


class RecoverableCompTests(_FaseFBase):
    """DIN-10: badge y acción coinciden sobre si un comp es recuperable."""

    def test_comp_recoverable_member_reports_is_recoverable(self):
        member = self.create_member(self.gym)
        member.is_comp = True
        member.save(update_fields=["is_comp"])
        self._settled_sub(member, self.plan, *self._prev_period())
        member.active = False
        member.save(update_fields=["active"])

        resp = self.client.get(f"/api/members/{member.id}/")

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["is_recoverable"])

    def test_comp_member_is_actually_recoverable_by_the_service(self):
        member = self.create_member(self.gym)
        member.is_comp = True
        member.save(update_fields=["is_comp"])
        self._settled_sub(member, self.plan, *self._prev_period())
        member.active = False
        member.save(update_fields=["active"])

        sub, created = recover_member(member)

        self.assertTrue(created)
        self.assertEqual(sub.origin, "recovery")


class CourtesyAutoRenewTests(_FaseFBase):
    """DIN-05: dar/quitar cortesía no altera el ``auto_renew`` elegido."""

    def test_granting_comp_keeps_auto_renew_off(self):
        member = self.create_member(self.gym)
        today = timezone.localdate()
        month_end = get_last_day_of_month(today)
        sub = self._settled_sub(
            member, self.plan, today, month_end, auto_renew=False
        )
        self.assertFalse(sub.auto_renew)

        resp = self.client.patch(
            f"/api/members/{member.id}/",
            {"is_comp": True},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        sub.refresh_from_db()
        self.assertFalse(sub.auto_renew)

    def test_granting_comp_without_subscription_does_not_renew(self):
        member = self.create_member(self.gym)

        resp = self.client.patch(
            f"/api/members/{member.id}/",
            {"is_comp": True},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        opened = Subscription.objects.filter(member=member).order_by("-created_at").first()
        self.assertIsNotNone(opened)
        self.assertFalse(opened.auto_renew)


class ImmediatePlanChangeCreditTests(_FaseFBase):
    """DIN-04: el cambio de plan con efecto inmediato consume el crédito."""

    def _member_with_credit_and_no_current_sub(self):
        member = self.create_member(self.gym)
        sub = self._settled_sub(member, self.plan, *self._prev_period())
        # Baja el total después del cobro -> crédito abierto de $30.000.
        sub.items.filter(item_type="plan").update(
            price_snapshot=Decimal("20000.00")
        )
        from subscriptions.services import sync_subscription_paid
        sync_subscription_paid(sub)
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))
        return member

    def test_apply_plan_change_consumes_credit_when_opening_the_period(self):
        from subscriptions.services import apply_plan_change
        from subscriptions.models import PlanChangeRequest

        member = self._member_with_credit_and_no_current_sub()
        new_plan = self.create_plan(self.gym, name="Plan Nuevo", price=Decimal("50000.00"))

        today = timezone.localdate()
        pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=member,
            requested_plan=new_plan,
            status="approved",
            effective_date=today,
            current_schedules_snapshot=[],
            target_schedules_snapshot=[],
        )

        apply_plan_change(pcr)

        new_sub = Subscription.objects.filter(
            member=member, origin="plan_change"
        ).first()
        self.assertIsNotNone(new_sub)
        # El crédito cubrió parte del período nuevo.
        self.assertEqual(member_credit_balance(member), Decimal("0.00"))
        self.assertEqual(
            subscription_remaining_balance(new_sub)["remaining"],
            Decimal("20000.00"),
        )

    def test_immediate_plan_change_via_action_consumes_credit(self):
        from subscriptions.models import PlanChangeRequest

        member = self._member_with_credit_and_no_current_sub()
        new_plan = self.create_plan(self.gym, name="Plan Nuevo", price=Decimal("50000.00"))
        today = timezone.localdate()
        pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=member,
            requested_plan=new_plan,
            status="pending",
            current_schedules_snapshot=[],
            target_schedules_snapshot=[],
        )

        resp = self.client.post(
            f"/api/plan-change-requests/{pcr.id}/approve/",
            {},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(member_credit_balance(member), Decimal("0.00"))
        new_sub = Subscription.objects.filter(
            member=member, origin="plan_change"
        ).first()
        self.assertIsNotNone(new_sub)
        self.assertEqual(
            subscription_remaining_balance(new_sub)["remaining"],
            Decimal("20000.00"),
        )


class InitialPendingBlocksRenewalTests(_FaseFBase):
    """DIN-06: el primer mes impago frena la auto-renovación."""

    def test_member_who_never_paid_the_first_month_does_not_renew(self):
        member = self.create_member(self.gym)
        p = self._prev_period()
        # Sin período previo: esta sub es la primera del socio -> initial_pending.
        sub = self.open_month_subscription(
            member, self.plan, start_date=p[0], end_date=p[1],
            paid=False, auto_renew=True,
        )

        result = auto_renew_subscriptions()

        self.assertEqual(result["renewed"], 0)
        self.assertEqual(result["skipped_blocked"], 1)
        self.assertFalse(
            Subscription.objects.filter(
                member=member, start_date=timezone.localdate().replace(day=1)
            ).exists()
        )

    def test_first_month_debtor_renews_after_paying(self):
        member = self.create_member(self.gym)
        p = self._prev_period()
        sub = self.open_month_subscription(
            member, self.plan, start_date=p[0], end_date=p[1],
            paid=False, auto_renew=True,
        )

        first = auto_renew_subscriptions()
        self.assertEqual(first["renewed"], 0)
        self.assertEqual(first["skipped_blocked"], 1)

        self.settle_subscription(sub)

        second = auto_renew_subscriptions()
        self.assertEqual(second["renewed"], 1)
