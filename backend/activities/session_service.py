from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import ActivitySessionRecord


class SessionError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class SessionService:
    @staticmethod
    def record_session(enrollment, session_date, source="manual", schedule=None):
        """Register one attended session for a package enrollment.

        Idempotent per (enrollment, date, schedule).
        """
        if enrollment.modality != "package":
            raise SessionError("La inscripción no es de modalidad paquete.")

        if not enrollment.active:
            raise SessionError("La inscripción está inactiva.")

        if enrollment.exhausted:
            raise SessionError("El paquete de sesiones está agotado.")

        schedule = schedule or enrollment.schedule

        with transaction.atomic():
            try:
                record = ActivitySessionRecord.objects.create(
                    gym=enrollment.gym,
                    member=enrollment.member,
                    enrollment=enrollment,
                    schedule=schedule,
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
    def record_auto(enrollment, session_date=None):
        """Record an automatically counted session from the check-in flow.

        Returns the created record or None (errors are swallowed: the
        member is still allowed to enter the gym).
        """
        if session_date is None:
            session_date = timezone.localdate()
        try:
            return SessionService.record_session(
                enrollment, session_date, source="auto"
            )
        except SessionError:
            return None

    @staticmethod
    def remove_session(enrollment, session_date):
        """Remove a manually or automatically recorded session (correction)."""
        if enrollment.modality != "package":
            raise SessionError("La inscripción no es de modalidad paquete.")

        deleted, _ = ActivitySessionRecord.objects.filter(
            enrollment=enrollment,
            date=session_date,
        ).delete()
        if deleted == 0:
            raise SessionError(
                "No hay ninguna sesión registrada en esa fecha.",
                status_code=404,
            )
        return deleted

    @staticmethod
    def renew_package(enrollment, additional_sessions):
        """Staff renews the package adding N more sessions.

        The per-session co-pay (`session_price`) is refreshed from the
        member's current health insurance so new sessions use the current
        rate, and the package total recomputes accordingly. The sellado is
        reset to pending so the gym can collect it again for the new package.
        """
        if enrollment.modality != "package":
            raise SessionError("La inscripción no es de modalidad paquete.")

        try:
            additional = int(additional_sessions)
        except (TypeError, ValueError):
            raise SessionError(
                "La cantidad de sesiones debe ser un número válido."
            )

        if additional <= 0:
            raise SessionError("La cantidad de sesiones debe ser mayor a cero.")

        if (
            enrollment.session_price is not None
            and enrollment.remaining_amount is not None
            and enrollment.remaining_amount > 0
        ):
            raise SessionError(
                "El socio tiene sesiones sin cobrar. "
                "Cobrá antes de renovar el paquete."
            )

        total = enrollment.package_total_sessions or 0
        enrollment.package_total_sessions = total + additional
        enrollment.sellado_paid = False
        enrollment.active = True

        update_fields = ["package_total_sessions", "sellado_paid", "active"]

        if enrollment.member.is_comp:
            enrollment.session_price = Decimal("0")
            update_fields.append("session_price")
        else:
            insurance = getattr(enrollment.member, "insurance", None)
            if insurance is not None:
                enrollment.session_price = insurance.session_price
                update_fields.append("session_price")

        enrollment.save(update_fields=update_fields)
        return enrollment