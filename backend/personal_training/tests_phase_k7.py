"""Fase K7 — ADD-19: PATCH directo de trainer y horario de una asignación.

El backend ya soportaba el cambio, pero la UI no lo exponía. Al habilitarlo se
cubre también que la respuesta traiga el ID del perfil del trainer para poder
preseleccionarlo, y que el solape se siga rechazando.
"""

from datetime import time
from decimal import Decimal

from django.urls import reverse

from core.testing import BaseAPITest
from gyms.features import FEATURE_PERSONAL_TRAINING
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from profiles.models import UserProfile


class Add19AssignmentPatchTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, FEATURE_PERSONAL_TRAINING: True}
        self.gym.save(update_fields=["features"])
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

        self.member = self.create_member(self.gym)
        self.trainer = self.create_user(
            self.gym, username="trainer1", role=UserProfile.ROLE_TRAINER
        )
        self.trainer2 = self.create_user(
            self.gym, username="trainer2", role=UserProfile.ROLE_TRAINER
        )
        self.service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Entrenamiento personal",
            billing_mode="monthly",
            monthly_price=Decimal("22000.00"),
        )
        self.assignment = PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            trainer=self.trainer,
            service=self.service,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            modality="monthly",
        )
        self.url = reverse("pt-assignment-detail", args=[self.assignment.id])

    def test_patch_updates_trainer_day_and_time(self):
        resp = self.client.patch(
            self.url,
            {
                "trainer_id": self.trainer2.profile.id,
                "day": "tuesday",
                "start_time": "11:00",
                "end_time": "12:00",
            },
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.trainer_id, self.trainer2.id)
        self.assertEqual(self.assignment.day, "tuesday")
        self.assertEqual(self.assignment.start_time, time(11, 0))
        self.assertEqual(self.assignment.end_time, time(12, 0))

    def test_response_exposes_trainer_profile_id(self):
        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["trainer_profile_id"], self.trainer.profile.id)

    def test_patch_rejects_overlapping_slot(self):
        other_member = self.create_member(self.gym, first_name="Beto")
        PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=other_member,
            trainer=self.trainer2,
            service=self.service,
            day="tuesday",
            start_time=time(10, 0),
            end_time=time(11, 0),
            modality="monthly",
        )

        resp = self.client.patch(
            self.url,
            {
                "trainer_id": self.trainer2.profile.id,
                "day": "tuesday",
                "start_time": "10:30",
                "end_time": "11:30",
            },
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.trainer_id, self.trainer.id)
        self.assertEqual(self.assignment.day, "monday")
