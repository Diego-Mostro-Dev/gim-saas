import hashlib
import json
from datetime import date, time, timedelta
from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from rest_framework.authtoken.models import Token

from core.testing import BaseAPITest

from attendance.models import AttendanceSchedule
from gyms.models import Discount
from members.models import Member
from members.serializers import MemberSerializer
from outings.models import Outing, OutingEnrollment, OutingSchedule
from plans.models import MembershipPlan, Service
from subscriptions.models import PlanChangeRequest, Subscription
from subscriptions.services import get_first_day_of_next_month, get_last_day_of_month


def _create_outing_package_debt(gym, member):
    """Paquete de salidas con saldo pendiente: deuda que no es suscripción.

    Espeja lo que ``member_total_outstanding_debt`` suma vía
    ``member_outing_package_debt``: activo, modality="package", con
    ``session_price`` y ``amount_paid < total``.
    """
    outing = Outing.objects.create(
        gym=gym,
        service=Service.get_default_for_gym(gym),
        name="Trail",
    )
    schedule = OutingSchedule.objects.create(
        outing=outing,
        day="monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        capacity=10,
    )
    return OutingEnrollment.objects.create(
        gym=gym,
        member=member,
        schedule=schedule,
        modality="package",
        package_total_sessions=10,
        session_price=Decimal("2500.00"),
        amount_paid=Decimal("0"),
    )


class MemberCreateTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)

    def test_staff_creates_member_with_plan_and_schedule(self):
        plan = self.create_plan(self.gym)
        self.client.force_authenticate(user=self.user)

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Ana",
                "last_name": "Gomez",
                "phone": "112233",
                "document_number": "12345678",
                "date_of_birth": "1990-05-04",
                "services": json.dumps(["gym"]),
                "schedules": json.dumps(
                    [{"day": self.slot.day, "hour": "10:00"}]
                ),
                "plan_id": plan.id,
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201)

        member = Member.objects.get(phone="112233")
        self.assertTrue(member.active)
        self.assertTrue(member.access_token)

        sub = Subscription.objects.get(member=member)
        self.assertEqual(sub.plan, plan)
        self.assertIsNotNone(sub.items.filter(item_type="plan").first())

    def test_staff_creates_member_without_schedules_rejected(self):
        self.client.force_authenticate(user=self.user)

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Bob",
                "last_name": "Loblaw",
                "phone": "223344",
                "services": json.dumps(["gym"]),
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 400)

    def test_member_list_excludes_access_token(self):
        self.create_member(self.gym)
        self.client.force_authenticate(user=self.user)

        resp = self.client.get("/api/members/")

        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("access_token", resp.data[0])

    def test_discount_from_other_gym_is_rejected(self):
        """REF-06: el validador debe correr sobre `discount_id` (no `discount`).

        El campo se llama `discount_id` con `source="discount"`, así que DRF
        busca `validate_discount_id`; el método viejo `validate_discount` era
        código muerto y el descuento de otro gimnasio se aceptaba.
        """
        self.client.force_authenticate(user=self.user)
        plan = self.create_plan(self.gym)
        other_gym = self.create_gym(name="Otro Gym")
        foreign_discount = Discount.objects.create(
            gym=other_gym, name="Ajeno", discount_percent=10
        )

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Ana",
                "last_name": "Gomez",
                "phone": "119999",
                "document_number": "12345670",
                "date_of_birth": "1990-05-04",
                "services": json.dumps(["gym"]),
                "schedules": json.dumps(
                    [{"day": self.slot.day, "hour": "10:00"}]
                ),
                "plan_id": plan.id,
                "discount_id": foreign_discount.id,
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("discount_id", resp.data)

    def test_own_active_discount_is_accepted(self):
        self.client.force_authenticate(user=self.user)
        plan = self.create_plan(self.gym)
        discount = Discount.objects.create(
            gym=self.gym, name="Amigo", discount_percent=50
        )

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Ana",
                "last_name": "Gomez",
                "phone": "118888",
                "document_number": "12345679",
                "date_of_birth": "1990-05-04",
                "services": json.dumps(["gym"]),
                "schedules": json.dumps(
                    [{"day": self.slot.day, "hour": "10:00"}]
                ),
                "plan_id": plan.id,
                "discount_id": discount.id,
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="118888")
        self.assertEqual(member.discount, discount)


class IsRecoverableTests(BaseAPITest):

    def test_limbo_member_is_recoverable(self):
        """active=True, expired sub, no debt -> recoverable (the fix)."""
        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        sub = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(sub)

        self.assertTrue(member.active)

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertTrue(serializer.data["is_recoverable"])

    def test_limbo_member_settled_with_credit_is_recoverable(self):
        """El crédito consumido por el período es pagado, no deuda.

        Regresión de get_is_recoverable: no restaba el crédito ya realizado,
        así que un socio que saldó el mes con saldo a favor quedaba con deuda
        ficticia y sin botón "recuperar", mientras recover_member() lo
        aceptaba. El primer assert ancla el invariante real —el badge no puede
        contradecir al servicio de deuda— para que la regresión no vuelva a
        colarse por el camino de una de las dos copias de la regla.
        """
        # Imports locales como en core/testing.py: payments <-> subscriptions
        # se importan uno al otro y así se evita el ciclo a nivel de módulo.
        from payments.models import Payment
        from subscriptions.services import (
            calculate_subscription_total,
            consume_member_credit,
            member_total_outstanding_debt,
            sync_subscription_paid,
        )

        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        # Dos meses atrás pagado de más: así queda saldo a favor abierto.
        prev_start, prev_end = self.last_month_period()
        anteprev_end = prev_start.replace(day=1) - timedelta(days=1)
        old_sub = self.open_month_subscription(
            member, plan,
            start_date=anteprev_end.replace(day=1),
            end_date=anteprev_end,
            origin="onboarding",
        )
        total = calculate_subscription_total(old_sub)
        Payment.objects.create(
            gym=gym,
            member=member,
            subscription=old_sub,
            amount=total + Decimal("10000.00"),
            payment_method="cash",
            member_name=str(member),
            plan_name=plan.name,
        )
        sync_subscription_paid(old_sub)

        # El mes pasado consume ese saldo: su período queda saldado sin un
        # solo peso en pagos directos, solo con crédito.
        sub = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="renewal",
        )
        consumed = consume_member_credit(member, sub)
        self.assertEqual(consumed, calculate_subscription_total(sub))

        self.assertFalse(member_total_outstanding_debt(member)["total"] > 0)

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertTrue(serializer.data["is_recoverable"])

    def test_healthy_member_is_not_recoverable(self):
        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)
        sub = self.open_month_subscription(member, plan)
        self.settle_subscription(sub)

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])

    def test_limbo_member_with_debt_is_not_recoverable(self):
        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])

    def test_inactive_member_without_subscription_not_recoverable(self):
        gym = self.create_gym()
        member = self.create_member(gym)
        member.active = False
        member.save(update_fields=["active"])

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])


class RecoveryEndpointTests(BaseAPITest):

    def test_recover_limbo_member_creates_recovery_subscription(self):
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        expired = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(expired)

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["origin"], "recovery")
        member.refresh_from_db()
        self.assertTrue(member.active)

        new_sub = Subscription.objects.filter(
            member=member, origin="recovery",
        ).first()
        self.assertIsNotNone(new_sub)
        self.assertEqual(new_sub.plan, plan)

    def test_recover_member_with_debt_rejected(self):
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("deuda pendiente", resp.data["detail"])

    def test_recover_member_with_future_subscription_rejected(self):
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        expired = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(expired)

        # A genuinely-future subscription: next calendar month after today.
        this_month = date.today().replace(day=1)
        future_start = get_first_day_of_next_month(this_month)
        future_end = get_last_day_of_month(future_start)
        future = self.open_month_subscription(
            member, plan,
            start_date=future_start,
            end_date=future_end,
            origin="onboarding",
        )
        self.settle_subscription(future)

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("futura", resp.data["detail"])

    def test_member_with_only_outing_debt_is_not_recoverable(self):
        """P24: la deuda de salidas cuenta. Badge y POST coinciden.

        ``get_is_recoverable`` omitía ``outing_enrollments``, así que un socio
        cuyo único pendiente era un paquete de salidas mostraba el botón
        "recuperar" y el POST respondía 400 "deuda pendiente".
        """
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        expired = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(expired)
        _create_outing_package_debt(gym, member)

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("deuda pendiente", resp.data["detail"])

    def test_inactive_member_with_current_and_future_is_recoverable(self):
        """P24: la precedencia vigente/futura se invierte como recover_member.

        Con un período vigente saldado y otro futuro saldado, ``recover_member``
        reactiva al socio (Case A) antes de mirar el futuro. El serializer
        cortaba por ``has_future`` y ocultaba el botón.
        """
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        current = self.open_month_subscription(member, plan)
        self.settle_subscription(current)

        this_month = date.today().replace(day=1)
        future_start = get_first_day_of_next_month(this_month)
        future_end = get_last_day_of_month(future_start)
        future = self.open_month_subscription(
            member, plan,
            start_date=future_start,
            end_date=future_end,
            origin="onboarding",
        )
        self.settle_subscription(future)

        member.active = False
        member.save(update_fields=["active"])

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertTrue(serializer.data["is_recoverable"])

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        # Hay una suscripción vigente, así que es reactivación (Caso A):
        # Fase F (DIN-12) responde 200, no 201, porque no crea nada.
        self.assertEqual(resp.status_code, 200)
        member.refresh_from_db()
        self.assertTrue(member.active)

    def test_member_with_approved_plan_change_is_recoverable(self):
        """P24: el plan se resuelve con _resolve_plan, no con latest_sub.plan.

        El serializer miraba ``latest_sub.plan.is_base``; ``recover_member``
        honra un PCR aprobado. Con base expirada + PCR a un plan no-base, el
        POST procede y el badge no.
        """
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)

        base = MembershipPlan.objects.create(
            gym=gym,
            service=Service.get_default_for_gym(gym),
            name="Base",
            price=Decimal("0.00"),
            duration_days=30,
            is_base=True,
        )
        target = self.create_plan(gym, name="Premium")

        prev_start, prev_end = self.last_month_period()
        expired = self.open_month_subscription(
            member, base,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(expired)

        PlanChangeRequest.objects.create(
            gym=gym,
            member=member,
            requested_plan=target,
            current_schedules_snapshot=[],
            target_schedules_snapshot=[],
            status="approved",
            effective_date=date.today(),
        )

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertTrue(serializer.data["is_recoverable"])

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        new_sub = Subscription.objects.get(member=member, origin="recovery")
        self.assertEqual(new_sub.plan, target)


class PublicRegisterSecurityTests(BaseAPITest):
    """P0-1: el registro público no puede auto-otorgarse beneficios.

    is_comp y descuentos son privilegios que solo el staff puede asignar
    después del alta; el onboarding anónimo debe ignorarlos/forzarlos.
    """

    def _phone(self, suffix=""):
        """Teléfono válido para el test en curso, único por método.

        Antes era f"11-{self._testMethodName}", que con el nombre más largo
        de esta clase daba 48 caracteres y reventaba contra el max_length=30
        de Member.phone. Peor: el 400 que devolvía era indistinguible del que
        estos tests assertan, así que la regresión de campos obligatorios
        quedó escondida detrás de un error de fixture.
        """
        digest = hashlib.md5(self._testMethodName.encode()).hexdigest()[:12]
        return f"11-{digest}{suffix}"

    def _register_payload(self, gym, plan_id=None, **overrides):
        payload = {
            "first_name": "Luz",
            "last_name": "Pérez",
            "phone": self._phone(),
            "document_number": "12345678",
            "date_of_birth": "1990-05-04",
            "services": ["gym"],
            "schedules": [{"day": self.weekday_name(), "hour": "10:00"}],
        }
        if plan_id is not None:
            payload["plan_id"] = plan_id
        payload.update(overrides)
        return payload

    def test_anonymous_cannot_grant_comp_without_plan(self):
        gym = self.create_gym()
        self.create_today_slot(gym)

        resp = self.client.post(
            f"/api/public/register/{gym.onboarding_code}/",
            self._register_payload(gym, is_comp=True),
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("plan", resp.data["plan_id"])

    def test_anonymous_is_comp_forced_false_with_plan(self):
        gym = self.create_gym()
        self.create_today_slot(gym)
        plan = self.create_plan(gym)

        resp = self.client.post(
            f"/api/public/register/{gym.onboarding_code}/",
            self._register_payload(gym, plan_id=plan.id, is_comp=True),
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertFalse(resp.data["is_comp"])
        member = Member.objects.get(phone=self._phone())
        self.assertFalse(member.is_comp)
        self.assertTrue(member.active)
        self.assertEqual(Subscription.objects.get(member=member).plan, plan)

    def test_anonymous_discount_ignored(self):
        gym = self.create_gym()
        self.create_today_slot(gym)
        plan = self.create_plan(gym)
        discount = Discount.objects.create(
            gym=gym,
            name="Amigo",
            discount_percent=50,
        )
        other_gym = self.create_gym(name="Otro Gym")
        foreign_discount = Discount.objects.create(
            gym=other_gym,
            name="Ajeno",
            discount_percent=10,
        )

        # El teléfono va por override en vez de quedar fijo en el payload: el
        # assert busca al socio con el sufijo del descuento, y además cada
        # iteración necesita uno distinto o la segunda rebota con 400 por
        # teléfono duplicado. Antes el assert y el payload armaban cadenas
        # distintas, algo que solo se vio al destapar el 400 de max_length.
        for discount_id in [discount.id, foreign_discount.id]:
            phone = self._phone(f"-{discount_id}")
            resp = self.client.post(
                f"/api/public/register/{gym.onboarding_code}/",
                self._register_payload(
                    gym, plan_id=plan.id, phone=phone,
                    discount_id=discount_id,
                ),
                format="json",
            )
            self.assertEqual(resp.status_code, 201)
            member = Member.objects.get(phone=phone)
            self.assertIsNone(member.discount)


class MemberDestroyProtectionTests(BaseAPITest):
    """P12 — borrar un socio con pagos responde 409, nunca 500.

    ``Payment.subscription`` es ``PROTECT``: borrar el socio cascadea a sus
    suscripciones, y una con pagos levanta ``ProtectedError``. El viewset lo
    traduce a 409 para no devolver un 500 sin cuerpo.
    """

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)

    def _member_with_payment(self):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=month_start,
            end_date=get_last_day_of_month(month_start),
        )
        self.settle_subscription(sub)
        return sub

    def test_delete_member_with_payments_returns_409(self):
        self._member_with_payment()

        resp = self.client.delete(
            f"/api/members/{self.member.id}/",
            HTTP_ACCEPT="application/json",
        )

        self.assertEqual(resp.status_code, 409)
        self.assertTrue(Member.objects.filter(pk=self.member.pk).exists())

    def test_delete_member_without_payments_succeeds(self):
        resp = self.client.delete(
            f"/api/members/{self.member.id}/",
            HTTP_ACCEPT="application/json",
        )

        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Member.objects.filter(pk=self.member.pk).exists())


class MemberListQueryBudgetTests(BaseAPITest):
    """Regresión anti-N+1 para GET /api/members/.

    El listado no debe emitir queries proporcionales al número de socios:
    ``get_is_recoverable`` se resuelve con precomputación bulk vía contexto
    (``gym_debtor_member_ids`` + ``gym_approved_plan_change_plan``).
    """

    def _build_gym(self, member_count):
        gym = self.create_gym(name=f"Gym {member_count}")
        user = self.create_user(gym, username=f"owner{member_count}")
        plan = self.create_plan(gym)
        prev_start, prev_end = self.last_month_period()
        for i in range(member_count):
            member = self.create_member(gym, phone=f"1{i:07d}")
            sub = self.open_month_subscription(
                member,
                plan,
                start_date=prev_start,
                end_date=prev_end,
                origin="onboarding",
            )
            self.settle_subscription(sub)
        return gym, user

    def test_member_list_query_count_does_not_scale_with_members(self):
        gym_small, user_small = self._build_gym(5)
        gym_big, user_big = self._build_gym(25)

        self.client.force_authenticate(user=user_small)
        with CaptureQueriesContext(connection) as small_ctx:
            resp_small = self.client.get("/api/members/")
        self.assertEqual(resp_small.status_code, 200)
        self.assertEqual(len(resp_small.data), 5)

        self.client.force_authenticate(user=user_big)
        with CaptureQueriesContext(connection) as big_ctx:
            resp_big = self.client.get("/api/members/")
        self.assertEqual(resp_big.status_code, 200)
        self.assertEqual(len(resp_big.data), 25)

        small_queries = len(small_ctx.captured_queries)
        big_queries = len(big_ctx.captured_queries)
        # Tolerancia mínima: los helpers bulk usan #queries fijo, no por socio.
        self.assertLessEqual(
            abs(big_queries - small_queries),
            2,
            f"El listado emitió {small_queries} q para 5 socios y "
            f"{big_queries} q para 25: hay un N+1.",
        )
        # Umbral razonable absoluto para el listado completo.
        self.assertLessEqual(
            big_queries,
            35,
            f"El listado emitió {big_queries} queries: esperaba un presupuesto fijo.",
        )

    def test_member_list_is_recoverable_matches_fallback(self):
        """Paridad: la ruta bulk (vista) == la ruta por-socio (fallback)."""
        from members.serializers import MemberSerializer

        gym, user = self._build_gym(3)

        self.client.force_authenticate(user=user)
        resp = self.client.get("/api/members/")
        self.assertEqual(resp.status_code, 200)

        by_id = {row["id"]: row["is_recoverable"] for row in resp.data}
        members = Member.objects.filter(gym=gym)
        for member in members:
            fallback = MemberSerializer(member, context={"gym": gym})
            self.assertEqual(
                by_id[member.id],
                fallback.data["is_recoverable"],
                f"is_recoverable diverge para miembro {member.id}",
            )


class MemberWeeklyVisitsValidationTests(BaseAPITest):
    """CFG-12: el alta no puede asignar más horarios que los del plan.

    Sin esta validación un socio quedaba con más franjas que visitas
    permitidas: el gimnasio regalaba visitas extra todo el mes.
    """

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.slot = self.create_today_slot(self.gym, hour="10:00")

    def _payload(self, plan_id, schedules, phone):
        return {
            "first_name": "Ana",
            "last_name": "Gomez",
            "phone": phone,
            "document_number": "12345678",
            "date_of_birth": "1990-05-04",
            "services": json.dumps(["gym"]),
            "schedules": json.dumps(schedules),
            "plan_id": plan_id,
        }

    def test_alta_rejects_more_schedules_than_the_plan(self):
        plan = self.create_plan(self.gym, weekly_visits=1)
        second = self.create_today_slot(self.gym, hour="12:00")
        schedules = [
            {"day": self.slot.day, "hour": "10:00"},
            {"day": second.day, "hour": "12:00"},
        ]

        resp = self.client.post(
            "/api/members/",
            self._payload(plan.id, schedules, "112233"),
            format="multipart",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("schedules", resp.data)
        self.assertFalse(Member.objects.filter(phone="112233").exists())
        self.assertEqual(AttendanceSchedule.objects.count(), 0)

    def test_alta_accepts_schedules_up_to_the_limit(self):
        plan = self.create_plan(self.gym, weekly_visits=1)
        schedules = [{"day": self.slot.day, "hour": "10:00"}]

        resp = self.client.post(
            "/api/members/",
            self._payload(plan.id, schedules, "445566"),
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="445566")
        self.assertEqual(
            AttendanceSchedule.objects.filter(member=member).count(), 1
        )
