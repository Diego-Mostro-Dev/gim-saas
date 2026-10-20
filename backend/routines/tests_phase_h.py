"""Fase H — rutinas.

Cubre los hallazgos que se arreglan en la fase:

- ``RUT-01``: control de rol. Dueño, staff y profesor gestionan el catálogo y
  las asignaciones; el entrenador/a personal (trainer) no.
- ``RUT-02``: borrar una asignación es soft delete (no se pierde la fila) y el
  ViewSet no expone ``DELETE``.
- ``RUT-03``: una sola rutina activa por socio (constraint de DB) y el alta en
  lote es atómica.
- ``RUT-04``: un ejercicio de rutina desactivado ya no aparece en la rutina
  que ve el socio.
- ``RUT-07``: la app pasa a tener tests (esta suite).

``RUT-06`` (datos financieros en el endpoint público del portal) y ``RUT-08``
(progreso por día) quedan como decisiones de negocio y no se testean acá.

Corren contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from django.db import IntegrityError, transaction

from core.testing import BaseAPITest
from profiles.models import UserProfile

from .models import (
    Exercise,
    RoutineAssignment,
    RoutineExercise,
    RoutineTemplate,
)


class RoutineRolePermissionTests(BaseAPITest):
    """RUT-01: sólo owner/staff/professor gestionan rutinas."""

    def setUp(self):
        self.gym = self.create_gym()
        self.other_gym = self.create_gym("Otro Gym")
        self.exercise = Exercise.objects.create(gym=self.gym, name="Press banca")

    def _user_with_role(self, role):
        return self.create_user(self.gym, username=f"u-{role}", role=role)

    # --- permitidos -------------------------------------------------------

    def test_owner_can_create_exercise(self):
        self.client.force_authenticate(
            user=self._user_with_role(UserProfile.ROLE_OWNER)
        )
        resp = self.client.post(
            "/api/routines/exercises/", {"name": "Sentadilla"}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_staff_can_create_exercise(self):
        self.client.force_authenticate(
            user=self._user_with_role(UserProfile.ROLE_STAFF)
        )
        resp = self.client.post(
            "/api/routines/exercises/", {"name": "Sentadilla"}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_professor_can_create_exercise(self):
        self.client.force_authenticate(
            user=self._user_with_role(UserProfile.ROLE_PROFESSOR)
        )
        resp = self.client.post(
            "/api/routines/exercises/", {"name": "Sentadilla"}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)

    # --- denegado ---------------------------------------------------------

    def test_trainer_cannot_create_exercise(self):
        self.client.force_authenticate(
            user=self._user_with_role(UserProfile.ROLE_TRAINER)
        )
        resp = self.client.post(
            "/api/routines/exercises/", {"name": "Sentadilla"}, format="json"
        )
        self.assertEqual(resp.status_code, 403, resp.data)
        self.assertFalse(Exercise.objects.filter(name="Sentadilla").exists())

    def test_trainer_cannot_bulk_assign(self):
        member = self.create_member(self.gym)
        template = RoutineTemplate.objects.create(gym=self.gym, name="Full body")
        self.client.force_authenticate(
            user=self._user_with_role(UserProfile.ROLE_TRAINER)
        )
        resp = self.client.post(
            "/api/routines/bulk-assign/",
            {"member_ids": [member.id], "routine_template": template.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 403, resp.data)
        self.assertFalse(
            RoutineAssignment.objects.filter(member=member, active=True).exists()
        )

    def test_professor_can_bulk_assign(self):
        member = self.create_member(self.gym)
        template = RoutineTemplate.objects.create(gym=self.gym, name="Full body")
        self.client.force_authenticate(
            user=self._user_with_role(UserProfile.ROLE_PROFESSOR)
        )
        resp = self.client.post(
            "/api/routines/bulk-assign/",
            {"member_ids": [member.id], "routine_template": template.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(
            RoutineAssignment.objects.filter(member=member, active=True).exists()
        )


class RoutineAssignmentSoftDeleteTests(BaseAPITest):
    """RUT-02: borrar una asignación es soft delete y no se expone DELETE."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.member = self.create_member(self.gym)
        self.template = RoutineTemplate.objects.create(gym=self.gym, name="Full body")
        self.assignment = RoutineAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            routine_template=self.template,
            active=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_delete_method_not_allowed(self):
        resp = self.client.delete(f"/api/routines/assignments/{self.assignment.id}/")
        self.assertEqual(resp.status_code, 405, resp.data)

    def test_model_delete_soft_deletes(self):
        self.assignment.delete()
        self.assignment.refresh_from_db()
        self.assertFalse(self.assignment.active)

    def test_soft_deleted_row_survives(self):
        self.assignment.delete()
        # La fila sigue existiendo (no es hard delete).
        self.assertTrue(
            RoutineAssignment.objects.filter(pk=self.assignment.id).exists()
        )


class RoutineUniquenessTests(BaseAPITest):
    """RUT-03: una sola rutina activa por socio; alta en lote atómica."""

    def setUp(self):
        self.gym = self.create_gym()
        self.other_gym = self.create_gym("Ajeno Gym")
        self.user = self.create_user(self.gym)
        self.member = self.create_member(self.gym)
        self.template_a = RoutineTemplate.objects.create(gym=self.gym, name="A")
        self.template_b = RoutineTemplate.objects.create(gym=self.gym, name="B")
        self.client.force_authenticate(user=self.user)

    def test_constraint_blocks_second_active_assignment(self):
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member, routine_template=self.template_a,
            active=True,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                RoutineAssignment.objects.create(
                    gym=self.gym, member=self.member,
                    routine_template=self.template_b, active=True,
                )

    def test_inactive_duplicates_are_allowed(self):
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member, routine_template=self.template_a,
            active=False,
        )
        # Dos inactivas conviven; el constraint sólo aplica a activas.
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member, routine_template=self.template_b,
            active=False,
        )
        self.assertEqual(
            RoutineAssignment.objects.filter(member=self.member).count(), 2
        )

    def test_bulk_assign_replaces_previous_active(self):
        old = RoutineAssignment.objects.create(
            gym=self.gym, member=self.member, routine_template=self.template_a,
            active=True,
        )
        resp = self.client.post(
            "/api/routines/bulk-assign/",
            {"member_ids": [self.member.id], "routine_template": self.template_b.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)

        old.refresh_from_db()
        self.assertFalse(old.active)

        active = RoutineAssignment.objects.filter(
            member=self.member, active=True
        )
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().routine_template_id, self.template_b.id)

    def test_bulk_assign_multi_member(self):
        m1 = self.create_member(self.gym, first_name="Ana")
        m2 = self.create_member(self.gym, first_name="Beto")
        resp = self.client.post(
            "/api/routines/bulk-assign/",
            {
                "member_ids": [m1.id, m2.id],
                "routine_template": self.template_a.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["assigned_members"], 2)
        self.assertEqual(
            RoutineAssignment.objects.filter(active=True, member__in=[m1, m2]).count(),
            2,
        )

    def test_bulk_assign_leaves_no_partial_state(self):
        # Un socio válido y uno de otro gym: el de otro gym no cuenta, pero el
        # lote no debe dejar estados parciales.
        outsider = self.create_member(self.other_gym, first_name="Ajeno")
        resp = self.client.post(
            "/api/routines/bulk-assign/",
            {
                "member_ids": [self.member.id, outsider.id],
                "routine_template": self.template_a.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["assigned_members"], 1)
        self.assertEqual(
            RoutineAssignment.objects.filter(active=True).count(), 1
        )


class RoutineExerciseHiddenWhenInactiveTests(BaseAPITest):
    """RUT-04: un ejercicio de rutina desactivado no sale en la rutina."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.member = self.create_member(self.gym)
        self.template = RoutineTemplate.objects.create(gym=self.gym, name="Full body")
        self.exercise = Exercise.objects.create(gym=self.gym, name="Press banca")
        self.routine_exercise = RoutineExercise.objects.create(
            routine_template=self.template,
            exercise=self.exercise,
            order=1,
            sets=3,
        )
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member, routine_template=self.template,
            active=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_active_exercise_visible(self):
        resp = self.client.get(
            f"/api/routines/member/{self.member.id}/"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(len(resp.data["exercises"]), 1)

    def test_inactive_exercise_hidden(self):
        RoutineExercise.objects.filter(pk=self.routine_exercise.pk).update(
            is_active=False
        )
        resp = self.client.get(
            f"/api/routines/member/{self.member.id}/"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["exercises"], [])
