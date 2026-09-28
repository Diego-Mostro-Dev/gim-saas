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

from django.conf import settings
from django.db import connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from core.testing import BaseAPITest
from payments.models import Payment
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import PlanChangeRequest, Subscription, TaskRun
from subscriptions.services import (
    TASK_NAME,
    _task_interval_seconds,
    auto_renew_subscriptions,
    calculate_subscription_total,
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

        SubscriptionDomain.mutate_membership(
            member=member, comp=True, origin="plan_change"
        )
        member.is_comp = True
        member.save(update_fields=["is_comp"])

        sub.refresh_from_db()
        self.assertTrue(sub.paid)
        self.assertTrue(sub.auto_renew)

        plan_item = sub.items.get(item_type="plan", status="active")
        self.assertEqual(plan_item.price_snapshot, Decimal("0"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
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