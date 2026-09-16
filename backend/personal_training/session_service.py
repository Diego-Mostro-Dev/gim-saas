from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import PersonalTrainingSessionRecord


class SessionError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class SessionService:
    @staticmethod
    def record_session(assignment, session_date, source="manual"):
        """Register one attended PT session for a package assignment.

        Idempotent per (assignment, date).
        """
        if assignment.modality != "package":
            raise SessionError("La asignación no es de modalidad paquete.")

        if not assignment.active:
            raise SessionError("La asignación está inactiva.")

        if assignment.exhausted:
            raise SessionError("El paquete de sesiones está agotado.")

        with transaction.atomic():
            try:
                record = PersonalTrainingSessionRecord.objects.create(
                    gym=assignment.gym,
                    member=assignment.member,
                    assignment=assignment,
                    date=session_date,
                    source=source,
                )
            except IntegrityError:
                raise SessionError(
                    "La sesión ya fue registrada para esa fecha.",
                    status_code=409,
                )

        return record

    @staticmethod
    def remove_session(assignment, session_date):
        """Remove a recorded PT session (correction)."""
        if assignment.modality != "package":
            raise SessionError("La asignación no es de modalidad paquete.")

        deleted, _ = PersonalTrainingSessionRecord.objects.filter(
            assignment=assignment,
            date=session_date,
        ).delete()
        if deleted == 0:
            raise SessionError(
                "No hay ninguna sesión registrada en esa fecha.",
                status_code=404,
            )
        return deleted

    @staticmethod
    def renew_package(assignment, additional_sessions):
        """Staff renews the package adding N more sessions."""
        if assignment.modality != "package":
            raise SessionError("La asignación no es de modalidad paquete.")

        try:
            additional = int(additional_sessions)
        except (TypeError, ValueError):
            raise SessionError(
                "La cantidad de sesiones debe ser un número válido."
            )

        if additional <= 0:
            raise SessionError("La cantidad de sesiones debe ser mayor a cero.")

        if (
            assignment.session_price is not None
            and assignment.remaining_amount is not None
            and assignment.remaining_amount > 0
        ):
            raise SessionError(
                "El socio tiene sesiones sin cobrar. "
                "Cobrá antes de renovar el paquete."
            )

        total = assignment.package_total_sessions or 0
        assignment.package_total_sessions = total + additional
        assignment.sellado_paid = False
        assignment.active = True

        update_fields = ["package_total_sessions", "sellado_paid", "active"]

        if assignment.member.is_comp:
            assignment.session_price = Decimal("0")
            update_fields.append("session_price")

        assignment.save(update_fields=update_fields)
        return assignment