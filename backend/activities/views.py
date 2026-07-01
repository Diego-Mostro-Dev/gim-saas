from django.core.exceptions import PermissionDenied
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets
from rest_framework.response import Response

from core.mixins import GymQuerysetMixin
from core.viewsets import GymModelViewSet
from gyms.features import require_activities
from members.models import Member

from .enrollment_service import EnrollmentError, EnrollmentService
from .models import Activity, ActivitySchedule, Enrollment
from .serializers import (
    ActivitySerializer,
    ActivityScheduleSerializer,
    EnrollmentSerializer,
)


class ActivitiesGuardMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_activities(self.get_gym())


class ActivityViewSet(ActivitiesGuardMixin, GymModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    ordering = ["name"]

    def get_queryset(self):
        return Activity.objects.filter(service__gym=self.get_gym())

    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "No se puede eliminar la actividad porque tiene "
                        "horarios con inscripciones activas."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


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
        activity_id = self.kwargs.get("activity_id")
        if activity_id:
            qs = qs.filter(activity_id=activity_id)
        return qs

    def perform_create(self, serializer):
        gym = self.get_gym()
        activity_id = self.kwargs.get("activity_id")
        activity = get_object_or_404(Activity, id=activity_id, service__gym=gym)
        serializer.save(activity=activity)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "No se puede eliminar el horario porque tiene "
                        "inscripciones."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class EnrollmentViewSet(ActivitiesGuardMixin, GymModelViewSet):
    queryset = Enrollment.objects.all()
    serializer_class = EnrollmentSerializer


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
        ).select_related("member").order_by("-enrolled_at")

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
            activity__active=True,
        )

        member_id = request.data.get("member_id")
        if not member_id:
            return Response(
                {"detail": "El campo member_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id, gym=gym)

        try:
            enrollment = EnrollmentService.enroll_member(member, schedule)
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
