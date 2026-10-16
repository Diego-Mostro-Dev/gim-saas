"""Smoke tests de las vistas públicas de salidas.

Cubren ``_available_outings`` (el cálculo que arma el portal del socio) y,
en particular, que la cantidad de queries no escale con la cantidad de
socios inscriptos: es la vista que se tocó en Fase 7 y que hasta ahora no
tenía red de seguridad en CI.
"""

from datetime import time

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from core.testing import BaseAPITest
from outings.models import Outing, OutingEnrollment, OutingSchedule
from plans.models import Service


class PublicAvailableOutingsTests(BaseAPITest):
    def setUp(self):
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "salidas": True}
        self.gym.save(update_fields=["features"])

        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trail",
            billing_mode="monthly",
        )
        self.schedule = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.member = self.create_member(self.gym)
        self.url = reverse(
            "outing-member-public-list",
            kwargs={"token": self.member.access_token},
        )

    def _available_schedules(self):
        resp = self.client.get(self.url, HTTP_ACCEPT="application/json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["available_outings"]), 1)
        return data["available_outings"][0]["schedules"]

    def test_available_outings_smoke(self):
        schedules = self._available_schedules()

        self.assertEqual(len(schedules), 1)
        self.assertEqual(schedules[0]["id"], self.schedule.id)
        self.assertEqual(schedules[0]["available_spots"], 10)

    def test_available_spots_discounts_enrolled_members(self):
        other = self.create_member(self.gym, first_name="Otro")
        OutingEnrollment.objects.create(
            gym=self.gym,
            member=other,
            schedule=self.schedule,
        )

        schedules = self._available_schedules()

        self.assertEqual(schedules[0]["available_spots"], 9)

    def test_full_schedule_is_hidden(self):
        for i in range(10):
            member = self.create_member(self.gym, first_name=f"Lleno{i}")
            OutingEnrollment.objects.create(
                gym=self.gym,
                member=member,
                schedule=self.schedule,
            )

        resp = self.client.get(self.url, HTTP_ACCEPT="application/json")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["available_outings"], [])

    def test_query_count_is_flat_as_members_grow(self):
        accept = {"HTTP_ACCEPT": "application/json"}
        # Warm-up: deja calientes los caches del resolver/trailing slash.
        self.client.get(self.url, **accept)

        with CaptureQueriesContext(connection) as before:
            self.client.get(self.url, **accept)
        base = len(before)

        for i in range(5):
            member = self.create_member(self.gym, first_name=f"Socio{i}")
            OutingEnrollment.objects.create(
                gym=self.gym,
                member=member,
                schedule=self.schedule,
            )

        with CaptureQueriesContext(connection) as after:
            self.client.get(self.url, **accept)

        self.assertEqual(len(after), base)
