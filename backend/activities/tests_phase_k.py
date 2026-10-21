"""Fase K1 — portal del socio.

Cubre ``ACC-26``: el portal del socio no puede darse de baja de una
inscripción de actividad. El botón "Cancelar inscripción" hace POST al
endpoint público de **alta**, así que la baja nunca existió en la API
pública y el socio siempre recibía 409 "ya está inscripto en este horario".

Corre contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from datetime import time
from decimal import Decimal

from activities.enrollment_service import EnrollmentService
from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from plans.models import Service
from subscriptions.models import SubscriptionItem


class Acc26PublicUnenrollTests(BaseAPITest):
    """ACC-26: el socio puede darse de baja de una actividad desde el portal."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "activities": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="monthly",
            monthly_price=Decimal("5000.00"),
        )
        self.schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.url = f"/api/activities/public/{self.member.access_token}/"

    def _open_paid_subscription(self):
        plan = self.create_plan(self.gym, price=Decimal("10000.00"))
        subscription = self.open_month_subscription(self.member, plan)
        self.settle_subscription(subscription)
        return subscription

    def _enroll_directly(self):
        return EnrollmentService.enroll_member(
            self.member, self.schedule, skip_eligibility_check=True
        )

    def _unenroll(self, schedule_id=None, url=None):
        payload = {}
        if schedule_id is not None:
            payload["schedule_id"] = schedule_id
        return self.client.delete(
            url or self.url,
            data=payload,
            content_type="application/json",
            HTTP_ACCEPT="application/json",
        )

    def test_member_can_unenroll_through_the_public_api(self):
        enrollment = self._enroll_directly()

        resp = self._unenroll(schedule_id=self.schedule.id)

        self.assertEqual(resp.status_code, 200)
        enrollment.refresh_from_db()
        self.assertFalse(enrollment.active)

    def test_unenroll_removes_the_enrollment_from_the_portal_list(self):
        self._enroll_directly()

        resp = self._unenroll(schedule_id=self.schedule.id)
        self.assertEqual(resp.status_code, 200)

        listing = self.client.get(self.url, HTTP_ACCEPT="application/json")

        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data, [])

    def test_unenroll_cancels_the_activity_item_of_the_subscription(self):
        subscription = self._open_paid_subscription()
        self._enroll_directly()
        item = SubscriptionItem.objects.get(
            subscription=subscription, activity=self.activity
        )
        self.assertEqual(item.status, "active")

        resp = self._unenroll(schedule_id=self.schedule.id)

        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.status, "cancelled")

    def test_unenroll_without_schedule_id_returns_400(self):
        self._enroll_directly()

        resp = self._unenroll()

        self.assertEqual(resp.status_code, 400)

    def test_unenroll_of_a_schedule_from_another_gym_returns_404(self):
        other_gym = self.create_gym(name="Other Gym")
        other_activity = Activity.objects.create(
            service=Service.get_default_for_gym(other_gym),
            name="Pilates",
            billing_mode="monthly",
            monthly_price=Decimal("5000.00"),
        )
        other_schedule = ActivitySchedule.objects.create(
            activity=other_activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

        resp = self._unenroll(schedule_id=other_schedule.id)

        self.assertEqual(resp.status_code, 404)

    def test_unenroll_without_an_active_enrollment_returns_404(self):
        resp = self._unenroll(schedule_id=self.schedule.id)

        self.assertEqual(resp.status_code, 404)

    def test_unenroll_with_an_unknown_token_returns_404(self):
        self._enroll_directly()

        resp = self._unenroll(
            schedule_id=self.schedule.id,
            url="/api/activities/public/token-inexistente/",
        )

        self.assertEqual(resp.status_code, 404)

    def test_unenroll_of_a_sessions_billing_activity_returns_403(self):
        sessions_activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        sessions_schedule = ActivitySchedule.objects.create(
            activity=sessions_activity,
            day="tuesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        EnrollmentService.enroll_member(
            self.member,
            sessions_schedule,
            skip_eligibility_check=True,
            modality="package",
            package_total_sessions=10,
            session_price=Decimal("2500.00"),
        )

        resp = self._unenroll(schedule_id=sessions_schedule.id)

        self.assertEqual(resp.status_code, 403)
        self.assertTrue(
            Enrollment.objects.filter(
                member=self.member, schedule=sessions_schedule, active=True
            ).exists()
        )

    def test_unenroll_is_allowed_when_the_member_cannot_operate(self):
        # Decisión 2026-10-21: darse de baja nunca está penalizado. El
        # frontend bloquea el botón del socio suspendido, pero la API
        # responde igual: si el socio tiene una inscripción viva y quiere
        # salir, se lo deja.
        self._enroll_directly()
        self.member.active = False
        self.member.save(update_fields=["active"])

        resp = self._unenroll(schedule_id=self.schedule.id)

        self.assertEqual(resp.status_code, 200)

    def test_unenroll_of_a_deactivated_schedule_still_works(self):
        # Si el gym desactiva la actividad, el socio que sigue inscripto
        # tiene que poder salir: el botón "Cancelar" no se esconde.
        self._enroll_directly()
        ActivitySchedule.objects.filter(pk=self.schedule.pk).update(active=False)

        resp = self._unenroll(schedule_id=self.schedule.id)

        self.assertEqual(resp.status_code, 200)
        self.assertFalse(
            Enrollment.objects.filter(
                member=self.member, schedule=self.schedule, active=True
            ).exists()
        )
