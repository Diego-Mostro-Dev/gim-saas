from datetime import date, datetime, time
from decimal import Decimal
from unittest import mock

from django.utils import timezone

from activities.models import (
    Activity,
    ActivitySchedule,
    ActivitySessionRecord,
    Enrollment,
)
from activities.no_show_service import (
    cancel_recovered_no_show,
    deduct_missed_activity_enrollments,
    deduct_missed_pt_assignments,
)
from attendance.models import SessionRecovery
from core.testing import BaseAPITest
from gyms.models import GymClosedDate
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
    PersonalTrainingSessionRecord,
)
from plans.models import Service

# 2030-01-21 is a Monday.
FIXED_TODAY = date(2030, 1, 21)
YESTERDAY = date(2030, 1, 20)


class NoShowActivityTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.auto_deduct_missed_sessions = True
        self.gym.save(update_fields=["auto_deduct_missed_sessions"])
        self.member = self.create_member(self.gym)

    def _create_enrollment(self, *, total=10, day="monday", enrolled_at=date(2030, 1, 7)):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day=day,
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=schedule,
            modality="package",
            package_total_sessions=total,
            session_price=Decimal("2500.00"),
            amount_paid=Decimal("25000.00"),
        )
        Enrollment.objects.filter(pk=enrollment.pk).update(
            enrolled_at=timezone.make_aware(
                datetime.combine(enrolled_at, time(0, 0))
            )
        )
        ActivitySchedule.objects.filter(pk=schedule.pk).update(
            created_at=timezone.make_aware(datetime(2030, 1, 1, 0, 0))
        )
        return activity, schedule, enrollment

    def _run(self):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            return deduct_missed_activity_enrollments(self.gym)

    def test_backfill_creates_no_show_for_missed_days(self):
        _, _, enrollment = self._create_enrollment()

        result = self._run()

        self.assertEqual(result["records_created"], 2)
        records = ActivitySessionRecord.objects.filter(enrollment=enrollment)
        self.assertEqual(records.count(), 2)
        self.assertEqual(set(records.values_list("source", flat=True)), {"no_show"})
        self.assertEqual(
            set(records.values_list("date", flat=True)),
            {date(2030, 1, 7), date(2030, 1, 14)},
        )
        enrollment.refresh_from_db()
        self.assertEqual(enrollment.no_show_scan_until, YESTERDAY)
        self.assertEqual(enrollment.used_sessions, 2)

    def test_second_run_is_idempotent(self):
        self._create_enrollment()

        self._run()
        second = self._run()

        self.assertEqual(second["records_created"], 0)
        self.assertEqual(ActivitySessionRecord.objects.count(), 2)

    def test_cap_at_package_total(self):
        _, _, enrollment = self._create_enrollment(total=1)

        result = self._run()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(enrollment.session_records.count(), 1)

    def test_skips_closed_days(self):
        GymClosedDate.objects.create(gym=self.gym, date=date(2030, 1, 14))
        _, _, enrollment = self._create_enrollment()

        result = self._run()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(enrollment.session_records.values_list("date", flat=True)),
            [date(2030, 1, 7)],
        )

    def test_manual_removal_is_not_rededucted(self):
        _, _, enrollment = self._create_enrollment()
        self._run()
        ActivitySessionRecord.objects.filter(date=date(2030, 1, 14)).delete()

        self._run()

        self.assertEqual(enrollment.session_records.count(), 1)

    def test_pending_recovery_credits_newest_miss(self):
        activity, _, enrollment = self._create_enrollment()
        SessionRecovery.objects.create(
            gym=self.gym,
            member=self.member,
            kind="activity",
            activity=activity,
            status="scheduled",
            used_date=date(2030, 1, 28),
            expires_at=date(2030, 1, 28),
        )

        result = self._run()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(enrollment.session_records.values_list("date", flat=True)),
            [date(2030, 1, 7)],
        )

    def test_cancel_recovered_no_show_deletes_newest(self):
        activity, _, enrollment = self._create_enrollment()
        self._run()

        deleted = cancel_recovered_no_show(self.member, activity)

        self.assertEqual(deleted, 1)
        self.assertEqual(
            list(enrollment.session_records.values_list("date", flat=True)),
            [date(2030, 1, 7)],
        )


class NoShowPersonalTrainingTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.auto_deduct_missed_sessions = True
        self.gym.save(update_fields=["auto_deduct_missed_sessions"])
        self.member = self.create_member(self.gym)
        self.trainer = self.create_user(self.gym, username="trainer", role="staff")

    def _create_assignment(self, *, total=10, day="monday"):
        service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Entrenamiento personal",
            billing_mode="sessions",
        )
        assignment = PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            trainer=self.trainer,
            service=service,
            day=day,
            start_time=time(9, 0),
            end_time=time(10, 0),
            modality="package",
            package_total_sessions=total,
            session_price=Decimal("3000.00"),
            amount_paid=Decimal("30000.00"),
        )
        PersonalTrainingAssignment.objects.filter(pk=assignment.pk).update(
            created_at=timezone.make_aware(datetime(2030, 1, 1, 0, 0))
        )
        return assignment

    def _run(self):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            return deduct_missed_pt_assignments(self.gym)

    def test_backfill_creates_no_show_for_missed_days(self):
        assignment = self._create_assignment()

        result = self._run()

        self.assertEqual(result["records_created"], 2)
        records = PersonalTrainingSessionRecord.objects.filter(assignment=assignment)
        self.assertEqual(records.count(), 2)
        self.assertEqual(set(records.values_list("source", flat=True)), {"no_show"})

    def test_second_run_is_idempotent(self):
        assignment = self._create_assignment()

        self._run()
        second = self._run()

        self.assertEqual(second["records_created"], 0)
        self.assertEqual(assignment.session_records.count(), 2)
