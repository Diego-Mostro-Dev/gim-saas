"""Fase K3 — ADD-05: la duración real del bloque de gym.

``ScheduleSlot`` guardaba sólo día y hora, así que todo el código de
choques asumía que el bloque duraba 60 minutos. Con un bloque más largo
(una clase de spinning de 90 minutos, por ejemplo) el socio podía quedar
anotado en el gym y en una actividad al mismo tiempo.

Estos tests cubren la superficie de API: el alta de un slot con duración y
la validación del rango permitido.
"""

from datetime import time

from attendance.models import ScheduleSlot
from core.testing import BaseAPITest


class Add05SlotDurationApiTests(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

    def test_bulk_create_uses_the_given_duration(self):
        response = self.client.post(
            "/api/attendance/slots/bulk/",
            {
                "days": ["monday"],
                "start_time": "09:00",
                "end_time": "10:00",
                "step_minutes": 60,
                "duration_minutes": 90,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=time(9, 0))
        self.assertEqual(slot.duration_minutes, 90)

    def test_bulk_create_defaults_to_sixty_minutes(self):
        response = self.client.post(
            "/api/attendance/slots/bulk/",
            {
                "days": ["monday"],
                "start_time": "09:00",
                "end_time": "10:00",
                "step_minutes": 60,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=time(9, 0))
        self.assertEqual(slot.duration_minutes, 60)

    def test_bulk_create_rejects_an_absurd_duration(self):
        response = self.client.post(
            "/api/attendance/slots/bulk/",
            {
                "days": ["monday"],
                "start_time": "09:00",
                "end_time": "10:00",
                "step_minutes": 60,
                "duration_minutes": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(ScheduleSlot.objects.filter(gym=self.gym).exists())

    def test_slot_serializer_exposes_the_duration(self):
        response = self.client.post(
            "/api/attendance/slots/",
            {
                "day": "tuesday",
                "hour": time(18, 0).strftime("%H:%M"),
                "duration_minutes": 45,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["duration_minutes"], 45)
        slot = ScheduleSlot.objects.get(gym=self.gym, day="tuesday")
        self.assertEqual(slot.duration_minutes, 45)

    def test_slot_serializer_rejects_an_out_of_range_duration(self):
        response = self.client.post(
            "/api/attendance/slots/",
            {
                "day": "tuesday",
                "hour": "18:00",
                "duration_minutes": 900,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("duration_minutes", response.data)
