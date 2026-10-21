"""Fase J — REF-07: los listados de asistencia no deben ser N+1.

El listado semanal/estado arma el rótulo de servicio de cada socio con
``member_service_label``, que recorre ``member.subscription_set`` y accede a
``plan.service``. Sin prefetch eso son varias queries por socio; con el
prefetch queda un número fijo de queries sin importar cuántos inscriptos haya.

El test compara el conteo de queries con 1 inscripto contra 6: si el número
crece con N, es un N+1 (rojo). Con el fix los dos conteos son iguales.
"""

from datetime import time
from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.test import override_settings

from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from plans.models import Service


WEEKLY_URL = "/api/attendance/weekly/"
STATUS_URL = "/api/attendance/status/"


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class AttendanceListQueryCountTests(BaseAPITest):
    """El conteo de queries del listado semanal no crece con los inscriptos."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "activities": True}
        self.gym.save(update_fields=["features"])

    def _enroll(self, gym, n):
        """Crea una actividad con `n` inscriptos activos (cada uno con plan)."""
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(gym),
            name=f"Actividad {n}",
            billing_mode="monthly",
            monthly_price=Decimal("3000.00"),
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=20,
        )
        for i in range(n):
            member = self.create_member(
                gym, first_name=f"Socio{i}", phone=f"11-n{n}-{i}"
            )
            plan = self.create_plan(gym, name=f"Plan {n}-{i}")
            self.open_month_subscription(member, plan)
            Enrollment.objects.create(
                gym=gym,
                member=member,
                schedule=schedule,
                modality="monthly",
                active=True,
            )
        return activity

    def _count_queries(self, url):
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200, resp.data)
        return len(ctx.captured_queries)

    def test_weekly_query_count_does_not_grow_with_enrollments(self):
        user = self.create_user(self.gym, username="staffuser", role="staff")
        self.client.force_authenticate(user=user)

        self._enroll(self.gym, 1)
        one = self._count_queries(WEEKLY_URL)

        self._enroll(self.gym, 5)
        six = self._count_queries(WEEKLY_URL)

        self.assertEqual(
            one,
            six,
            f"N+1 en {WEEKLY_URL}: con 1 inscripto fueron {one} queries y con 6 "
            f"fueron {six}; el conteo no debe crecer con los inscriptos.",
        )

    def test_status_query_count_does_not_grow_with_enrollments(self):
        user = self.create_user(self.gym, username="staffuser2", role="staff")
        self.client.force_authenticate(user=user)

        # El listado de estado sólo mira las clases que cubren una hora
        # seleccionada; 09:30 cae dentro del bloque 09:00–10:00 del fixture.
        url = f"{STATUS_URL}?day=monday&hour=09:30"

        self._enroll(self.gym, 1)
        one = self._count_queries(url)

        self._enroll(self.gym, 5)
        six = self._count_queries(url)

        self.assertEqual(
            one,
            six,
            f"N+1 en {STATUS_URL}: con 1 inscripto fueron {one} queries y con "
            f"6 fueron {six}; el conteo no debe crecer con los inscriptos.",
        )
