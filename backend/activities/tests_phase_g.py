"""Fase G — sesiones y faltas.

Cubre tres de los cuatro hallazgos de la fase:

- ``ADD-07``: el no-show no debe descontar en fechas sin clase dictada
  (horario que todavía no existía / gym cerrado).
- ``ADD-21``: faltar a una sesión de PT no debe agotar el paquete sin
  recuperación (kind=``pt`` en ``SessionRecovery``).
- ``ACC-08``: entrar y entrenar fuera de la ventana horaria igual descuenta
  la sesión del paquete (cuando la asistencia es inequívoca).

Corren contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from datetime import date, datetime, time
from unittest import mock

from django.test import override_settings

from activities.models import ActivitySessionRecord
from activities.no_show_service import (
    cancel_recovered_no_show_pt,
    deduct_missed_activity_enrollments,
    deduct_missed_pt_assignments,
)
from attendance.models import SessionRecovery
from attendance.recovery_service import (
    RecoveryError,
    grant_scheduled,
    undo_recovery,
    use_recovery,
)
from core.testing import BaseAPITest
from personal_training.models import PersonalTrainingSessionRecord

# 2030-01-21 is a Monday.
FIXED_TODAY = date(2030, 1, 21)
YESTERDAY = date(2030, 1, 20)

MONDAYS = [date(2030, 1, 7), date(2030, 1, 14)]


class Add07NoShowOnlyOnClassDaysTests(BaseAPITest):
    """ADD-07: no-show sólo en fechas con clase dictada."""

    def setUp(self):
        self.gym = self.create_gym()
        self.member = self.create_member(self.gym)

    def _run_activity(self):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            return deduct_missed_activity_enrollments(self.gym)

    def _run_pt(self):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            return deduct_missed_pt_assignments(self.gym)

    def test_activity_does_not_deduct_before_schedule_created(self):
        # Horario creado el 2030-01-14: la clase del 01-07 no existía y no
        # puede contarse como falta.
        self.create_activity_package(
            gym=self.gym, member=self.member, created_at=date(2030, 1, 14)
        )

        result = self._run_activity()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(
                ActivitySessionRecord.objects.values_list("date", flat=True)
            ),
            [date(2030, 1, 14)],
        )

    def test_activity_watermark_never_deducts_before_schedule_created(self):
        # El watermark quedó viejo (avanzado antes de que existiera el
        # horario): el job no debe descontar fechas anteriores a la creación
        # del horario aunque el floor del watermark sea más antiguo.
        _, schedule, enrollment = self.create_activity_package(
            gym=self.gym, member=self.member, created_at=date(2030, 1, 14)
        )
        from activities.models import Enrollment

        Enrollment.objects.filter(pk=enrollment.pk).update(
            no_show_scan_until=date(2030, 1, 6)
        )

        result = self._run_activity()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(
                ActivitySessionRecord.objects.values_list("date", flat=True)
            ),
            [date(2030, 1, 14)],
        )

    def test_activity_skips_closed_day(self):
        self.create_activity_package(gym=self.gym, member=self.member)
        self.create_closed_date(date(2030, 1, 14), gym=self.gym)

        result = self._run_activity()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(
                ActivitySessionRecord.objects.values_list("date", flat=True)
            ),
            [date(2030, 1, 7)],
        )

    def test_pt_does_not_deduct_before_assignment_created(self):
        self.create_pt_assignment(
            gym=self.gym, member=self.member, created_at=date(2030, 1, 14)
        )

        result = self._run_pt()

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(
                PersonalTrainingSessionRecord.objects.values_list(
                    "date", flat=True
                )
            ),
            [date(2030, 1, 14)],
        )


class Add21PtRecoveryTests(BaseAPITest):
    """ADD-21: faltar a PT no agota el paquete sin recuperación."""

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.allow_session_recovery = True
        self.gym.max_session_recoveries_per_month = 5
        self.gym.save(
            update_fields=["allow_session_recovery", "max_session_recoveries_per_month"]
        )
        self.member = self.create_member(self.gym)
        self.trainer = self.create_user(self.gym, username="trainer", role="staff")
        # El gate de recuperación usa ``can_operate`` con el ``localdate``
        # parcheado a FIXED_TODAY, así que la suscripción debe cubrir enero
        # de 2030 (no el mes real en que corre el test).
        plan = self.create_plan(self.gym)
        sub = self.open_month_subscription(
            self.member,
            plan,
            start_date=date(2030, 1, 1),
            end_date=date(2030, 1, 31),
        )
        self.settle_subscription(sub)

    def test_pt_assignment_is_recoverable(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer
        )

        # Programar el recupero para el próximo lunes (2030-01-28).
        target = date(2030, 1, 28)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            recovery = grant_scheduled(
                self.gym,
                self.member,
                kind="pt",
                target_date=target,
                pt_assignment=assignment,
            )

        self.assertEqual(recovery.kind, "pt")
        self.assertEqual(recovery.pt_assignment_id, assignment.id)

    def test_pt_recovery_cancels_newest_no_show(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer
        )

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            deduct_missed_pt_assignments(self.gym)

        self.assertEqual(assignment.session_records.count(), 2)

        deleted = cancel_recovered_no_show_pt(self.member, assignment)

        self.assertEqual(deleted, 1)
        self.assertEqual(
            list(
                assignment.session_records.order_by("date").values_list(
                    "date", flat=True
                )
            ),
            [date(2030, 1, 7)],
        )

    def test_pt_no_show_credit_avoids_deducting_newest(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer
        )
        SessionRecovery.objects.create(
            gym=self.gym,
            member=self.member,
            kind="pt",
            pt_assignment=assignment,
            status="scheduled",
            used_date=date(2030, 1, 28),
            expires_at=date(2030, 1, 28),
        )

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            result = deduct_missed_pt_assignments(self.gym)

        self.assertEqual(result["records_created"], 1)
        self.assertEqual(
            list(assignment.session_records.values_list("date", flat=True)),
            [date(2030, 1, 7)],
        )

    def test_pt_recovery_rejects_other_gym_assignment(self):
        other_gym = self.create_gym(name="Other Gym")
        other_member = self.create_member(other_gym)
        _, other_assignment = self.create_pt_assignment(
            gym=other_gym, member=other_member
        )

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            with self.assertRaises(RecoveryError):
                grant_scheduled(
                    self.gym,
                    self.member,
                    kind="pt",
                    target_date=date(2030, 1, 28),
                    pt_assignment=other_assignment,
                )

    def test_grant_pt_recovery_cancels_latest_no_show(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer
        )
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            deduct_missed_pt_assignments(self.gym)
        self.assertEqual(assignment.session_records.count(), 2)

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            grant_scheduled(
                self.gym,
                self.member,
                kind="pt",
                target_date=date(2030, 1, 28),
                pt_assignment=assignment,
            )

        # La falta más reciente (01-14) se anuló al programar el recupero.
        self.assertEqual(
            list(assignment.session_records.values_list("date", flat=True)),
            [date(2030, 1, 7)],
        )

    def test_use_pt_recovery_records_session(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer
        )

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            recovery = grant_scheduled(
                self.gym,
                self.member,
                kind="pt",
                target_date=date(2030, 1, 28),
                pt_assignment=assignment,
            )
            use_recovery(recovery, date(2030, 1, 28))

        recovery.refresh_from_db()
        self.assertEqual(recovery.status, "used")
        record = PersonalTrainingSessionRecord.objects.get(
            assignment=assignment, date=date(2030, 1, 28)
        )
        self.assertEqual(record.source, "recovery")
        self.assertEqual(assignment.session_records.count(), 1)

    def test_undo_pt_recovery_removes_session(self):
        _, assignment = self.create_pt_assignment(
            gym=self.gym, member=self.member, trainer=self.trainer
        )

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            recovery = grant_scheduled(
                self.gym,
                self.member,
                kind="pt",
                target_date=date(2030, 1, 28),
                pt_assignment=assignment,
            )
            use_recovery(recovery, date(2030, 1, 28))
            undo_recovery(recovery)

        self.assertFalse(
            PersonalTrainingSessionRecord.objects.filter(
                assignment=assignment, source="recovery"
            ).exists()
        )


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class Acc08DiscountOutsideWindowTests(BaseAPITest):
    """ACC-08: entrar y entrenar igual descuenta la sesión del paquete.

    El check-in fija ``localdate`` (lunes 2030-01-21) y ``localtime`` (una hora
    fuera de la ventana de la clase) para probar que el descuento no depende
    de la franja horaria cuando la asistencia es inequívoca.
    """

    def setUp(self):
        self.gym = self.create_gym()
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.slot = self.create_today_slot(self.gym, day="monday")
        self.attendance_schedule = self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub
        )

    def _checkin(self, *, hour=18):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ), mock.patch(
            "django.utils.timezone.localtime",
            return_value=datetime(2030, 1, 21, hour, 0),
        ):
            return self.client.post(
                f"/api/attendance/checkin/{self.member.access_token}/"
            )

    def test_single_package_discounts_outside_window(self):
        # La clase es 09:00-10:00; el socio entra 18:00. Con una sola
        # inscripción de paquete, se descuenta igual.
        _, _, enrollment = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
        )

        resp = self._checkin(hour=18)

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(
            list(enrollment.session_records.values_list("source", flat=True)),
            ["auto"],
        )

    def test_multiple_packages_only_in_window_discounts(self):
        # Dos clases el mismo día: 09:00-10:00 y 18:00-19:00. Entra a las
        # 18:30 → sólo se descuenta la que cae en ventana.
        _, _, morning = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
        )
        from activities.models import Activity, ActivitySchedule, Enrollment
        from plans.models import Service

        second = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="sessions",
        )
        evening = ActivitySchedule.objects.create(
            activity=second,
            day="monday",
            start_time=time(18, 0),
            end_time=time(19, 0),
            capacity=10,
        )
        evening_enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=evening,
            modality="package",
            package_total_sessions=10,
            amount_paid=0,
        )

        resp = self._checkin(hour=18)

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(morning.session_records.count(), 0)
        self.assertEqual(evening_enrollment.session_records.count(), 1)

    def test_multiple_packages_none_in_window_does_not_discount(self):
        # Dos clases (09:00-10:00 y 11:00-12:00), entra a las 18:00: ninguna
        # cae en ventana → no se descuenta para no cobrar la clase equivocada.
        _, _, first = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
        )
        from activities.models import Activity, ActivitySchedule, Enrollment
        from plans.models import Service

        second = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="sessions",
        )
        other = ActivitySchedule.objects.create(
            activity=second,
            day="monday",
            start_time=time(11, 0),
            end_time=time(12, 0),
            capacity=10,
        )
        other_enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=other,
            modality="package",
            package_total_sessions=10,
            amount_paid=0,
        )

        resp = self._checkin(hour=18)

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(first.session_records.count(), 0)
        self.assertEqual(other_enrollment.session_records.count(), 0)

    def test_staff_registration_discounts_single_package(self):
        # El staff registra la asistencia: con una sola inscripción de paquete
        # activa hoy, se descuenta aunque no haya hora de check-in.
        self.gym.features = {**self.gym.features, "activities": True}
        self.gym.save(update_fields=["features"])
        _, _, enrollment = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
        )
        user = self.create_user(self.gym, username="staffuser", role="staff")
        self.client.force_authenticate(user=user)

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            resp = self.client.post(
                "/api/attendance/register/",
                {"schedule": self.attendance_schedule.id},
            )

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(enrollment.session_records.count(), 1)

    def test_staff_registration_multiple_packages_does_not_discount(self):
        self.gym.features = {**self.gym.features, "activities": True}
        self.gym.save(update_fields=["features"])
        _, _, first = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            day="monday",
        )
        from activities.models import Activity, ActivitySchedule, Enrollment
        from plans.models import Service

        second = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="sessions",
        )
        other = ActivitySchedule.objects.create(
            activity=second,
            day="monday",
            start_time=time(11, 0),
            end_time=time(12, 0),
            capacity=10,
        )
        other_enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=other,
            modality="package",
            package_total_sessions=10,
            amount_paid=0,
        )
        user = self.create_user(self.gym, username="staffuser", role="staff")
        self.client.force_authenticate(user=user)

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            resp = self.client.post(
                "/api/attendance/register/",
                {"schedule": self.attendance_schedule.id},
            )

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(first.session_records.count(), 0)
        self.assertEqual(other_enrollment.session_records.count(), 0)
