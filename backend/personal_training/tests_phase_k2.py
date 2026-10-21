"""Fase K2 — add-ons: solapes, renovaciones y bajas.

Cubre el lado de PT de ``ADD-16``: el entrenamiento personal validaba el
choque con el horario fijo del gimnasio, con las actividades y con otros
entrenamientos, pero no con las salidas. El socio quedaba anotado en el
entrenamiento y en la salida a la misma hora.

Corre contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from datetime import time
from decimal import Decimal

from core.testing import BaseAPITest
from gyms.features import FEATURE_PERSONAL_TRAINING
from outings.models import Outing, OutingEnrollment, OutingSchedule
from personal_training.assignment_service import AssignmentService
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from profiles.models import UserProfile


class Add16OutingDimensionTests(BaseAPITest):
    """ADD-16 (PT): el entrenamiento personal choca con las salidas."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {
            **self.gym.features,
            "salidas": True,
            FEATURE_PERSONAL_TRAINING: True,
        }
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.member.address = "Calle 123"
        self.member.save(update_fields=["address"])
        self.trainer = self.create_user(
            self.gym, username="trainer", role=UserProfile.ROLE_TRAINER
        )
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Entrenamiento personal",
            billing_mode="sessions",
        )
        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trekking",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        self.outing_schedule = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

    def _assign(self, day="monday", start=time(9, 0), end=time(10, 0)):
        return AssignmentService.assign_member(
            self.member,
            self.pt_service,
            self.trainer,
            day=day,
            start_time=start,
            end_time=end,
            skip_eligibility_check=True,
        )

    def test_assignment_conflicting_with_an_outing_is_rejected(self):
        OutingEnrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.outing_schedule,
            active=True,
        )

        with self.assertRaises(ValueError) as ctx:
            self._assign()

        self.assertIn("salida", str(ctx.exception))

    def test_assignment_without_conflicts_is_allowed(self):
        assignment = self._assign(day="tuesday")

        self.assertTrue(assignment.active)

    def test_assignment_on_another_time_is_allowed(self):
        OutingEnrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.outing_schedule,
            active=True,
        )

        assignment = self._assign(start=time(18, 0), end=time(19, 0))

        self.assertTrue(assignment.active)
