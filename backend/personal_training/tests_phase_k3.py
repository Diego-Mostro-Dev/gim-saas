"""Fase K3 — faltas, no-show y recuperaciones (PT).

Cubre ``ADD-27`` en entrenamiento personal: una recuperación perdona
**exactamente una** falta, igual que en actividades.

- ``2030-01-21`` es lunes.
"""

from datetime import date
from unittest import mock

from activities.no_show_service import deduct_missed_pt_assignments
from attendance.recovery_service import grant_scheduled
from core.testing import BaseAPITest
from personal_training.models import PersonalTrainingSessionRecord

FIXED_TODAY = date(2030, 1, 21)  # lunes
NEXT_DAY = date(2030, 1, 22)  # martes
RECOVERY_TARGET = date(2030, 1, 28)  # lunes


class Add27PtRecoveryForgivesOneAbsenceTests(BaseAPITest):
    """ADD-27: una recuperación de PT, una falta perdonada."""

    def setUp(self):
        super().setUp()
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
            end_date=date(2030, 2, 28),
        )
        self.settle_subscription(sub)
        _, self.assignment = self.create_pt_assignment(
            gym=self.gym,
            member=self.member,
            trainer=self.trainer,
            total=10,
            created_at=date(2030, 1, 1),
        )

    def _run_cron(self, today):
        with mock.patch("django.utils.timezone.localdate", return_value=today):
            return deduct_missed_pt_assignments(self.gym)

    def _grant_recovery(self, today=FIXED_TODAY, target=RECOVERY_TARGET):
        with mock.patch("django.utils.timezone.localdate", return_value=today):
            return grant_scheduled(
                self.gym,
                self.member,
                kind="pt",
                target_date=target,
                pt_assignment=self.assignment,
            )

    def _dates(self):
        return list(
            PersonalTrainingSessionRecord.objects.order_by("date").values_list(
                "date", flat=True
            )
        )

    def test_one_recovery_does_not_forgive_two_absences(self):
        self._run_cron(FIXED_TODAY)
        self.assertEqual(self._dates(), [date(2030, 1, 7), date(2030, 1, 14)])

        self._grant_recovery()
        self.assertEqual(self._dates(), [date(2030, 1, 7)])

        # La falta siguiente (la clase del lunes 21) sí se descuenta.
        self._run_cron(NEXT_DAY)

        self.assertEqual(self._dates(), [date(2030, 1, 7), date(2030, 1, 21)])

    def test_recovery_granted_before_the_cron_covers_one_absence(self):
        self._grant_recovery()

        self._run_cron(FIXED_TODAY)
        self.assertEqual(
            self._dates(),
            [date(2030, 1, 7)],
            "La recuperación en vuelo perdona la falta más reciente",
        )

        self._run_cron(NEXT_DAY)

        self.assertEqual(self._dates(), [date(2030, 1, 7), date(2030, 1, 21)])


class Add29PtWatermarkDoesNotSkipUnchargedAbsencesTests(BaseAPITest):
    """ADD-29 en PT: el watermark no avanza sobre faltas no cobradas."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.member = self.create_member(self.gym)
        self.trainer = self.create_user(self.gym, username="trainer", role="staff")
        _, self.assignment = self.create_pt_assignment(
            gym=self.gym,
            member=self.member,
            trainer=self.trainer,
            total=2,
            created_at=date(2030, 1, 1),
        )

    def _run_cron(self, today):
        with mock.patch("django.utils.timezone.localdate", return_value=today):
            return deduct_missed_pt_assignments(self.gym)

    def _attend(self, date_):
        PersonalTrainingSessionRecord.objects.create(
            gym=self.gym,
            member=self.member,
            assignment=self.assignment,
            date=date_,
            source="checkin",
        )

    def _dates(self):
        return list(
            PersonalTrainingSessionRecord.objects.order_by("date").values_list(
                "date", flat=True
            )
        )

    def test_absences_of_an_exhausted_package_are_not_lost(self):
        from personal_training.models import PersonalTrainingAssignment

        PersonalTrainingAssignment.objects.filter(pk=self.assignment.pk).update(
            package_total_sessions=1
        )
        self.assignment.refresh_from_db()
        self._attend(date(2030, 1, 7))

        self._run_cron(FIXED_TODAY)

        self.assertEqual(self._dates(), [date(2030, 1, 7)])
        self.assignment.refresh_from_db()
        self.assertIsNone(self.assignment.no_show_scan_until)

        from personal_training.session_service import SessionService

        SessionService.renew_package(self.assignment, 1)
        self._run_cron(FIXED_TODAY)

        self.assertEqual(
            self._dates(), [date(2030, 1, 7), date(2030, 1, 14)]
        )

    def test_truncated_list_of_absences_keeps_the_pending_ones(self):
        self._attend(date(2030, 1, 7))
        self._run_cron(NEXT_DAY)

        self.assertEqual(
            self._dates(), [date(2030, 1, 7), date(2030, 1, 14)]
        )
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.no_show_scan_until, date(2030, 1, 14))

        from personal_training.session_service import SessionService

        SessionService.renew_package(self.assignment, 1)
        self._run_cron(NEXT_DAY)

        self.assertEqual(
            self._dates(),
            [date(2030, 1, 7), date(2030, 1, 14), date(2030, 1, 21)],
        )
