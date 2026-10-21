"""Arnés de invariantes de dinero (Fase B de PLAN-bugs.md).

La suite recorre el ciclo real de dinero de un gimnasio —alta, pago,
renovación, cambio de plan, add-ons, recuperación, cortesía y sobrepago— y,
tras **cada mutación**, afirma las identidades contables con
``core.money_invariants.check_money_invariants``.

Reglas del arnés:

- Las transiciones de dinero se disparan por el camino real: pagos por
  ``POST /api/payments/``, toggle de cortesía por ``PATCH /api/members/<id>/``,
  recuperación por ``POST /api/subscriptions/reopen/`` y la renovación/cambio
  de plan por ``POST /api/system/tasks/?force=true`` (el mismo endpoint que usa
  el cron externo). El alta pública usa ``POST /api/public/register/<code>/``.
- ``check_money_invariants`` es read-only: el arnés **no** arregla nada. Si un
  invariante se rompe de verdad sobre el código actual, el caso se marca
  ``@unittest.expectedFailure`` citando el ID de ``BUGS.md`` y entra a la ficha
  del inventario; el fix de una fase posterior lo desmarca.
- "Hoy" queda congelado en :data:`TODAY` (2026-03-20) como en
  ``test_proration.py``, porque el prorrateo y la renovación dependen del
  calendario. El gimnasio vence el 10, así que el alta de hoy es prorrateada.

Se ejecutan contra Postgres real (gate ``.github/workflows/backend-tests.yml``).
"""

from datetime import date, time as _time
from decimal import Decimal
from unittest import mock

from django.test import override_settings

from activities.models import Activity, ActivitySchedule, Enrollment
from core.money_invariants import check_money_invariants
from core.testing import BaseAPITest
from gyms.features import (
    FEATURE_ACTIVITIES,
    FEATURE_OUTINGS,
    FEATURE_PERSONAL_TRAINING,
)
from members.models import Member
from outings.models import Outing, OutingSchedule
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from subscriptions.models import PlanChangeRequest, Subscription, SubscriptionItem
from subscriptions.services import (
    calculate_subscription_total,
    gym_debtor_member_ids,
    member_credit_balance,
    member_total_outstanding_debt,
    subscription_remaining_balance,
    sync_subscription_paid,
)


TODAY = date(2026, 3, 20)
MONTH_START = date(2026, 3, 1)
MONTH_END = date(2026, 3, 31)
PREV_START = date(2026, 2, 1)
PREV_END = date(2026, 2, 28)
DUE_DAY = 10
TASK_KEY = "test-task-key"

PLAN_PRICE = Decimal("5000.00")
NEXT_PLAN_PRICE = Decimal("9000.00")
ACTIVITY_PRICE = Decimal("3000.00")
PT_PRICE = Decimal("22000.00")
OUTING_PRICE = Decimal("1500.00")


@override_settings(
    SCHEDULED_TASKS_KEY=TASK_KEY,
    # El middleware perezoso dispara renovaciones en cada escritura; el arnés
    # quiere controlar cuándo corre la tarea, así que se apaga.
    SCHEDULED_TASKS_ENABLED=False,
)
class _MoneyInvariantBase(BaseAPITest):
    """Gimnasio con features prendidas y "hoy" congelado en 2026-03-20."""

    def setUp(self):
        super().setUp()

        patcher = mock.patch("django.utils.timezone.localdate", return_value=TODAY)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.gym = self.create_gym()
        self.gym.payment_due_day = DUE_DAY
        self.gym.features = {
            FEATURE_ACTIVITIES: True,
            FEATURE_PERSONAL_TRAINING: True,
            FEATURE_OUTINGS: True,
        }
        self.gym.save(update_fields=["payment_due_day", "features"])

        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)

        self.plan = self.create_plan(self.gym, price=PLAN_PRICE)
        self.next_plan = self.create_plan(
            self.gym, name="Plan Siguiente", price=NEXT_PLAN_PRICE
        )

    # ── aserciones y caminos reales ───────────────────────────────────
    def assert_invariants(self):
        violations = check_money_invariants(self.gym)
        if violations:
            self.fail(
                "Invariantes de dinero rotos:\n  - "
                + "\n  - ".join(violations)
            )

    def pay(self, subscription, amount):
        return self.client.post(
            "/api/payments/",
            {
                "subscription": subscription.id,
                "amount": str(amount),
                "payment_method": "cash",
            },
            format="json",
        )

    def settle(self, subscription):
        """Paga el saldo pendiente por la API y exige que quede en 0."""
        remaining = subscription_remaining_balance(subscription)["remaining"]
        if remaining > 0:
            resp = self.pay(subscription, remaining)
            self.assertEqual(resp.status_code, 201, resp.data)

    def run_tasks(self):
        return self.client.post(
            "/api/system/tasks/?force=true", HTTP_X_TASK_KEY=TASK_KEY
        )

    # ── fixtures de add-ons ───────────────────────────────────────────
    def make_activity(self, price=ACTIVITY_PRICE, name="Kinesio"):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name=name,
            monthly_price=price,
            billing_mode="monthly",
        )
        ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return activity

    def make_monthly_pt(self, member, price=PT_PRICE):
        service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name=f"PT {price}",
            monthly_price=price,
            billing_mode="monthly",
        )
        PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=member,
            trainer=self.create_user(self.gym, username=f"trainer-{price}"),
            service=service,
            day="monday",
            start_time=_time(10, 0),
            end_time=_time(11, 0),
            modality="monthly",
            active=True,
        )
        return service

    def make_outing(self, price=OUTING_PRICE, name="Trail"):
        outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name=name,
            monthly_price=price,
        )
        OutingSchedule.objects.create(
            outing=outing,
            day="wednesday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return outing

    def _settled_expired_sub(self, member, plan=None):
        plan = plan or self.plan
        sub = self.open_month_subscription(
            member,
            plan,
            start_date=PREV_START,
            end_date=PREV_END,
            auto_renew=True,
        )
        self.settle(sub)
        return sub


class InvariantSelfTests(_MoneyInvariantBase):
    """El checker no es vacuo: detecta corrupciones que el arnés toleraría."""

    def test_checker_flags_stale_paid_flag(self):
        member = self.create_member(self.gym)
        sub = self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )
        Subscription.objects.filter(pk=sub.pk).update(paid=True)

        violations = check_money_invariants(self.gym)

        self.assertTrue(
            any(v.startswith("I3") for v in violations),
            violations,
        )

    def test_checker_flags_missing_plan_item(self):
        member = self.create_member(self.gym)
        sub = self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )
        sub.items.filter(item_type="plan").update(status="cancelled")

        violations = check_money_invariants(self.gym)

        self.assertTrue(
            any(v.startswith("I1") for v in violations),
            violations,
        )


class OnboardingCycleTests(_MoneyInvariantBase):
    """Alta (pública) → pago: el nacimiento del contrato de dinero."""

    def test_public_onboarding_prorated_then_paid(self):
        self.create_today_slot(self.gym)
        payload = {
            "first_name": "Luz",
            "last_name": "Perez",
            "phone": "11-onboarding-01",
            "document_number": "30111222",
            "date_of_birth": "1990-05-04",
            "services": ["gym"],
            "schedules": [{"day": self.weekday_name(), "hour": "10:00"}],
            "plan_id": self.plan.id,
        }

        resp = self.client.post(
            f"/api/public/register/{self.gym.onboarding_code}/",
            payload,
            format="json",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="11-onboarding-01")
        sub = Subscription.objects.get(member=member)
        self.assertTrue(sub.prorated)
        self.assertLess(calculate_subscription_total(sub), PLAN_PRICE)
        self.assert_invariants()

        self.settle(sub)

        sub.refresh_from_db()
        self.assertTrue(sub.paid)
        self.assertEqual(subscription_remaining_balance(sub)["remaining"], Decimal("0"))
        self.assert_invariants()

    def test_full_month_alta_then_full_payment(self):
        member = self.create_member(self.gym)
        sub = self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )
        self.assertEqual(calculate_subscription_total(sub), PLAN_PRICE)
        self.assert_invariants()

        resp = self.pay(sub, PLAN_PRICE)
        self.assertEqual(resp.status_code, 201, resp.data)

        sub.refresh_from_db()
        self.assertTrue(sub.paid)
        self.assert_invariants()


class RenewalCycleTests(_MoneyInvariantBase):
    """Renovación por el endpoint del cron, incluido el sobrepago."""

    def test_renewal_via_endpoint_is_idempotent(self):
        member = self.create_member(self.gym)
        self._settled_expired_sub(member)
        self.assert_invariants()

        first = self.run_tasks()
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["status"], "ok")
        self.assertEqual(first.data["result"]["renewed"], 1)

        successors = Subscription.objects.filter(
            member=member, start_date=MONTH_START
        )
        self.assertEqual(successors.count(), 1)
        new_sub = successors.get()
        self.assertEqual(new_sub.origin, "auto_renewal")
        self.assertEqual(calculate_subscription_total(new_sub), PLAN_PRICE)
        self.assert_invariants()

        second = self.run_tasks()
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(
            Subscription.objects.filter(
                member=member, start_date=MONTH_START
            ).count(),
            1,
        )
        self.assert_invariants()

    def test_overpayment_becomes_credit_and_renewal_consumes_it(self):
        member = self.create_member(self.gym)
        expired = self._settled_expired_sub(member)

        # Reprecio a la baja: el período ya pagado vale menos y el excedente
        # tiene que quedar como saldo a favor del socio.
        expired.items.filter(item_type="plan").update(
            price_snapshot=Decimal("1000.00")
        )
        sync_subscription_paid(expired)
        self.assertEqual(member_credit_balance(member), Decimal("4000.00"))
        self.assert_invariants()

        resp = self.run_tasks()
        self.assertEqual(resp.status_code, 200, resp.data)

        march = Subscription.objects.get(member=member, start_date=MONTH_START)
        self.assertEqual(calculate_subscription_total(march), PLAN_PRICE)
        # El crédito cubre 4.000 del período nuevo de 5.000.
        self.assertEqual(
            subscription_remaining_balance(march)["remaining"],
            Decimal("1000.00"),
        )
        self.assertEqual(member_credit_balance(member), Decimal("0"))
        self.assert_invariants()


class PlanChangeCycleTests(_MoneyInvariantBase):
    """Cambio de plan aprobado que la renovación ejecuta y reprecia."""

    def test_approved_plan_change_applies_on_renewal(self):
        member = self.create_member(self.gym)
        expired = self._settled_expired_sub(member)
        PlanChangeRequest.objects.create(
            gym=self.gym,
            member=member,
            subscription=expired,
            requested_plan=self.next_plan,
            current_schedules_snapshot=[],
            target_schedules_snapshot=[],
            status="approved",
            effective_date=MONTH_START,
        )
        self.assert_invariants()

        resp = self.run_tasks()
        self.assertEqual(resp.status_code, 200, resp.data)

        march = Subscription.objects.get(member=member, start_date=MONTH_START)
        self.assertEqual(march.plan, self.next_plan)
        self.assertEqual(
            march.items.filter(item_type="plan", status="active").count(), 1
        )
        self.assertEqual(
            march.items.get(item_type="plan", status="active").price_snapshot,
            NEXT_PLAN_PRICE,
        )
        self.assertEqual(calculate_subscription_total(march), NEXT_PLAN_PRICE)
        self.assert_invariants()


class AddOnCycleTests(_MoneyInvariantBase):
    """Add-ons mensuales: se copian exactamente una vez al renovar."""

    def test_renewal_copies_activity_pt_and_outing_once(self):
        member = self.create_member(self.gym)
        expired = self.open_month_subscription(
            member, self.plan, start_date=PREV_START, end_date=PREV_END,
            auto_renew=True,
        )
        # Los add-ons se crean después del alta: al abrir, el dominio ya
        # auto-engancha las asignaciones de PT activas y duplicaría el ítem.
        activity = self.make_activity()
        pt_service = self.make_monthly_pt(member)
        outing = self.make_outing()

        for item_type, target, price in (
            ("activity", {"activity": activity}, ACTIVITY_PRICE),
            ("personal_training", {"personal_training": pt_service}, PT_PRICE),
            ("outing", {"outing": outing}, OUTING_PRICE),
        ):
            SubscriptionItem.objects.create(
                subscription=expired,
                item_type=item_type,
                plan=None,
                status="active",
                price_snapshot=price,
                start_date=PREV_START,
                end_date=PREV_END,
                **target,
            )
        self.settle(expired)
        self.assert_invariants()

        resp = self.run_tasks()
        self.assertEqual(resp.status_code, 200, resp.data)

        march = Subscription.objects.get(member=member, start_date=MONTH_START)
        for item_type in ("activity", "personal_training", "outing"):
            self.assertEqual(
                march.items.filter(item_type=item_type, status="active").count(),
                1,
                item_type,
            )
        self.assertEqual(
            calculate_subscription_total(march),
            PLAN_PRICE + ACTIVITY_PRICE + PT_PRICE + OUTING_PRICE,
        )
        self.assert_invariants()


class RecoveryCycleTests(_MoneyInvariantBase):
    """Recuperación de un socio que saldó su deuda histórica."""

    def test_recovery_via_endpoint_after_debt_is_cleared(self):
        member = self.create_member(self.gym)
        self._settled_expired_sub(member)
        member.active = False
        member.save(update_fields=["active"])
        self.assert_invariants()

        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)

        new_sub = Subscription.objects.get(member=member, start_date=TODAY)
        self.assertEqual(new_sub.origin, "recovery")
        member.refresh_from_db()
        self.assertTrue(member.active)
        self.assert_invariants()


class CourtesyPassCycleTests(_MoneyInvariantBase):
    """Cortesía ida y vuelta: el sobrepago del mes pagado es saldo a favor."""

    def test_grant_then_remove_comp_keeps_money_sound(self):
        member = self.create_member(self.gym)
        sub = self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )
        self.settle(sub)
        self.assert_invariants()

        grant = self.client.patch(
            f"/api/members/{member.id}/", {"is_comp": True}, format="json"
        )
        self.assertEqual(grant.status_code, 200, grant.data)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)

        # Se le dio de baja el cobro de los días no servidos: ese excedente
        # tiene que quedar como crédito, no como deuda ni desaparecer.
        self.assertGreater(member_credit_balance(member), Decimal("0"))
        self.assertEqual(
            member_total_outstanding_debt(member)["total"], Decimal("0")
        )
        self.assertNotIn(member.id, gym_debtor_member_ids(self.gym))
        self.assert_invariants()

        remove = self.client.patch(
            f"/api/members/{member.id}/",
            {"is_comp": False, "plan_id": self.plan.id},
            format="json",
        )
        self.assertEqual(remove.status_code, 200, remove.data)
        member.refresh_from_db()
        self.assertFalse(member.is_comp)
        self.assert_invariants()


class PackageDebtCycleTests(_MoneyInvariantBase):
    """La deuda de paquetes de sesiones entra al outstanding del socio."""

    def test_unpaid_package_counts_as_debt(self):
        member = self.create_member(self.gym)
        self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )
        activity = self.make_activity(price=Decimal("0.00"))
        schedule = activity.schedules.get()

        Enrollment.objects.create(
            gym=self.gym,
            member=member,
            schedule=schedule,
            modality="package",
            package_total_sessions=4,
            session_price=Decimal("1500.00"),
            amount_paid=Decimal("0.00"),
            active=True,
        )
        self.assert_invariants()

        debt = member_total_outstanding_debt(member)
        self.assertEqual(
            debt["total"], PLAN_PRICE + Decimal("6000.00")
        )
        self.assertEqual(len(debt["packages"]), 1)
        self.assertIn(member.id, gym_debtor_member_ids(self.gym))

        resp = self.client.get(
            f"/api/subscriptions/member/{member.id}/outstanding/"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assert_invariants()


class CrossGymCreditIsolationTests(_MoneyInvariantBase):
    """REF-03: las consultas de crédito no pueden cruzar gimnasios.

    ``member_credit_balance``, ``credit_recorded_for`` y
    ``consume_member_credit`` filtran por ``gym`` derivado del socio o de la
    suscripción. Si un entero quedara mal escrito (o una futura rotura de la
    inmutabilidad de ``Member.gym`` colara una fila ajena), el saldo del socio
    de otro gimnasio no debe aparecer.
    """

    def test_credit_from_other_gym_is_not_counted(self):
        from payments.models import Payment

        member = self.create_member(self.gym)
        self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )

        other_gym = self.create_gym(name="Otro Gym")
        # Fila de crédito abierta a nombre del socio pero perteneciente a otro
        # gimnasio: es la corrupción que el filtro de gym debe ignorar.
        Payment.objects.create(
            gym=other_gym,
            member=member,
            concept="credit",
            amount=Decimal("-7777.00"),
            member_name="Ana Gomez",
            plan_name="Saldo a favor",
        )

        # El crédito visible para el socio (mirado desde su propio gimnasio) no
        # incluye la fila ajena.
        self.assertEqual(member_credit_balance(member), Decimal("0"))
        self.assert_invariants()

    def test_consume_ignores_foreign_gym_credit(self):
        from payments.models import Payment

        member = self.create_member(self.gym)
        other_gym = self.create_gym(name="Otro Gym")
        Payment.objects.create(
            gym=other_gym,
            member=member,
            concept="credit",
            amount=Decimal("-5000.00"),
            member_name="Ana Gomez",
            plan_name="Saldo a favor",
        )

        sub = self.open_month_subscription(
            member, self.plan, start_date=MONTH_START, end_date=MONTH_END
        )
        sub.refresh_from_db()

        # Ninguna porción del crédito ajeno se aplica al período nuevo.
        self.assertEqual(
            member_credit_balance(member), Decimal("0")
        )
        self.assertFalse(
            Payment.objects.filter(
                member=member,
                gym=self.gym,
                concept="credit",
                applied_to__isnull=False,
            ).exists()
        )
