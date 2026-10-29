"""Fase K3 — faltas, no-show y recuperaciones.

Cubre ``ADD-27``: una recuperación de sesión perdona **exactamente una**
falta. Antes los dos mecanismos (otorgar el recupero y el barrido del cron)
usaban la misma clave ``(member, activity)`` sin mirar a qué falta
correspondía, así que una sola recuperación podía perdonar dos faltas.

- ``2030-01-21`` es lunes.
"""

from datetime import date, time
from decimal import Decimal
from unittest import mock

from activities.enrollment_service import EnrollmentError, EnrollmentService
from activities.models import (
    Activity,
    ActivitySchedule,
    ActivitySessionRecord,
)
from activities.no_show_service import deduct_missed_activity_enrollments
from attendance.models import ScheduleSlot
from attendance.recovery_service import grant_scheduled
from core.testing import BaseAPITest
from plans.models import Service

FIXED_TODAY = date(2030, 1, 21)  # lunes
NEXT_DAY = date(2030, 1, 22)  # martes
RECOVERY_TARGET = date(2030, 1, 28)  # lunes


class Add27RecoveryForgivesOneAbsenceTests(BaseAPITest):
    """ADD-27: una recuperación, una falta perdonada."""

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
        plan = self.create_plan(self.gym)
        sub = self.open_month_subscription(
            self.member,
            plan,
            start_date=date(2030, 1, 1),
            end_date=date(2030, 2, 28),
        )
        self.settle_subscription(sub)
        self.activity, self.schedule, self.enrollment = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            total=10,
            created_at=date(2030, 1, 1),
        )

    def _run_cron(self, today):
        with mock.patch("django.utils.timezone.localdate", return_value=today):
            return deduct_missed_activity_enrollments(self.gym)

    def _grant_recovery(self, today=FIXED_TODAY, target=RECOVERY_TARGET):
        with mock.patch("django.utils.timezone.localdate", return_value=today):
            return grant_scheduled(
                self.gym,
                self.member,
                kind="activity",
                activity=self.activity,
                target_date=target,
                schedule=self.schedule,
            )

    def _dates(self):
        return list(
            ActivitySessionRecord.objects.order_by("date").values_list(
                "date", flat=True
            )
        )

    def test_one_recovery_does_not_forgive_two_absences(self):
        # El socio faltó el 07 y el 14 de enero: el cron descuenta las dos.
        self._run_cron(FIXED_TODAY)
        self.assertEqual(self._dates(), [date(2030, 1, 7), date(2030, 1, 14)])

        # El staff otorga una recuperación: perdona la falta más reciente.
        self._grant_recovery()
        self.assertEqual(self._dates(), [date(2030, 1, 7)])

        # El socio vuelve a faltar (la clase del lunes 21, que el primer
        # barrido todavía no había descontado). Esa falta **no** está
        # perdonada: la recuperación ya cubrió la del 14.
        self._run_cron(NEXT_DAY)

        self.assertEqual(self._dates(), [date(2030, 1, 7), date(2030, 1, 21)])

    def test_recovery_granted_before_the_cron_covers_one_absence(self):
        # El staff otorga la recuperación antes de que el cron registre la
        # falta: el crédito queda "en vuelo" y el cron lo aplica a la falta
        # pendiente. Sólo a una.
        self._grant_recovery()

        self._run_cron(FIXED_TODAY)
        self.assertEqual(
            self._dates(),
            [date(2030, 1, 7)],
            "La recuperación en vuelo perdona la falta más reciente",
        )

        # La falta siguiente (la clase del lunes 21) sí se descuenta: el
        # crédito ya cubrió la del 14.
        self._run_cron(NEXT_DAY)

        self.assertEqual(self._dates(), [date(2030, 1, 7), date(2030, 1, 21)])

    def test_recovery_does_not_forgive_one_absence_per_enrollment(self):
        # El socio está inscripto en dos horarios de la misma actividad
        # (lunes y miércoles): una recuperación perdona una falta, no una
        # por inscripción.
        from activities.models import ActivitySchedule, Enrollment

        wednesday = ActivitySchedule.objects.create(
            activity=self.activity,
            day="wednesday",
            start_time=self.schedule.start_time,
            end_time=self.schedule.end_time,
            capacity=10,
        )
        second = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=wednesday,
            modality="package",
            package_total_sessions=10,
            session_price=self.enrollment.session_price,
            amount_paid=self.enrollment.amount_paid,
        )
        self._backdate(wednesday, "created_at", date(2030, 1, 1))
        self._backdate(second, "enrolled_at", date(2030, 1, 1))

        # Recuperación otorgada antes del barrido: el crédito está en vuelo.
        self._grant_recovery()

        self._run_cron(FIXED_TODAY)

        # Faltaron los lunes 07 y 14 y los miércoles 02, 09 y 16: una sola
        # recuperación perdona una sola falta.
        self.assertEqual(
            self._dates(),
            [
                date(2030, 1, 2),
                date(2030, 1, 7),
                date(2030, 1, 9),
                date(2030, 1, 16),
            ],
        )


class Add29WatermarkDoesNotSkipUnchargedAbsencesTests(BaseAPITest):
    """ADD-29: el watermark no puede avanzar sobre faltas que no se cobraron.

    Si el paquete está agotado (o la lista de faltas se trunca por el tope),
    el barrido no cobra nada pero avanzaba el watermark igual: esas faltas
    se perdían para siempre y el socio recibía sesiones que no pagó.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.member = self.create_member(self.gym)
        self.activity, self.schedule, self.enrollment = self.create_activity_package(
            gym=self.gym,
            member=self.member,
            total=2,
            created_at=date(2030, 1, 1),
        )

    def _run_cron(self, today):
        with mock.patch("django.utils.timezone.localdate", return_value=today):
            return deduct_missed_activity_enrollments(self.gym)

    def _attend(self, date_):
        ActivitySessionRecord.objects.create(
            gym=self.gym,
            member=self.member,
            enrollment=self.enrollment,
            schedule=self.schedule,
            date=date_,
            source="checkin",
        )

    def _dates(self):
        return list(
            ActivitySessionRecord.objects.order_by("date").values_list(
                "date", flat=True
            )
        )

    def test_absences_of_an_exhausted_package_are_not_lost(self):
        from activities.models import Enrollment

        # El socio usó su única sesión del paquete.
        Enrollment.objects.filter(pk=self.enrollment.pk).update(
            package_total_sessions=1
        )
        self.enrollment.refresh_from_db()
        self._attend(date(2030, 1, 7))
        # Y faltó a la clase del 14: el paquete está agotado, así que el
        # barrido no puede cobrar la falta todavía.
        self._run_cron(FIXED_TODAY)

        self.assertEqual(self._dates(), [date(2030, 1, 7)])
        self.enrollment.refresh_from_db()
        self.assertIsNone(
            self.enrollment.no_show_scan_until,
            "El watermark no puede avanzar sobre una falta que no se cobró",
        )

        # El staff agrega una sesión: la falta pendiente se cobra.
        from activities.session_service import SessionService

        SessionService.renew_package(self.enrollment, 1)
        self._run_cron(FIXED_TODAY)

        self.assertEqual(
            self._dates(), [date(2030, 1, 7), date(2030, 1, 14)]
        )

    def test_truncated_list_of_absences_keeps_the_pending_ones(self):
        # Queda una sola sesión en el paquete y el socio faltó a dos clases.
        self._attend(date(2030, 1, 7))
        self._run_cron(NEXT_DAY)

        # Se cobra la más antigua (la que entra en el paquete)...
        self.assertEqual(
            self._dates(), [date(2030, 1, 7), date(2030, 1, 14)]
        )
        # ...y la otra queda pendiente: el watermark no pasó de la cobrada.
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.no_show_scan_until, date(2030, 1, 14))

        # El staff agrega una sesión: la falta pendiente se cobra.
        from activities.session_service import SessionService

        SessionService.renew_package(self.enrollment, 1)
        self._run_cron(NEXT_DAY)

        self.assertEqual(
            self._dates(),
            [date(2030, 1, 7), date(2030, 1, 14), date(2030, 1, 21)],
        )


class Add05SlotDurationTests(BaseAPITest):
    """ADD-05: el bloque del gym tiene duración real, no siempre 1 hora.

    ``ScheduleSlot`` sólo guardaba día y hora, así que todos los choques
    asumían que el bloque duraba 60 minutos. Con un bloque de 90 minutos
    (una clase de spinning, por ejemplo) el socio podía quedar anotado en
    el gym y en una actividad al mismo tiempo.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "activities": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="monthly",
            monthly_price=Decimal("5000.00"),
        )
        # La clase empieza cuando el bloque del gym todavía sigue.
        self.schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(10, 0),
            end_time=time(11, 0),
            capacity=10,
        )

    def _gym_slot(self, duration_minutes):
        slot = ScheduleSlot.objects.create(
            gym=self.gym,
            day="monday",
            hour=time(9, 0),
            duration_minutes=duration_minutes,
        )
        self.create_attendance_schedule(self.member, self.gym, slot)
        return slot

    def test_long_gym_block_conflicts_with_the_activity(self):
        self._gym_slot(90)

        with self.assertRaises(EnrollmentError) as ctx:
            EnrollmentService.enroll_member(
                self.member, self.schedule, skip_eligibility_check=True
            )

        self.assertIn("gimnasio", str(ctx.exception).lower())

    def test_one_hour_gym_block_does_not_conflict(self):
        self._gym_slot(60)

        enrollment = EnrollmentService.enroll_member(
            self.member, self.schedule, skip_eligibility_check=True
        )

        self.assertTrue(enrollment.active)

    def test_onboarding_validation_uses_the_real_duration(self):
        from activities.overlap import validate_gym_activity_overlap

        slot = self._gym_slot(90)

        with self.assertRaises(ValueError):
            validate_gym_activity_overlap([slot], [self.schedule])
