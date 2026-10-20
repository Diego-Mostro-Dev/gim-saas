"""Fase G — invariantes de paquetes de sesiones.

Corre el ciclo real (alta + asistencias + faltas + recuperación) y afirma que
``check_session_invariants`` se mantiene vacío. Es el gate de la fase: si un
fix de ADD-07/ADD-21/ACC-08 introdujera una sesión fantasma, acá se ve.
"""

from datetime import date, time
from unittest import mock

from django.test import override_settings

from activities.models import ActivitySessionRecord
from activities.no_show_service import (
    deduct_missed_activity_enrollments,
    deduct_missed_pt_assignments,
)
from activities.session_service import SessionService
from attendance.recovery_service import grant_scheduled, use_recovery
from core.session_invariants import check_session_invariants
from core.testing import BaseAPITest

FIXED_TODAY = date(2030, 1, 21)  # lunes


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class SessionInvariantCycleTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.allow_session_recovery = True
        self.gym.max_session_recoveries_per_month = 5
        self.gym.save(
            update_fields=[
                "allow_session_recovery",
                "max_session_recoveries_per_month",
            ]
        )
        self.member = self.create_member(self.gym)
        self.trainer = self.create_user(self.gym, username="trainer", role="staff")
        plan = self.create_plan(self.gym)
        sub = self.open_month_subscription(
            self.member,
            plan,
            start_date=date(2030, 1, 1),
            end_date=date(2030, 1, 31),
        )
        self.settle_subscription(sub)

    def test_activity_cycle_holds_invariant(self):
        _, schedule, enrollment = self.create_activity_package(
            gym=self.gym, member=self.member, total=4
        )

        # Una asistencia real + faltas por el job.
        SessionService.record_session(
            enrollment, date(2030, 1, 7), source="manual"
        )
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            deduct_missed_activity_enrollments(self.gym)

        self.assertEqual(check_session_invariants(self.gym), [])
        self.assertEqual(enrollment.session_records.count(), 2)

    def test_closed_day_is_not_a_phantom_session(self):
        _, _, enrollment = self.create_activity_package(
            gym=self.gym, member=self.member, total=4
        )
        self.create_closed_date(date(2030, 1, 14), gym=self.gym)

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            deduct_missed_activity_enrollments(self.gym)

        # Sólo el lunes 01-07 se descuenta; el 01-14 estaba cerrado.
        self.assertEqual(
            list(enrollment.session_records.values_list("date", flat=True)),
            [date(2030, 1, 7)],
        )
        self.assertEqual(check_session_invariants(self.gym), [])

    def test_pt_recovery_cycle_holds_invariant(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer, total=4
        )

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            deduct_missed_pt_assignments(self.gym)
            recovery = grant_scheduled(
                self.gym,
                self.member,
                kind="pt",
                target_date=date(2030, 1, 28),
                pt_assignment=assignment,
            )
            use_recovery(recovery, date(2030, 1, 28))

        # falta 01-07 + falta 01-14 anulada por el recupero + recupero 01-28.
        self.assertEqual(assignment.session_records.count(), 2)
        self.assertEqual(check_session_invariants(self.gym), [])

    def test_detects_phantom_session(self):
        # El checker debe detectar una sesión forzada en un día que no
        # corresponde (guardia del invariante, no del flujo real).
        _, _, enrollment = self.create_activity_package(
            gym=self.gym, member=self.member, total=4
        )
        ActivitySessionRecord.objects.create(
            gym=self.gym,
            member=self.member,
            enrollment=enrollment,
            schedule=enrollment.schedule,
            date=date(2030, 1, 8),  # martes, la clase es lunes
            source="manual",
        )

        violations = check_session_invariants(self.gym)

        self.assertTrue(any("P3" in v for v in violations))

    def test_detects_unbacked_recovery_record(self):
        # P6: un registro "recovery" sin su SessionRecovery usada es una
        # sesión fantasma (cobraría una reposición que nunca se otorgó).
        _, _, enrollment = self.create_activity_package(
            gym=self.gym, member=self.member, total=4
        )
        ActivitySessionRecord.objects.create(
            gym=self.gym,
            member=self.member,
            enrollment=enrollment,
            schedule=enrollment.schedule,
            date=date(2030, 1, 7),  # lunes
            source="recovery",
        )

        violations = check_session_invariants(self.gym)

        self.assertTrue(any("P6" in v for v in violations))
