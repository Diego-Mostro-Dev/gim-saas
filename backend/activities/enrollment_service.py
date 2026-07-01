from subscriptions.services import can_member_operate, member_has_active_subscription_for_service

from .models import Enrollment
from .overlap import validate_enrollment


class EnrollmentError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class EnrollmentService:
    @staticmethod
    def enroll_member(member, schedule):
        if not can_member_operate(member):
            raise EnrollmentError("El miembro no puede operar.")

        if not member_has_active_subscription_for_service(member, schedule.activity.service):
            raise EnrollmentError(
                "El miembro no tiene una suscripción activa "
                "para el servicio de esta actividad."
            )

        active_count = Enrollment.objects.filter(
            gym=member.gym, schedule=schedule, active=True
        ).count()
        if active_count >= schedule.capacity:
            raise EnrollmentError("El horario alcanzó su capacidad máxima.")

        if Enrollment.objects.filter(
            gym=member.gym, member=member, schedule=schedule, active=True
        ).exists():
            raise EnrollmentError(
                "El miembro ya está inscripto en este horario.",
                status_code=409,
            )

        try:
            validate_enrollment(member, schedule)
        except ValueError as e:
            raise EnrollmentError(str(e))

        return Enrollment.objects.create(
            gym=member.gym,
            member=member,
            schedule=schedule,
            active=True,
        )

    @staticmethod
    def unenroll_member(member, schedule):
        enrollment = Enrollment.objects.filter(
            gym=member.gym,
            member=member,
            schedule=schedule,
            active=True,
        ).first()
        if enrollment is None:
            raise EnrollmentError(
                "No se encontró una inscripción activa.",
                status_code=404,
            )
        enrollment.active = False
        enrollment.save(update_fields=["active"])
        return enrollment
