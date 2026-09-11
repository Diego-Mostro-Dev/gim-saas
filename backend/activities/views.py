from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import GymQuerysetMixin
from core.viewsets import GymModelViewSet
from gyms.features import require_activities
from members.models import Member
from payments.models import Payment

from .enrollment_service import EnrollmentError, EnrollmentService
from .models import Activity, ActivitySchedule, Enrollment
from .serializers import (
    ActivitySerializer,
    ActivityScheduleSerializer,
    EnrollmentSerializer,
)
from .session_service import SessionError, SessionService


class ActivitiesGuardMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_activities(self.get_gym())


class ActivityViewSet(ActivitiesGuardMixin, GymModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    ordering = ["name"]

    def get_queryset(self):
        qs = Activity.objects.filter(service__gym=self.get_gym())
        qs = qs.annotate(
            enrolled_count=Count(
                "schedules__enrollments",
                filter=Q(schedules__enrollments__active=True),
                distinct=True,
            ),
            schedule_count=Count(
                "schedules",
                filter=Q(schedules__active=True),
                distinct=True,
            ),
        )
        if self.action == "list":
            active = self.request.query_params.get("active")
            if active is not None:
                active = active.lower() in ("true", "1", "yes")
                qs = qs.filter(active=active)
            else:
                qs = qs.filter(active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())

    def destroy(self, request, *args, **kwargs):
        activity = self.get_object()
        activity.active = False
        activity.save(update_fields=["active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        activity = self.get_object()

        activity.active = True
        activity.save(update_fields=["active"])
        ActivitySchedule.objects.filter(activity=activity).update(active=True)

        serializer = self.get_serializer(activity)
        return Response(serializer.data)


class ActivityScheduleViewSet(ActivitiesGuardMixin, viewsets.ModelViewSet):
    queryset = ActivitySchedule.objects.all()
    serializer_class = ActivityScheduleSerializer

    def get_gym(self):
        user = self.request.user
        if not hasattr(user, "profile") or not user.profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")
        return user.profile.gym

    def get_queryset(self):
        gym = self.get_gym()
        qs = ActivitySchedule.objects.filter(activity__service__gym=gym)
        if self.action == "list":
            active = self.request.query_params.get("active")
            if active is not None:
                active = active.lower() in ("true", "1", "yes")
                qs = qs.filter(active=active)
            else:
                qs = qs.filter(active=True)
        activity_id = self.kwargs.get("activity_id")
        if activity_id:
            qs = qs.filter(activity_id=activity_id)
        return qs

    def perform_create(self, serializer):
        gym = self.get_gym()
        activity_id = self.kwargs.get("activity_id")
        activity = get_object_or_404(Activity, id=activity_id, service__gym=gym)
        schedule = serializer.save(activity=activity)

        if not activity.active and schedule.active and activity.schedules.filter(active=True).count() >= 1:
            activity.active = True
            activity.save(update_fields=["active"])

    def destroy(self, request, *args, **kwargs):
        schedule = self.get_object()
        if schedule.activity.active and ActivitySchedule.objects.filter(
            activity=schedule.activity, active=True
        ).count() <= 1:
            return Response(
                {"detail": "No se puede desactivar el único horario activo de la actividad."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        schedule.active = False
        schedule.save(update_fields=["active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduleEnrollmentViewSet(ActivitiesGuardMixin, GymQuerysetMixin, viewsets.GenericViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    ordering = ["-enrolled_at"]

    def get_queryset(self):
        gym = self.get_gym()
        schedule = get_object_or_404(
            ActivitySchedule,
            id=self.kwargs["schedule_id"],
            activity__service__gym=gym,
        )
        return Enrollment.objects.filter(
            gym=gym,
            schedule=schedule,
            active=True,
        ).select_related("member", "member__insurance").annotate(
            used_sessions_count=Count("session_records"),
            last_session_date=Max("session_records__date"),
        ).order_by("-enrolled_at")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def enroll(self, request, *args, **kwargs):
        gym = self.get_gym()
        schedule = get_object_or_404(
            ActivitySchedule,
            id=self.kwargs["schedule_id"],
            activity__service__gym=gym,
            active=True,
            activity__active=True,
        )

        member_id = request.data.get("member_id")
        if not member_id:
            return Response(
                {"detail": "El campo member_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id, gym=gym)

        modality = request.data.get("modality", "monthly")
        package_total_sessions = request.data.get("package_total_sessions")

        session_price = request.data.get("session_price")
        if session_price not in (None, ""):
            try:
                session_price = Decimal(str(session_price))
            except (InvalidOperation, ValueError):
                return Response(
                    {"detail": "El precio por sesión debe ser un monto válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            session_price = None

        sellado_amount = request.data.get("sellado_amount")
        if sellado_amount not in (None, ""):
            try:
                sellado_amount = Decimal(str(sellado_amount))
            except (InvalidOperation, ValueError):
                return Response(
                    {"detail": "El sellado/coseguro debe ser un monto válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            sellado_amount = None

        try:
            enrollment = EnrollmentService.enroll_member(
                member,
                schedule,
                modality=modality,
                package_total_sessions=package_total_sessions,
                session_price=session_price,
                sellado_amount=sellado_amount,
            )
        except EnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def unenroll(self, request, *args, **kwargs):
        gym = self.get_gym()
        schedule = get_object_or_404(
            ActivitySchedule,
            id=self.kwargs["schedule_id"],
            activity__service__gym=gym,
        )

        member_id = request.data.get("member_id")
        if not member_id:
            return Response(
                {"detail": "El campo member_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id, gym=gym)

        try:
            enrollment = EnrollmentService.unenroll_member(member, schedule)
        except EnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_200_OK)


class EnrollmentActionViewSet(ActivitiesGuardMixin, GymQuerysetMixin, viewsets.GenericViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer
    lookup_field = "pk"

    def get_queryset(self):
        gym = self.get_gym()
        return Enrollment.objects.filter(
            gym=gym,
            active=True,
        ).select_related("member__insurance", "member", "schedule__activity").annotate(
            used_sessions_count=Count("session_records"),
            last_session_date=Max("session_records__date"),
        )

    @action(detail=True, methods=["post"])
    def record_session(self, request, pk=None):
        enrollment = self.get_object()
        session_date = request.data.get("date")
        if session_date:
            try:
                session_date = date.fromisoformat(session_date)
            except ValueError:
                return Response(
                    {"detail": "Fecha inválida."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            session_date = timezone.localdate()

        try:
            record = SessionService.record_session(enrollment, session_date)
        except SessionError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        return Response(
            {"detail": "Sesión registrada.", "date": record.date.isoformat()},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def remove_session(self, request, pk=None):
        enrollment = self.get_object()
        session_date = request.data.get("date")
        if not session_date:
            return Response(
                {"detail": "El campo date es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            session_date = date.fromisoformat(session_date)
        except ValueError:
            return Response(
                {"detail": "Fecha inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            SessionService.remove_session(enrollment, session_date)
        except SessionError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        return Response({"detail": "Sesión eliminada."})

    @action(detail=True, methods=["post"])
    def renew(self, request, pk=None):
        enrollment = self.get_object()
        additional_sessions = request.data.get("additional_sessions")

        try:
            enrollment = SessionService.renew_package(
                enrollment, additional_sessions
            )
        except SessionError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        return Response(self.get_serializer(enrollment).data)

    @action(detail=True, methods=["post"])
    def toggle_sellado(self, request, pk=None):
        enrollment = self.get_object()
        enrollment.sellado_paid = not enrollment.sellado_paid
        enrollment.save(update_fields=["sellado_paid"])
        return Response(self.get_serializer(enrollment).data)

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        enrollment = self.get_object()
        amount = request.data.get("amount")
        payment_method = request.data.get("payment_method", "cash")
        notes = request.data.get("notes", "")
        try:
            enrollment = EnrollmentService.record_package_payment(
                enrollment,
                amount,
                payment_method=payment_method,
                notes=notes,
            )
        except EnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(enrollment).data)

    @action(detail=True, methods=["post"])
    def pay_sellado(self, request, pk=None):
        enrollment = self.get_object()

        if enrollment.member.is_comp:
            return Response(
                {"detail": "Socio con pase de cortesía: no se le cobra por las sesiones."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if enrollment.sellado_amount is None:
            return Response(
                {"detail": "Este paquete no tiene sellado configurado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if enrollment.sellado_paid:
            return Response(
                {"detail": "El sellado ya fue cobrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_amount = request.data.get("amount")
        if raw_amount in (None, ""):
            raw_amount = enrollment.sellado_amount

        try:
            amount = Decimal(str(raw_amount))
        except (InvalidOperation, ValueError):
            return Response(
                {"detail": "El monto del sellado debe ser un valor válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount <= 0:
            return Response(
                {"detail": "El monto del sellado debe ser mayor a cero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_method = request.data.get("payment_method", "cash")
        notes = request.data.get("notes", "")

        with transaction.atomic():
            locked = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
            locked.sellado_paid = True
            locked.save(update_fields=["sellado_paid"])

            Payment.objects.create(
                gym=locked.gym,
                member=locked.member,
                enrollment=locked,
                concept="sellado",
                amount=amount,
                payment_method=payment_method,
                notes=notes,
                member_name=(
                    f"{locked.member.first_name} {locked.member.last_name}"
                ),
                plan_name=f"{locked.schedule.activity.name} · Sellado",
            )

        return Response(self.get_serializer(locked).data)
