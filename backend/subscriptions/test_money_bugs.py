"""Tests focalizados de bugs de dinero (Fase 6 de PLAN-dinero.md).

Cada caso reproduce el escenario descrito en el plan y fija el
comportamiento en los puntos de escritura (renovación automática,
recuperación, cambio de plan, claim concurrente) usando los helpers de
``core.testing``.

Se ejecutan contra Postgres real, nunca contra SQLite ni contra la base de
desarrollo. El gate es ``.github/workflows/backend-tests.yml``, que levanta un
``postgres:16`` como service del runner; el usuario del container es
superusuario, así que Django crea ``test_neondb``, corre los tests adentro y la
dropea al terminar. Por eso los ``flush`` de ``TransactionTestCase`` caen
sobre ``test_neondb``.

Ese drop es estricto: si algún test deja una conexión viva en otro hilo,
Postgres corta con ``ObjectInUse: database "test_neondb" is being accessed by
other users`` y el job queda rojo aunque todos los tests hayan pasado. Por eso
los que usan ``threading.Thread`` tienen que cerrar sus conexiones con
``connections.close_all()`` antes de terminar.

Eso importa para ``ScheduledTaskClaimTests``: el claim atómico se apoya en el
lock de fila de Postgres, que en SQLite no existe porque las escrituras se
serializan solas. Contra SQLite el test pasa sin ejercitar la garantía real.

Localmente hace falta un Postgres con ``CREATEDB`` (cualquier ``postgres`` de
la máquina sirve). El Neon del plan gratuito no alcanza: su rol de aplicación
no tiene ``CREATEDB`` ni ``CREATEROLE``, así que ni puede crear ``test_neondb``
ni concederse esos permisos.

Ojo con no configurar un ``TEST.NAME`` que reutilice la base de desarrollo,
porque eso sí termina borrando los datos.
"""

import threading
from datetime import date, time as _time
from decimal import Decimal
from unittest import mock

from django.db import connection, connections, transaction
from django.db.models import Sum
from django.test import TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from gyms.models import Discount, Gym
from members.models import HealthInsurance, Member
from outings.models import Outing, OutingEnrollment, OutingSchedule
from payments.models import Payment
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import MembershipPlan, Service
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import (
    PlanChangeRequest,
    Subscription,
    SubscriptionItem,
    TaskRun,
)
from subscriptions.serializers import SubscriptionSerializer
from subscriptions.services import (
    TASK_NAME,
    _task_interval_seconds,
    auto_renew_subscriptions,
    calculate_subscription_total,
    consume_member_credit,
    create_next_subscription,
    get_last_day_of_month,
    get_subscription_payment_status,
    member_credit_balance,
    recover_member,
    run_scheduled_tasks,
    subscription_remaining_balance,
    sync_subscription_paid,
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

    def _credits(self, member=None, on_subscription=None, applied=None):
        """Filtrar por consumo del crédito con tres estados.

        ``None`` (default) no filtra y cuenta todas las filas, que es lo que
        quieren los tests que comparan el total de créditos del socio.
        ``True`` cuenta sólo las consumidas (``applied_to`` puesto) y
        ``False`` sólo las abiertas.
        """
        rows = Payment.objects.filter(concept="credit")
        if member is not None:
            rows = rows.filter(member=member)
        if on_subscription is not None:
            rows = rows.filter(subscription=on_subscription)
        if applied is not None:
            rows = rows.filter(applied_to__isnull=not applied)
        return rows

    def _repriced(self, member, sub, new_price):
        """Cambia el total del período ya pagado, como el toggle de cortesía."""
        sub.items.filter(item_type="plan").update(price_snapshot=new_price)
        sync_subscription_paid(sub)
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

    def test_open_credit_does_not_unblock_a_renewal_that_owes_money(self):
        """P16: un crédito abierto no es plata gastada en su propio período.

        Un crédito abierto queda estacionado en el período que lo generó como
        registro de un sobrepago: el gym le debe esa plata al socio y ningún
        período la tomó todavía. El bulk de créditos de
        ``_collect_renewal_candidates`` lo contaba igual que un crédito ya
        consumido, así que un período que vuelve a deber después del sobrepago
        daba ``remaining = 0``, el socio no llegaba a ``blocked`` y renovaba
        sin pagar. Peor: el crédito abierto se consumía después contra el
        período nuevo, así que el gym además lo regalaba.

        El camino canónico (``credit_realized_for``) sí filtra por
        ``applied_to``, así que la deuda se ve correcta en el portal, en el
        formulario de cobro y en el dashboard. Sólo la decisión de renovar
        usaba el cálculo roto, que es lo que hace el bug invisible.
        """
        p = self._periods()
        gym = self.create_gym()
        plan = self.create_plan(gym, price=Decimal("50000.00"))
        member = self.create_member(gym)

        # Período previo para que el de abajo no sea el primero del socio:
        # payment_blocked consulta is_first y con el primero nunca bloquea.
        self._settled_sub(member, plan, p["prev2_start"], p["prev2_end"])

        sub = self._settled_sub(member, plan, p["prev_start"], p["prev_end"])

        # Paso 1: el total baja después del cobro -> crédito abierto de $50.000.
        self._repriced(member, sub, Decimal("0.00"))
        open_rows = self._credits(member=member, on_subscription=sub, applied=False)
        self.assertEqual(open_rows.count(), 1)
        self.assertEqual(open_rows.get().amount, Decimal("-50000.00"))
        self.assertEqual(member_credit_balance(member), Decimal("50000.00"))

        # Paso 2: el total vuelve a subir -> el período debe plata de nuevo.
        self._repriced(member, sub, Decimal("80000.00"))

        # El camino canónico ve la deuda real: esto pasa hoy y después del fix.
        self.assertEqual(calculate_subscription_total(sub), Decimal("80000.00"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"],
            Decimal("30000.00"),
            "el período debe $30.000: el crédito abierto está vivo, no gastado",
        )
        self.assertEqual(member_credit_balance(member), Decimal("50000.00"))

        result = auto_renew_subscriptions()

        self.assertEqual(result["skipped_blocked"], 1)
        self.assertEqual(result["candidates"], 0)
        self.assertEqual(result["renewed"], 0)
        self.assertFalse(
            Subscription.objects.filter(
                member=member, start_date=p["month_start"]
            ).exists(),
            "no debe renovar: debe $30.000 del período anterior",
        )
        # Y el crédito sigue disponible para un pago futuro: no se consumió
        # contra un período que no debía renovarse.
        self.assertEqual(member_credit_balance(member), Decimal("50000.00"))

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

    def _member_without_pt(self, is_comp=False):
        """Socio sin PT y **sin** suscripción vigente.

        La celda que faltaba de la matriz del toggle: los otros casos sin
        suscripción vigentes todos arrastraban PT mensual, así que nunca se
        probó que el dominio no invente un ítem de PT donde no hay asignación.
        """
        member = self.create_member(self.gym)
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

    def test_granting_comp_without_subscription_or_pt_writes_zero_plan(self):
        member = self._member_without_pt()

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)

        sub = SubscriptionDomain.get_current_subscription(member)
        self.assertIsNotNone(sub)
        self.assertEqual(self._snapshot(member, "plan"), Decimal("0"))
        # Sin asignación de PT no puede aparecer un ítem de PT con precio 0:
        # el cobro del pase tiene que ser exactamente el del plan.
        self.assertFalse(
            sub.items.filter(item_type="personal_training").exists()
        )
        self.assertEqual(calculate_subscription_total(sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_removing_comp_without_subscription_or_pt_writes_real_plan_price(self):
        member = self._member_without_pt(is_comp=True)

        resp = self._toggle(member, is_comp=False, plan_id=self.paid_plan.id)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertFalse(member.is_comp)

        sub = SubscriptionDomain.get_current_subscription(member)
        self.assertEqual(sub.plan, self.paid_plan)
        self.assertEqual(self._snapshot(member, "plan"), self.paid_plan.price)
        self.assertFalse(
            sub.items.filter(item_type="personal_training").exists()
        )
        self.assertEqual(calculate_subscription_total(sub), self.paid_plan.price)
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], self.paid_plan.price
        )


class CourtesyPassProrationTests(_MoneyBugBase):
    """Fase 7.1 (P3): el período en curso se factura por días, en las dos
    direcciones.

    El día de la transición cuenta a favor del estado nuevo: al quitar el pase
    el 20 de un mes de 30 se factura 20→30 (11 días) y al darlo se factura 1→19
    (19 días). El denominador es la duración real del período.

    Los montos están elegidos para que el prorrateo caiga exacto: plan $30.000
    + actividad $3.000 + PT $6.000 = $39.000, que da $14.300 con 11/30 y
    $24.700 con 19/30. Sin PT el total es $33.000 → $12.100 / $20.900.
    La salida suma $4.000: sola con la actividad da $37.000 → $13.566,67 con
    11/30 y $23.433,33 con 19/30.
    """

    TRANSITION_DAY = date(2026, 9, 20)
    PERIOD_START = date(2026, 9, 1)
    PERIOD_END = date(2026, 9, 30)
    PLAN_PRICE = Decimal("30000.00")
    ACTIVITY_PRICE = Decimal("3000.00")
    PT_PRICE = Decimal("6000.00")
    OUTING_PRICE = Decimal("4000.00")

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
        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trail",
            monthly_price=self.OUTING_PRICE,
            billing_mode="monthly",
        )

    def _member_with_september(
        self, comp_from_start, settle=False, with_pt=False, with_outing=False
    ):
        """Socio con la suscripción de septiembre abierta.

        ``comp_from_start`` refleja el estado real del socio desde el 1º:
        cortesía (``is_comp`` e ítems en 0) o pagando (ítems a precio de
        contrato). ``with_pt`` y ``with_outing`` agregan su ítem mensual al
        período.
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
        if with_outing:
            outing_snapshot = Decimal("0") if comp_from_start else self.OUTING_PRICE
            SubscriptionItem.objects.create(
                subscription=sub,
                item_type="outing",
                plan=None,
                outing=self.outing,
                status="active",
                name_snapshot=self.outing.name,
                price_snapshot=outing_snapshot,
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

    def test_removing_comp_on_day_20_restores_outing_with_11_of_30(self):
        """La salida entra en el mismo loop de restauración que actividad y PT.

        ``mutate_membership`` prora los tres tipos juntos contra
        ``_item_contract_price`` (domain.py:248), que para ``outing`` lee
        ``item.outing.monthly_price``. Antes este tipo no lo ejercitaba ningún
        test, así que un ``item_type`` mal escrito en ese ``__in`` habría
        pasado inadvertido.
        """
        member, sub = self._member_with_september(True, with_outing=True)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertFalse(member.is_comp)

        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("11000.00"))
        self.assertEqual(self._snapshot(sub, "activity"), Decimal("1100.00"))
        # 4.000 * 11/30 = 1466,666... -> 1466.67 con ROUND_HALF_UP.
        self.assertEqual(self._snapshot(sub, "outing"), Decimal("1466.67"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("13566.67"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("13566.67")
        )

    def test_granting_comp_on_day_20_bills_served_19_of_30_with_outing(self):
        """El otro loop, el de dar el pase (domain.py:200), también cubre outing.

        Recorre todos los ítems activos en vez de los tres tipos, y parte de
        ``_item_contract_price`` y no del snapshot, para que togglear dos veces
        en el mismo período no componga el factor.
        """
        member, sub = self._member_with_september(False, settle=True, with_outing=True)

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.is_comp)

        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("19000.00"))
        self.assertEqual(self._snapshot(sub, "activity"), Decimal("1900.00"))
        # 4.000 * 19/30 = 2533,333... -> 2533.33 con ROUND_HALF_UP.
        self.assertEqual(self._snapshot(sub, "outing"), Decimal("2533.33"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("23433.33"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_toggle_delegates_paid_and_never_writes_it_by_hand(self):
        """``paid`` es derivado: lo calcula ``sync_subscription_paid``, no el toggle.

        El plan exige que ninguna rama escriba ``paid`` a mano. Con el sync
        mockeado a un no-op, el total se prorea igual pero ``paid`` no puede
        cambiar: si algún ``sub.paid = ...`` sobrevivo en el dominio, este
        assert lo delata.
        """
        member, sub = self._member_with_september(False, settle=True)
        self.assertTrue(sub.paid)

        with mock.patch("subscriptions.services.sync_subscription_paid") as sync:
            resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(sync.call_count, 1)
        self.assertEqual(sync.call_args.args[0].pk, sub.pk)

        sub.refresh_from_db()
        # El total bajó de $33.000 a $20.900, pero con el sync desactivado
        # ``paid`` sigue en True: nadie más lo tocó.
        self.assertEqual(
            SubscriptionItem.objects.filter(
                subscription=sub, item_type="plan", status="active"
            ).get().price_snapshot,
            Decimal("19000.00"),
        )
        self.assertTrue(sub.paid)

    def test_toggle_recomputes_paid_from_the_rewritten_items(self):
        """La contraparte: con el sync real, ``paid`` sí se recalcula.

        Es un flip de verdad (False → True), que el test anterior con el sync
        desactivado no podría deducir: nadie escribe ``paid`` a mano,
        sale de ``subscription_remaining_balance``.
        """
        member, sub = self._member_with_september(False)
        self.assertFalse(sub.paid)

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        sub.refresh_from_db()
        self.assertEqual(self._snapshot(sub, "plan"), Decimal("19000.00"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("20900.00"))
        # El total bajó de $33.000 a $20.900, pero la rama ``is_comp`` de
        # subscription_remaining_balance fuerza el saldo a 0, así que ``paid``
        # tiene que haber pasado a True.
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )
        self.assertTrue(sub.paid)


class CourtesyPassPackageBalancesTests(_MoneyBugBase):
    """Fase 7.1 (P7): los paquetes de sesiones del toggle ida y vuelta.

    Al dar el pase, los paquetes activos de los tres tipos (actividad, PT y
    salida) se neutralizan: ``session_price`` y ``amount_paid`` pasan a 0.
    Al quitarlo, ``amount_paid`` se recalcula de los pagos de sesión
    (su fuente canónica) y ``session_price`` se refresca desde la obra
    social del socio.
    """

    PERIOD_START = date(2026, 9, 1)
    PERIOD_END = date(2026, 9, 30)
    TRANSITION_DAY = date(2026, 9, 20)
    COPAY = Decimal("2500.00")
    AMOUNT_PAID = Decimal("6000.00")

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.plan = self.create_plan(self.gym)
        self.insurance = HealthInsurance.objects.create(
            gym=self.gym,
            name="IAPOS",
            session_price=self.COPAY,
            sellado_amount=Decimal("0"),
        )
        self.payment_fk = {
            "activity": "enrollment",
            "pt": "personal_training_assignment",
            "outing": "outing_enrollment",
        }
        self.payment_concept = {
            "activity": "coseguro",
            "pt": "personal_training",
            "outing": "outing",
        }

    def _activity_package(self, member):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return Enrollment.objects.create(
            gym=self.gym,
            member=member,
            schedule=schedule,
            modality="package",
            package_total_sessions=10,
            session_price=self.COPAY,
            amount_paid=self.AMOUNT_PAID,
        )

    def _pt_package(self, member):
        service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="PT paquete",
            monthly_price=Decimal("0"),
            billing_mode="sessions",
        )
        trainer = self.create_user(self.gym, username="pt-trainer")
        return PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=member,
            trainer=trainer,
            service=service,
            day="monday",
            start_time=_time(10, 0),
            end_time=_time(11, 0),
            modality="package",
            package_total_sessions=10,
            session_price=self.COPAY,
            amount_paid=self.AMOUNT_PAID,
        )

    def _outing_package(self, member):
        outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trail",
        )
        schedule = OutingSchedule.objects.create(
            outing=outing,
            day="monday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return OutingEnrollment.objects.create(
            gym=self.gym,
            member=member,
            schedule=schedule,
            modality="package",
            package_total_sessions=10,
            session_price=self.COPAY,
            amount_paid=self.AMOUNT_PAID,
        )

    def _member_with_package(self, kind, with_subscription, with_insurance=True, phone=None):
        member = self.create_member(self.gym, phone=phone)
        if with_insurance:
            member.insurance = self.insurance
            member.save(update_fields=["insurance"])
        package = {
            "activity": self._activity_package,
            "pt": self._pt_package,
            "outing": self._outing_package,
        }[kind](member)
        Payment.objects.create(
            gym=self.gym,
            member=member,
            amount=self.AMOUNT_PAID,
            concept=self.payment_concept[kind],
            **{self.payment_fk[kind]: package},
        )
        if with_subscription:
            self.open_month_subscription(
                member,
                self.plan,
                start_date=self.PERIOD_START,
                end_date=self.PERIOD_END,
                paid=False,
                auto_renew=True,
            )
        return member, package

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

    def _assert_neutralized(self, package):
        package.refresh_from_db()
        self.assertEqual(package.session_price, Decimal("0"))
        self.assertEqual(package.amount_paid, Decimal("0"))

    def _assert_restored(self, package):
        package.refresh_from_db()
        self.assertEqual(package.session_price, self.COPAY)
        self.assertEqual(package.amount_paid, self.AMOUNT_PAID)

    def test_package_balances_round_trip_activity(self):
        member, enrollment = self._member_with_package("activity", with_subscription=True)

        resp = self._toggle(member, is_comp=True)
        self.assertEqual(resp.status_code, 200)
        self._assert_neutralized(enrollment)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 200)
        self._assert_restored(enrollment)

    def test_package_balances_round_trip_pt(self):
        member, assignment = self._member_with_package("pt", with_subscription=True)

        resp = self._toggle(member, is_comp=True)
        self.assertEqual(resp.status_code, 200)
        self._assert_neutralized(assignment)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 200)
        self._assert_restored(assignment)

    def test_package_balances_round_trip_outing(self):
        member, enrollment = self._member_with_package("outing", with_subscription=True)

        resp = self._toggle(member, is_comp=True)
        self.assertEqual(resp.status_code, 200)
        self._assert_neutralized(enrollment)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 200)
        self._assert_restored(enrollment)

    def test_granting_comp_without_subscription_neutralizes_packages(self):
        member, enrollment = self._member_with_package("activity", with_subscription=False)

        resp = self._toggle(member, is_comp=True)

        self.assertEqual(resp.status_code, 200)
        self._assert_neutralized(enrollment)

    def test_removing_comp_without_subscription_restores_packages(self):
        member, enrollment = self._member_with_package("activity", with_subscription=False)
        Enrollment.objects.filter(pk=enrollment.pk).update(
            session_price=Decimal("0"), amount_paid=Decimal("0")
        )
        member.is_comp = True
        member.save(update_fields=["is_comp"])

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)

        self.assertEqual(resp.status_code, 200)
        self._assert_restored(enrollment)

    def test_restoring_comp_without_insurance_leaves_copay_at_zero(self):
        """Sin obra social el co-pay vuelve a 0 ("sin cargo"), no a $2.500.

        Los cinco casos anteriores fijaban siempre ``insurance`` con
        ``session_price=$2.500``, así que el branch sin obra social de
        ``_restore_comp_package_balances`` (domain.py:449-452) no lo ejercitaba
        nadie. Es el edge que el propio docstring de la función declara.
        """
        member, enrollment = self._member_with_package(
            "activity", with_subscription=True, with_insurance=False
        )
        self.assertIsNone(member.insurance)

        resp = self._toggle(member, is_comp=True)
        self.assertEqual(resp.status_code, 200)
        self._assert_neutralized(enrollment)

        resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 200)

        enrollment.refresh_from_db()
        # ``session_price`` se refresca desde la obra social del socio; sin
        # ella es 0, no el $2.500 que tenía antes del pase.
        self.assertEqual(enrollment.session_price, Decimal("0"))
        # ``amount_paid`` en cambio sale de los pagos de sesión, que no se
        # tocaron, así que vuelve al valor real.
        self.assertEqual(enrollment.amount_paid, self.AMOUNT_PAID)

    def test_restoring_comp_without_insurance_covers_pt_and_outing(self):
        """El mismo edge en los otros dos tipos de paquete, no sólo en actividad.

        ``_restore_comp_package_balances`` tiene tres bucles casi idénticos
        (enrollment, PT, outing). Cubrir sólo el primero dejaba los otros dos
        con la mitad de sus llamadas sin ejercitar.
        """
        for kind in ("pt", "outing"):
            with self.subTest(kind=kind):
                member, package = self._member_with_package(
                    kind,
                    with_subscription=True,
                    with_insurance=False,
                    phone=f"11-{kind}",
                )

                resp = self._toggle(member, is_comp=True)
                self.assertEqual(resp.status_code, 200)
                self._assert_neutralized(package)

                resp = self._toggle(member, is_comp=False, plan_id=self.plan.id)
                self.assertEqual(resp.status_code, 200)

                package.refresh_from_db()
                self.assertEqual(package.session_price, Decimal("0"))
                self.assertEqual(package.amount_paid, self.AMOUNT_PAID)


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


class CourtesyCreditFrozenDiscountTests(_MoneyBugBase):
    """Fase 7.3 (P5): el descuento se congela por período.

    El bug de fondo: ``calculate_subscription_total`` leía ``Discount.active``
    en vivo, así que desactivar el descuento re-cobraba un mes ya pagado. Con
    el snapshot, cada período se factura con el porcentaje con el que se
    emitió. Los períodos ya abiertos antes de la 7.3 no tienen snapshot y
    siguen con el valor vivo (filas legacy).
    """

    PERIOD_START = date(2026, 9, 1)
    PERIOD_END = date(2026, 9, 30)
    PLAN_PRICE = Decimal("50000.00")
    DISCOUNT = 20

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.plan = self.create_plan(self.gym, price=self.PLAN_PRICE)
        self.discount = Discount.objects.create(
            gym=self.gym,
            name="Estudiante",
            discount_percent=self.DISCOUNT,
        )

    def _member_with_discount(self):
        member = self.create_member(self.gym)
        member.discount = self.discount
        member.save(update_fields=["discount"])
        return member

    def _open_september(self, member):
        return self.open_month_subscription(
            member,
            self.plan,
            start_date=self.PERIOD_START,
            end_date=self.PERIOD_END,
            paid=False,
            auto_renew=True,
        )

    def test_open_subscription_freezes_the_discount(self):
        member = self._member_with_discount()

        sub = self._open_september(member)

        self.assertEqual(sub.discount_percent_snapshot, self.DISCOUNT)
        # $50.000 con 20% off.
        self.assertEqual(calculate_subscription_total(sub), Decimal("40000.00"))

    def test_deactivating_discount_does_not_rebill_a_paid_period(self):
        member = self._member_with_discount()
        sub = self._open_september(member)
        self.settle_subscription(sub)

        self.discount.active = False
        self.discount.save(update_fields=["active"])

        sub.refresh_from_db()
        # El bug: acá el total volvía a $50.000 y el socio debía de nuevo un
        # mes que ya había pagado.
        self.assertEqual(calculate_subscription_total(sub), Decimal("40000.00"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_period_opened_after_deactivation_has_no_discount(self):
        member = self._member_with_discount()

        self.discount.active = False
        self.discount.save(update_fields=["active"])

        sub = self._open_september(member)

        self.assertEqual(sub.discount_percent_snapshot, 0)
        self.assertEqual(calculate_subscription_total(sub), self.PLAN_PRICE)

    def test_legacy_period_without_snapshot_keeps_live_discount(self):
        """Limitación honesta de la 7.3: las filas ya abiertas no tienen
        snapshot y se comportan como antes hasta que renuevan."""
        member = self._member_with_discount()
        sub = self._open_september(member)
        Subscription.objects.filter(pk=sub.pk).update(
            discount_percent_snapshot=None
        )
        sub.refresh_from_db()

        self.assertEqual(calculate_subscription_total(sub), Decimal("40000.00"))

        self.discount.active = False
        self.discount.save(update_fields=["active"])

        # El assert anterior entró por calculate_subscription_total, que dejó
        # cacheados el socio y su discount tal como estaban antes de esta
        # desactivación: son otras instancias que self.discount, así que la
        # segunda aserción leía un Discount que ya no refleja la base.
        sub.refresh_from_db()
        self.assertEqual(calculate_subscription_total(sub), self.PLAN_PRICE)

    def test_each_period_freezes_its_own_discount(self):
        """La renovación congela el valor vigente del período nuevo."""
        member = self._member_with_discount()
        sub = self._open_september(member)

        self.discount.active = False
        self.discount.save(update_fields=["active"])

        new_sub = create_next_subscription(sub)

        self.assertEqual(new_sub.discount_percent_snapshot, 0)
        self.assertEqual(calculate_subscription_total(new_sub), self.PLAN_PRICE)
        # El período viejo conserva el suyo.
        sub.refresh_from_db()
        self.assertEqual(calculate_subscription_total(sub), Decimal("40000.00"))


class MemberCreditBalanceTests(_MoneyBugBase):
    """Fase 7.3 (P4): el sobrepago se convierte en saldo a favor, y el saldo
    se consume solo en la renovación.

    El bug de fondo: ``overpayment`` se calculaba y nadie lo leía, así que el
    clamp protegía al socio de una deuda negativa (bien) y borraba en
    silencio lo que el gym tenía por cobrar. No había camino para mover ese
    crédito al mes siguiente: no era mal mostrar, era que el camino no
    existía.
    """

    PERIOD_START = date(2026, 9, 1)
    PERIOD_END = date(2026, 9, 30)
    PLAN_PRICE = Decimal("50000.00")

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.plan = self.create_plan(self.gym, price=self.PLAN_PRICE)
        self.credit_rows = None

    def _open_september(self, member, settle=True):
        sub = self.open_month_subscription(
            member,
            self.plan,
            start_date=self.PERIOD_START,
            end_date=self.PERIOD_END,
            paid=False,
            auto_renew=True,
        )
        if settle:
            self.settle_subscription(sub)
        return sub

    def _october(self, sub):
        return create_next_subscription(sub)

    def test_lowered_total_creates_credit_for_the_member(self):
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

        self._repriced(member, sub, Decimal("20000.00"))

        credit = self._credits(member=member, on_subscription=sub).get()
        # $50.000 cobrados contra un total que bajó a $20.000.
        self.assertEqual(credit.amount, Decimal("-30000.00"))
        self.assertIsNone(credit.applied_to)
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )

    def test_overpayment_at_payment_entry_creates_credit(self):
        """El caso real: cobrar dos meses contra un mes.

        El serializer rechaza pagar más que el saldo, así que esta fila
        sobrepaga igual que las 4 que la 7.0 encontró en staging: se escribe
        directo y ``sync`` la convierte en crédito, que es el punto.
        """
        member = self.create_member(self.gym)
        sub = self._open_september(member, settle=False)
        Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=sub,
            amount=Decimal("130000.00"),
            member_name=str(member),
            plan_name=self.plan.name,
        )
        sync_subscription_paid(sub)

        credit = self._credits(member=member, on_subscription=sub).get()

        # $130.000 cobrados contra un total de $50.000.
        self.assertEqual(credit.amount, Decimal("-80000.00"))
        self.assertEqual(member_credit_balance(member), Decimal("80000.00"))

    def test_credit_is_idempotent_across_repeated_syncs(self):
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self._repriced(member, sub, Decimal("20000.00"))

        for _ in range(3):
            sync_subscription_paid(sub)

        self.assertEqual(
            self._credits(member=member).count(),
            1,
            "sync repetido no debe duplicar el crédito",
        )
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))

    def test_renewal_consumes_the_credit_and_lands_on_zero(self):
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self._repriced(member, sub, Decimal("20000.00"))
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))

        new_sub = self._october(sub)

        # $30.000 de crédito sobre un período de $50.000: no alcanza, así que
        # queda debiendo $20.000 y el saldo ya no está disponible.
        self.assertEqual(calculate_subscription_total(new_sub), self.PLAN_PRICE)
        self.assertEqual(
            subscription_remaining_balance(new_sub)["remaining"],
            Decimal("20000.00"),
        )
        self.assertEqual(member_credit_balance(member), Decimal("0.00"))
        applied = self._credits(on_subscription=new_sub).get()
        self.assertEqual(applied.amount, Decimal("-30000.00"))
        self.assertEqual(applied.applied_to, sub)

    def test_credit_covering_the_period_lands_it_on_zero(self):
        """Invariante central de la 7.3: el crédito se consume solo."""
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self._repriced(member, sub, Decimal("0.00"))
        self.assertEqual(member_credit_balance(member), Decimal("50000.00"))

        new_sub = self._october(sub)

        self.assertEqual(
            subscription_remaining_balance(new_sub)["remaining"], Decimal("0")
        )
        self.assertEqual(member_credit_balance(member), Decimal("0.00"))
        # El crédito viaja entero, no queda una copia atrás: un cent contado
        # una sola vez.
        self.assertEqual(self._credits(member=member).count(), 1)

    def test_credit_is_capped_by_the_new_period_total(self):
        """Un crédito de $80.000 contra un período de $50.000 no puede
        cubrir más que el período, y el resto sigue disponible."""
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self._repriced(member, sub, Decimal("0.00"))
        self.assertEqual(member_credit_balance(member), Decimal("50000.00"))
        # Exceso extra: el pago de $130.000 de arriba dejó $80.000 de crédito.
        Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=sub,
            concept="credit",
            amount=Decimal("-30000.00"),
            member_name=str(member),
            plan_name="Saldo a favor",
        )
        self.assertEqual(member_credit_balance(member), Decimal("80000.00"))

        new_sub = self._october(sub)

        self.assertEqual(
            subscription_remaining_balance(new_sub)["remaining"], Decimal("0")
        )
        # $30.000 de los $80.000 quedaron en el período viejo, abiertos.
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))
        open_rows = self._credits(member=member, applied=False)
        self.assertEqual(open_rows.count(), 1)
        self.assertEqual(open_rows.get().amount, Decimal("-30000.00"))

    def test_second_renewal_consumes_the_remainder(self):
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self._repriced(member, sub, Decimal("0.00"))
        Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=sub,
            concept="credit",
            amount=Decimal("-30000.00"),
            member_name=str(member),
            plan_name="Saldo a favor",
        )

        october = self._october(sub)
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))

        november = self._october(october)

        self.assertEqual(
            subscription_remaining_balance(november)["remaining"],
            Decimal("20000.00"),
        )
        self.assertEqual(member_credit_balance(member), Decimal("0.00"))

    def test_courtesy_member_overpayment_becomes_credit(self):
        """El caso del plan: $52.000 pagados y después el pase de cortesía.

        Antes la API respondía "pagó $0" sobre una suscripción con un pago de
        $52.000 y el excedente quedaba invisible. Ahora el pago real se ve, el
        período queda en 0 y el excedente es saldo a favor del socio.
        """
        member = self.create_member(self.gym)
        sub = self._open_september(member, settle=False)
        Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=sub,
            amount=Decimal("52000.00"),
            member_name=str(member),
            plan_name=self.plan.name,
        )
        sync_subscription_paid(sub)
        self.assertEqual(member_credit_balance(member), Decimal("2000.00"))

        member.is_comp = True
        member.save(update_fields=["is_comp"])
        self._repriced(member, sub, Decimal("0.00"))

        balance = subscription_remaining_balance(sub)

        self.assertEqual(balance["remaining"], Decimal("0"))
        self.assertEqual(balance["paid_amount"], Decimal("52000.00"))
        self.assertEqual(balance["overpayment"], Decimal("52000.00"))
        self.assertEqual(member_credit_balance(member), Decimal("52000.00"))

        sync_subscription_paid(sub)

        self.assertEqual(member_credit_balance(member), Decimal("52000.00"))

    def test_courtesy_member_never_consumes_credit(self):
        """Un cortesía no paga, así que no hay crédito que aplicarle."""
        member = self.create_member(self.gym)
        member.is_comp = True
        member.save(update_fields=["is_comp"])
        sub = self._open_september(member, settle=False)
        Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=sub,
            amount=self.PLAN_PRICE,
            member_name=str(member),
            plan_name=self.plan.name,
        )
        sync_subscription_paid(sub)
        self.assertEqual(member_credit_balance(member), self.PLAN_PRICE)

        new_sub = self._october(sub)

        self.assertEqual(member_credit_balance(member), self.PLAN_PRICE)
        self.assertEqual(
            self._credits(on_subscription=new_sub).count(), 0
        )

    def test_member_credit_balance_is_exposed_in_the_subscription_api(self):
        member = self.create_member(self.gym)
        sub = self._open_september(member)
        self._repriced(member, sub, Decimal("20000.00"))

        resp = self.client.get(f"/api/subscriptions/{sub.id}/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            resp.data["member_credit_balance"], "30000.00"
        )

    def test_credit_is_conserved_when_it_spans_two_periods(self):
        """El crédito se reparte entre dos períodos sin perder ni inventar un
        centavo.

        Invariante de Fase 7 (P4) y red permanente del fix de concurrencia:
        30.000 de crédito sobre dos períodos de 20.000. El primero se lleva
        20.000 y deja 10.000 abiertos en el origen; el segundo se lleva ese
        resto y lo mueve entero. Sea como sea el reparto, todas las filas de
        crédito del socio —aplicadas o todavía abiertas— siguen sumando
        -30.000. Ese total es exactamente lo que falla si dos aplicaciones
        leen el mismo crédito al mismo tiempo.
        """
        member = self.create_member(self.gym)
        # Un plan más barato que el de la clase: el crédito tiene que quedar
        # entre medio período y un período entero para que el uso sea parcial.
        cheap = self.create_plan(
            self.gym, name="Plan Chico", price=Decimal("20000.00")
        )
        sub = self.open_month_subscription(
            member,
            cheap,
            start_date=self.PERIOD_START,
            end_date=self.PERIOD_END,
        )
        self.settle_subscription(sub)

        Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=sub,
            amount=Decimal("30000.00"),
            payment_method="cash",
            member_name=str(member),
            plan_name=cheap.name,
        )
        sync_subscription_paid(sub)
        self.assertEqual(member_credit_balance(member), Decimal("30000.00"))

        october = create_next_subscription(sub)
        # Parcial: 20.000 aplicados, 10.000 todavía abiertos en el origen.
        self.assertEqual(member_credit_balance(member), Decimal("10000.00"))
        self.assertEqual(
            subscription_remaining_balance(october)["remaining"],
            Decimal("0.00"),
        )

        november = create_next_subscription(october)
        # El resto se aplica entero: el origen pasa a ser el período nuevo.
        self.assertEqual(member_credit_balance(member), Decimal("0.00"))
        # Y ese resto no alcanza para el mes: noviembre vale 20.000 y sólo
        # recibe 10.000 de crédito, así que sigue debiendo 10.000. Mismo
        # criterio que test_renewal_consumes_the_credit_and_lands_on_zero,
        # donde un crédito menor al total deja remaining = total - crédito.
        self.assertEqual(
            subscription_remaining_balance(november)["remaining"],
            Decimal("10000.00"),
        )

        self.assertEqual(
            Payment.objects.filter(
                member=member, concept="credit"
            ).aggregate(total=Sum("amount"))["total"],
            Decimal("-30000.00"),
        )


class SubscriptionListQueryCountTests(_MoneyBugBase):
    """El listado de suscripciones no puede costar más según cuántas haya.

    a06f6f2 (saldo a favor) dejó tres N+1 dentro de SubscriptionSerializer:
    ``credit_realized_for``, ``member_credit_balance`` y el ``exists()`` de
    ``is_first``. Con 226 suscripciones eran 557 queries contra una base
    remota: 85s, muy por encima del DEFAULT_TIMEOUT_MS del front, que abortaba
    el fetch y lo reportaba como error de red.

    El guard es "no escala", no un número absoluto: duplicar los socios tiene
    que dejar el conteo igual. Un ``assertNumQueries`` con número fijo se
    rompería con cada prefetch nuevo y no distingue un N+1 de un costo fijo.

    Los tests de equivalencia de los valores van aparte, en
    ``test_annotated_values_match_the_service_functions``.
    """

    PLAN_PRICE = Decimal("50000.00")

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.staff = self.create_user(self.gym)
        self.client.force_authenticate(user=self.staff)
        self.plan = self.create_plan(self.gym, price=self.PLAN_PRICE)

    def _member_with_history(self, index):
        """Socio con un período pagado, un crédito abierto y uno consumido.

        Los dos estados de crédito son los que separan
        ``credit_realized_for`` (applied_to puesto) de
        ``member_credit_balance`` (applied_to nulo). Con cero créditos los
        tests pasarían sin tocar ninguno de los dos caminos.
        """
        member = self.create_member(
            self.gym,
            first_name=f"Socio{index}",
            last_name="Historia",
            phone=f"11-{index:04d}-0000",
        )
        prev_start, prev_end = self.last_month_period()
        expired = self._settled_sub(member, self.plan, prev_start, prev_end)

        # Bajar el total de un período ya cobrado deja el sobrepago abierto.
        self._repriced(member, expired, Decimal("20000.00"))
        # La renovación siguiente se lleva ese crédito y deja saldo a favor.
        create_next_subscription(expired)
        return member

    def _list_subscriptions(self):
        """GET del listado, con el conteo de queries de esa llamada."""
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/subscriptions/")
        self.assertEqual(response.status_code, 200)
        return len(ctx), response

    def test_query_count_does_not_grow_with_subscription_count(self):
        for index in range(3):
            self._member_with_history(index)
        with_few, _ = self._list_subscriptions()

        for index in range(3, 9):
            self._member_with_history(index)
        with_many, response = self._list_subscriptions()

        self.assertEqual(
            with_few,
            with_many,
            f"el listado hizo {with_many} queries con el doble de socios "
            f"({with_few} con la mitad): volvió un N+1",
        )
        # Sanity: el listado devuelve todo, no una página recortada.
        self.assertEqual(
            len(response.data),
            Subscription.objects.filter(gym=self.gym).count(),
        )

    def test_annotated_values_match_the_service_functions(self):
        """El camino anotado tiene que dar lo mismo que el camino por fila.

        Cada campo se recalcula acá con el service sin argumentos, que es
        exactamente el código que las anotaciones reemplazan: si divergen, el
        listado estaría mintiendo sobre saldo, pago o estado.
        """
        self._member_with_history(1)
        _, response = self._list_subscriptions()
        rows = {row["id"]: row for row in response.data}
        self.assertTrue(rows)

        for sub in Subscription.objects.filter(gym=self.gym).select_related(
            "member",
            "member__discount",
        ):
            row = rows[sub.id]
            reference = subscription_remaining_balance(sub)
            reference_status = get_subscription_payment_status(
                sub,
                remaining=reference["remaining"],
            )
            self.assertEqual(
                row["paid_amount"],
                str(reference["paid_amount"]),
                f"paid_amount de la suscripción {sub.id}",
            )
            self.assertEqual(
                row["remaining"],
                str(reference["remaining"]),
                f"remaining de la suscripción {sub.id}",
            )
            self.assertEqual(
                row["member_credit_balance"],
                f"{member_credit_balance(sub.member):.2f}",
                f"member_credit_balance de la suscripción {sub.id}",
            )
            self.assertEqual(
                row["payment_status"],
                reference_status,
                f"payment_status de la suscripción {sub.id}",
            )

    def test_single_object_serialization_falls_back_without_annotations(self):
        """Sin queryset detrás, el serializer tiene que ir a los services.

        reopen() serializa lo que devuelve recover_member, una suscripción
        suelta sin las anotaciones de SubscriptionView. Si el serializer
        asumiera que llegan, ese endpoint devolvería 0 en vez de 30000.
        """
        member = self.create_member(self.gym, phone="11-9999-0000")
        sub = self._settled_sub(member, self.plan, *self.last_month_period())
        self._repriced(member, sub, Decimal("20000.00"))

        row = SubscriptionSerializer(sub).data

        self.assertEqual(row["member_credit_balance"], "30000.00")
        self.assertEqual(
            row["remaining"],
            str(subscription_remaining_balance(sub)["remaining"]),
        )
        self.assertEqual(
            row["payment_status"],
            get_subscription_payment_status(sub, remaining=Decimal("0")),
        )


@override_settings(
    SCHEDULED_TASKS_KEY="test-key",
    SCHEDULED_TASKS_INTERVAL_SECONDS=60,
)
class ScheduledTaskClaimTests(TransactionTestCase):
    """Fase 4: el claim atómico deja entrar a una sola corrida a la vez."""

    # La suite corre contra una base remota, así que una conexión estancada
    # tiene que romper el test en vez de colgar el proceso entero. Estos dos
    # son la red de seguridad para eso.
    BARRIER_TIMEOUT = 10
    JOIN_TIMEOUT = 30

    def _create_due_task_run(self):
        return TaskRun.objects.create(
            name=TASK_NAME,
            last_run=timezone.now() - timezone.timedelta(
                seconds=_task_interval_seconds() * 2
            ),
            last_status="ok",
        )

    def test_claim_is_rejected_the_second_time(self):
        """El guard del claim es el WHERE, no un lock: la segunda corrida
        del mismo intervalo matchea 0 filas y no renueva.

        Separate del test de hilos a propósito. Sin concurrencia, esto fija el
        WHERE como la única garantía; allá lo que suma es el lock de fila de
        Postgres, que impide que dos workers renueven a la vez.
        """
        self._create_due_task_run()

        first = run_scheduled_tasks()

        # ran=True no alcanza: run_scheduled_tasks se traga la excepción de
        # auto_renew_subscriptions y devuelve ran=True con status="error".
        # Sin esto, un renewal roto dejaría el test en verde.
        self.assertEqual(first["status"], "ok")
        self.assertTrue(first["ran"])

        second = run_scheduled_tasks()

        self.assertFalse(second["ran"])
        self.assertEqual(second["reason"], "not_due")

    def test_second_concurrent_worker_does_not_claim(self):
        self._create_due_task_run()

        barrier = threading.Barrier(2)
        results = [None, None]
        errors = [None, None]

        def worker(idx):
            try:
                barrier.wait(timeout=self.BARRIER_TIMEOUT)
                results[idx] = run_scheduled_tasks()
            except Exception as exc:  # pragma: no cover - defensivo
                errors[idx] = exc
            finally:
                # El teardown dropea test_neondb, y Postgres rechaza el DROP
                # si queda alguna sesión viva ("database is being accessed by
                # other users"). Django cierra las conexiones del hilo principal
                # al terminar, pero no las que abriron estos workers. Sin este
                # close_all las 2 sesiones sobreviven y el DROP falla con
                # ObjectInUse, aunque los 54 tests hayan pasado. En SQLite no
                # se nota porque no hay DROP: el archivo se borra del disco
                # aunque queden descriptores abiertos.
                connections.close_all()

        t1 = threading.Thread(target=worker, args=(0,))
        t2 = threading.Thread(target=worker, args=(1,))
        t1.start()
        t2.start()
        t1.join(timeout=self.JOIN_TIMEOUT)
        t2.join(timeout=self.JOIN_TIMEOUT)

        # join con timeout no mata el hilo, sólo deja de esperarlo. Si
        # alguno quedó vivo, results[idx] sigue en None y las aserciones de
        # abajo petarían con un TypeError que no dice nada.
        self.assertFalse(t1.is_alive(), "worker 0 no terminó a tiempo")
        self.assertFalse(t2.is_alive(), "worker 1 no terminó a tiempo")

        self.assertIsNone(errors[0], errors[0])
        self.assertIsNone(errors[1], errors[1])
        self.assertEqual(sorted(r["ran"] for r in results), [False, True])

        loser = next(r for r in results if not r["ran"])
        self.assertEqual(loser["reason"], "not_due")

        run = TaskRun.objects.get(name=TASK_NAME)
        self.assertEqual(run.last_status, "ok")


class CreditConsumptionConcurrencyTests(TransactionTestCase):
    """Dos aplicaciones del mismo crédito se serializan sobre la fila.

    Deliberadamente determinista. La versión ingenua de este test sería poner
    dos hilos a cruzar el crédito al mismo tiempo y esperar que choquen en la
    ventana entre el SELECT y el UPDATE, pero esa ventana es de microsegundos
    y en CI no se hitpea siempre: el test pasa sin ejercitar nada. Así que acá
    el hilo principal hace de primera aplicación y deja la fila escrita pero
    sin commitear, que es justo lo que hace la rama de uso parcial.

    Sin el lock: la segunda lee el monto viejo (-30.000), calcula 20.000 de
    consumo contra un crédito al que ya le sacaron 20.000, y deja el período
    cuadrado con plata que no existe. Con el lock: se clava en el SELECT FOR
    UPDATE, espera al commit, y lee el -10.000 real, consumiendo 10.000.

    La diferencia es observable en el ``consumed`` que devuelve, así que el
    assert no depende de timing.
    """

    BARRIER_TIMEOUT = 10
    JOIN_TIMEOUT = 30
    # Margen para confirmar que el worker sigue bloqueado. Al revés del
    # JOIN_TIMEOUT, acá que el hilo demore en arrancar no rompe nada: sólo se
    # pide que NO haya terminado.
    BLOCK_PROBE = 1.5

    PLAN_PRICE = Decimal("20000.00")
    CREDIT = Decimal("30000.00")
    # Lo que la primera aplicación (el hilo principal) ya se llevó, dejando
    # este resto abierto en el origin.
    LEFT_OPEN = Decimal("10000.00")

    def _fixtures(self):
        """Un socio con 30.000 de crédito abierto y un período de 20.000."""
        gym = Gym.objects.create(name="Test Gym", slug="test-gym")
        service = Service.get_default_for_gym(gym)
        plan = MembershipPlan.objects.create(
            gym=gym,
            service=service,
            name="Plan",
            price=self.PLAN_PRICE,
            duration_days=30,
            is_base=False,
        )
        member = Member.objects.create(
            gym=gym, first_name="Ana", last_name="Gomez", phone="11-ana"
        )
        september = SubscriptionDomain.open_subscription(
            member=member,
            plan=plan,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 30),
        )
        # Se paga el total más el sobrepago: el crédito es la diferencia.
        Payment.objects.create(
            gym=gym,
            member=member,
            subscription=september,
            amount=self.PLAN_PRICE + self.CREDIT,
            payment_method="cash",
            member_name=str(member),
            plan_name=plan.name,
        )
        sync_subscription_paid(september)

        october = SubscriptionDomain.open_subscription(
            member=member,
            plan=plan,
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 31),
        )
        self.assertEqual(
            member_credit_balance(member), self.CREDIT
        )
        return member, october

    def test_second_application_waits_and_sees_the_committed_amount(self):
        member, october = self._fixtures()
        member_pk, october_pk = member.pk, october.pk

        started = threading.Event()
        finished = threading.Event()
        consumed = []
        errors = []

        def worker():
            try:
                started.set()
                consumed.append(
                    consume_member_credit(
                        Member.objects.get(pk=member_pk),
                        Subscription.objects.get(pk=october_pk),
                    )
                )
            except Exception as exc:  # pragma: no cover - defensivo
                errors.append(exc)
            finally:
                # Sin esto el teardown dropea test_neondb con la sesión del
                # worker viva y Postgres responde ObjectInUse.
                connections.close_all()
                finished.set()

        with transaction.atomic():
            credit = Payment.objects.select_for_update().filter(
                member_id=member_pk,
                concept="credit",
                applied_to__isnull=True,
            ).get()
            # Exactamente lo que escribe la rama de uso parcial: el origin
            # queda en el leftover, todavía abierto.
            credit.amount = -self.LEFT_OPEN
            credit.save(update_fields=["amount"])

            t = threading.Thread(target=worker)
            t.start()
            started.wait(timeout=self.BARRIER_TIMEOUT)

            self.assertFalse(
                finished.wait(timeout=self.BLOCK_PROBE),
                "consume_member_credit no esperó al lock de la fila de crédito",
            )

        # Salir del atomic commitea y libera el lock.
        self.assertTrue(
            finished.wait(timeout=self.JOIN_TIMEOUT),
            "el worker no terminó después de liberar el lock",
        )
        t.join(timeout=self.JOIN_TIMEOUT)
        self.assertFalse(t.is_alive(), "el worker quedó vivo")

        self.assertEqual(errors, [])

        # El assert que separa el fix de la carrera: 10.000, no 20.000.
        self.assertEqual(consumed, [self.LEFT_OPEN])

        rows = Payment.objects.filter(
            member_id=member_pk, concept="credit"
        )
        self.assertEqual(rows.count(), 1)
        self.assertEqual(
            rows.aggregate(total=Sum("amount"))["total"], -self.LEFT_OPEN
        )
        self.assertEqual(
            member_credit_balance(Member.objects.get(pk=member_pk)),
            Decimal("0.00"),
        )
