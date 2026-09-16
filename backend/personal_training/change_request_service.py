from django.utils import timezone

from .models import PersonalTrainingChangeRequest
from .overlap import validate_assignment


class ChangeRequestError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class ChangeRequestService:
    @staticmethod
    def create_request(assignment, requested_day, requested_start_time,
                       requested_end_time):
        """Create a pending change request for an active assignment."""
        if not assignment.active:
            raise ChangeRequestError(
                "La asignación está inactiva.",
                status_code=404,
            )

        if requested_end_time <= requested_start_time:
            raise ChangeRequestError(
                "La hora de fin debe ser posterior a la hora de inicio."
            )

        if requested_day == assignment.day and (
            requested_start_time == assignment.start_time
            and requested_end_time == assignment.end_time
        ):
            raise ChangeRequestError("El horario solicitado es el mismo que el actual.")

        if PersonalTrainingChangeRequest.objects.filter(
            member=assignment.member,
            assignment=assignment,
            status="pending",
        ).exists():
            raise ChangeRequestError(
                "Ya existe una solicitud de cambio pendiente para esta asignación.",
                status_code=409,
            )

        return PersonalTrainingChangeRequest.objects.create(
            gym=assignment.gym,
            member=assignment.member,
            assignment=assignment,
            requested_day=requested_day,
            requested_start_time=requested_start_time,
            requested_end_time=requested_end_time,
        )

    @staticmethod
    def approve_request(change_request, reviewer, admin_notes=""):
        """Approve and execute a change request.

        Re-validates overlap for the new slot. On success the assignment's
        recurring schedule is updated and the request is marked executed.
        """
        if change_request.status != "pending":
            raise ChangeRequestError(
                "La solicitud ya fue revisada.",
                status_code=409,
            )

        assignment = change_request.assignment

        if not assignment.active:
            raise ChangeRequestError(
                "La asignación está inactiva.",
                status_code=400,
            )

        try:
            validate_assignment(
                assignment.member,
                assignment.trainer,
                change_request.requested_day,
                change_request.requested_start_time,
                change_request.requested_end_time,
                exclude=assignment,
            )
        except ValueError as e:
            raise ChangeRequestError(str(e))

        from .assignment_service import AssignmentService

        AssignmentService.update_assignment(
            assignment,
            day=change_request.requested_day,
            start_time=change_request.requested_start_time,
            end_time=change_request.requested_end_time,
        )

        change_request.status = "executed"
        change_request.reviewed_by = reviewer
        change_request.reviewed_at = timezone.now()
        change_request.admin_notes = admin_notes
        change_request.save(update_fields=[
            "status", "reviewed_by", "reviewed_at", "admin_notes",
        ])

        return change_request

    @staticmethod
    def reject_request(change_request, reviewer, admin_notes=""):
        if change_request.status != "pending":
            raise ChangeRequestError(
                "La solicitud ya fue revisada.",
                status_code=409,
            )

        change_request.status = "rejected"
        change_request.reviewed_by = reviewer
        change_request.reviewed_at = timezone.now()
        change_request.admin_notes = admin_notes
        change_request.save(update_fields=[
            "status", "reviewed_by", "reviewed_at", "admin_notes",
        ])
        return change_request

    @staticmethod
    def cancel_request(change_request, cancelled_by):
        if change_request.status != "pending":
            raise ChangeRequestError(
                "La solicitud ya fue revisada.",
                status_code=409,
            )
        change_request.status = cancelled_by
        change_request.save(update_fields=["status"])
        return change_request