from datetime import date
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import GymQuerysetMixin
from core.viewsets import GymModelViewSet
from gyms.features import require_outings
from members.models import Member
from profiles.models import UserProfile

from .enrollment_request_service import (
    OutingEnrollmentRequestError,
    OutingEnrollmentRequestService,
)
from .enrollment_service import OutingEnrollmentError, OutingEnrollmentService
from .models import (
    Outing,
    OutingEnrollment,
    OutingEnrollmentRequest,
    OutingSchedule,
)
from .serializers import (
    OutingEnrollmentSerializer,
    OutingScheduleSerializer,
    OutingSerializer,
    StaffOutingEnrollmentRequestSerializer,
)
from .session_service import SessionError, SessionService


class OutingsGuardMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_outings(self.get_gym())


class OutingViewSet(OutingsGuardMixin, GymModelViewSet):
    queryset = Outing.objects.all()
    serializer_class = OutingSerializer
    ordering = ["name"]

    def get_queryset(self):
        qs = Outing.objects.filter(service__gym=self.get_gym())
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
        outing = self.get_object()
        outing.active = False
        outing.save(update_fields=["active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        outing = self.get_object()

        outing.active = True
        outing.save(update_fields=["active"])
        OutingSchedule.objects.filter(outing=outing).update(active=True)

        serializer = self.get_serializer(outing)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def trainers(self, request):
        gym = self.get_gym()
        User = get_user_model()
        trainers = (
            User.objects.filter(
                profile__gym=gym,
                profile__role=UserProfile.ROLE_TRAINER,
            )
            .select_related("profile")
            .order_by("first_name", "username")
        )
        return Response(
            [
                {
                    "id": t.id,
                    "name": t.get_full_name() or t.username,
                    "username": t.username,
                }
                for t in trainers
            ]
        )


class OutingScheduleViewSet(OutingsGuardMixin, viewsets.ModelViewSet):
    queryset = OutingSchedule.objects.all()
    serializer_class = OutingScheduleSerializer

    def get_gym(self):
        user = self.request.user
        if not hasattr(user, "profile") or not user.profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")
        return user.profile.gym

    def get_queryset(self):
        gym = self.get_gym()
        qs = OutingSchedule.objects.filter(outing__service__gym=gym)
        if self.action == "list":
            active = self.request.query_params.get("active")
            if active is not None:
                active = active.lower() in ("true", "1", "yes")
                qs = qs.filter(active=active)
            else:
                qs = qs.filter(active=True)
        outing_id = self.kwargs.get("outing_id")
        if outing_id:
            qs = qs.filter(outing_id=outing_id)
        return qs

    def perform_create(self, serializer):
        gym = self.get_gym()
        outing_id = self.kwargs.get("outing_id")
        outing = get_object_or_404(Outing, id=outing_id, service__gym=gym)
        schedule = serializer.save(outing=outing)

        if (
            not outing.active
            and schedule.active
            and outing.schedules.filter(active=True).count() >= 1
        ):
            outing.active = True
            outing.save(update_fields=["active"])

    def destroy(self, request, *args, **kwargs):
        schedule = self.get_object()
        if schedule.outing.active and OutingSchedule.objects.filter(
            outing=schedule.outing, active=True
        ).count() <= 1:
            return Response(
                {"detail": "No se puede desactivar el único horario activo de la salida."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        schedule.active = False
        schedule.save(update_fields=["active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduleOutingEnrollmentViewSet(
    OutingsGuardMixin, GymQuerysetMixin, viewsets.GenericViewSet
):
    queryset = OutingEnrollment.objects.all()
    serializer_class = OutingEnrollmentSerializer
    ordering = ["-enrolled_at"]

    def get_queryset(self):
        gym = self.get_gym()
        schedule = get_object_or_404(
            OutingSchedule,
            id=self.kwargs["schedule_id"],
            outing__service__gym=gym,
        )
        return OutingEnrollment.objects.filter(
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
            OutingSchedule,
            id=self.kwargs["schedule_id"],
            outing__service__gym=gym,
            active=True,
            outing__active=True,
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

        try:
            enrollment = OutingEnrollmentService.enroll_member(
                member,
                schedule,
                modality=modality,
                package_total_sessions=package_total_sessions,
                session_price=session_price,
            )
        except OutingEnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def unenroll(self, request, *args, **kwargs):
        gym = self.get_gym()
        schedule = get_object_or_404(
            OutingSchedule,
            id=self.kwargs["schedule_id"],
            outing__service__gym=gym,
        )

        member_id = request.data.get("member_id")
        if not member_id:
            return Response(
                {"detail": "El campo member_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id, gym=gym)

        try:
            enrollment = OutingEnrollmentService.unenroll_member(member, schedule)
        except OutingEnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = self.get_serializer(enrollment)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OutingEnrollmentRequestViewSet(
    OutingsGuardMixin, GymQuerysetMixin, viewsets.ModelViewSet
):
    queryset = OutingEnrollmentRequest.objects.all()
    serializer_class = StaffOutingEnrollmentRequestSerializer
    ordering = ["-requested_at"]

    def get_queryset(self):
        qs = OutingEnrollmentRequest.objects.filter(
            gym=self.get_gym()
        ).select_related(
            "member",
            "schedule__outing__trainer",
            "enrollment",
            "reviewed_by",
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        request_type = self.request.query_params.get("request_type")
        if request_type:
            qs = qs.filter(request_type=request_type)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        enrollment_request = self.get_object()
        admin_notes = request.data.get("admin_notes", "")
        try:
            enrollment_request = OutingEnrollmentRequestService.approve_request(
                enrollment_request,
                reviewer=request.user,
                admin_notes=admin_notes,
            )
        except OutingEnrollmentRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(enrollment_request).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        enrollment_request = self.get_object()
        admin_notes = request.data.get("admin_notes", "")
        try:
            enrollment_request = OutingEnrollmentRequestService.reject_request(
                enrollment_request,
                reviewer=request.user,
                admin_notes=admin_notes,
            )
        except OutingEnrollmentRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(enrollment_request).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        enrollment_request = self.get_object()
        try:
            enrollment_request = OutingEnrollmentRequestService.cancel_request(
                enrollment_request,
                cancelled_by="cancelled_by_staff",
            )
        except OutingEnrollmentRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(enrollment_request).data)


class OutingEnrollmentActionViewSet(
    OutingsGuardMixin, GymQuerysetMixin, viewsets.GenericViewSet
):
    queryset = OutingEnrollment.objects.all()
    serializer_class = OutingEnrollmentSerializer
    lookup_field = "pk"

    def get_queryset(self):
        gym = self.get_gym()
        return OutingEnrollment.objects.filter(
            gym=gym,
            active=True,
        ).select_related("member__insurance", "member", "schedule__outing").annotate(
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
    def record_payment(self, request, pk=None):
        enrollment = self.get_object()
        amount = request.data.get("amount")

        try:
            enrollment = OutingEnrollmentService.record_package_payment(
                enrollment,
                amount,
                payment_method=request.data.get("payment_method") or "cash",
                notes=request.data.get("notes") or "",
            )
        except OutingEnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(enrollment).data)