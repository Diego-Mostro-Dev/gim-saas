from django.utils import timezone

from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain

from .enrollment_service import OutingEnrollmentError, OutingEnrollmentService
from .models import OutingEnrollment, OutingEnrollmentRequest


class OutingEnrollmentRequestError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class OutingEnrollmentRequestService:
    @staticmethod
    def create_enroll_request(member, schedule):
        """Create a pending inscription request for an active schedule."""
        gym = SubscriptionDomain.resolve_gym(member)

        if not MemberEligibility.can_operate(member):
            raise OutingEnrollmentRequestError(
                "Acceso suspendido por falta de pago.", status_code=403
            )

        if schedule.outing.billing_mode == "sessions":
            raise OutingEnrollmentRequestError(
                "Esta salida requiere inscripción por el staff.",
                status_code=403,
            )

        if OutingEnrollmentRequest.objects.filter(
            member=member, request_type="enroll", status="pending"
        ).exists():
            raise OutingEnrollmentRequestError(
                "Ya tenés una solicitud de inscripción pendiente.",
                status_code=409,
            )

        active_count = OutingEnrollment.objects.filter(
            gym=gym, schedule=schedule, active=True
        ).count()
        if active_count >= schedule.capacity:
            raise OutingEnrollmentRequestError(
                "El horario alcanzó su capacidad máxima."
            )

        if OutingEnrollment.objects.filter(
            gym=gym, member=member, schedule=schedule, active=True
        ).exists():
            raise OutingEnrollmentRequestError(
                "Ya estás inscripto en este horario.", status_code=409
            )

        return OutingEnrollmentRequest.objects.create(
            gym=gym,
            member=member,
            request_type="enroll",
            outing=schedule.outing,
            schedule=schedule,
        )

    @staticmethod
    def create_unenroll_request(member, enrollment):
        """Create a pending baja request for an active enrollment."""
        gym = SubscriptionDomain.resolve_gym(member)

        if not MemberEligibility.can_operate(member):
            raise OutingEnrollmentRequestError(
                "Acceso suspendido por falta de pago.", status_code=403
            )

        if enrollment.member_id != member.id or not enrollment.active:
            raise OutingEnrollmentRequestError(
                "La inscripción no está activa o no pertenece al socio.",
                status_code=404,
            )

        if OutingEnrollmentRequest.objects.filter(
            member=member, request_type="unenroll", status="pending"
        ).exists():
            raise OutingEnrollmentRequestError(
                "Ya tenés una solicitud de baja pendiente.", status_code=409
            )

        return OutingEnrollmentRequest.objects.create(
            gym=gym,
            member=member,
            request_type="unenroll",
            outing=enrollment.schedule.outing,
            schedule=enrollment.schedule,
            enrollment=enrollment,
        )

    @staticmethod
    def approve_request(request, reviewer, admin_notes=""):
        """Approve and execute a request.

        Enroll: creates the enrollment (covers billing for monthly outings).
        Unenroll: cancels the enrollment and its subscription items.
        """
        if request.status != "pending":
            raise OutingEnrollmentRequestError(
                "La solicitud ya fue revisada.", status_code=409
            )

        if request.request_type == "enroll":
            schedule = request.schedule
            if not schedule.active or not schedule.outing.active:
                raise OutingEnrollmentRequestError(
                    "La salida ya no está activa.", status_code=410
                )
            try:
                OutingEnrollmentService.enroll_member(
                    request.member,
                    schedule,
                    skip_eligibility_check=True,
                )
            except OutingEnrollmentError as e:
                raise OutingEnrollmentRequestError(str(e), status_code=e.status_code)
        else:
            try:
                OutingEnrollmentService.unenroll_member(
                    request.member, request.schedule
                )
            except OutingEnrollmentError as e:
                raise OutingEnrollmentRequestError(str(e), status_code=e.status_code)

        request.status = "approved"
        request.reviewed_by = reviewer
        request.reviewed_at = timezone.now()
        request.admin_notes = admin_notes
        request.save(update_fields=[
            "status", "reviewed_by", "reviewed_at", "admin_notes",
        ])
        return request

    @staticmethod
    def reject_request(request, reviewer, admin_notes=""):
        if request.status != "pending":
            raise OutingEnrollmentRequestError(
                "La solicitud ya fue revisada.", status_code=409
            )

        request.status = "rejected"
        request.reviewed_by = reviewer
        request.reviewed_at = timezone.now()
        request.admin_notes = admin_notes
        request.save(update_fields=[
            "status", "reviewed_by", "reviewed_at", "admin_notes",
        ])
        return request

    @staticmethod
    def cancel_request(request, cancelled_by):
        if request.status != "pending":
            raise OutingEnrollmentRequestError(
                "La solicitud ya fue revisada.", status_code=409
            )
        request.status = cancelled_by
        request.save(update_fields=["status"])
        return request