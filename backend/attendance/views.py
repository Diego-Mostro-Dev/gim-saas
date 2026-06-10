from datetime import date

from django.db.models.deletion import ProtectedError
from django.utils import timezone

from rest_framework import generics, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view
from rest_framework import status

from .models import AttendanceSchedule, Attendance, ScheduleSlot, ScheduleChangeRequest
from .serializers import (
    AttendanceScheduleSerializer,
    AttendanceSerializer,
    ScheduleSlotSerializer,
    ScheduleChangeRequestSerializer,
    ScheduleChangeRequestActionSerializer,
)


class WeeklyScheduleView(APIView):
    def get(self, request):
        gym = request.user.profile.gym

        days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
        ]

        result = {}

        for day in days:
            schedules = AttendanceSchedule.objects.filter(
                gym=gym,
                slot__day=day,
                active=True,
            ).select_related("member", "slot")

            result[day] = AttendanceScheduleSerializer(
                schedules,
                many=True
            ).data

        return Response(result)


@api_view(["GET"])
def members_by_schedule(request):
    gym = request.user.profile.gym

    day = request.GET.get("day")
    hour = request.GET.get("hour")

    schedules = AttendanceSchedule.objects.filter(
        gym=gym,
        slot__day=day,
        slot__hour=hour,
        active=True,
    ).select_related("member", "slot")

    return Response([
        {
            "schedule_id": s.id,
            "member_id": s.member.id,
            "member_name": f"{s.member.first_name} {s.member.last_name}",
        }
        for s in schedules
    ])


@api_view(["GET"])
def attendance_status(request):
    gym = request.user.profile.gym

    day = request.GET.get("day")
    hour = request.GET.get("hour")

    schedules = AttendanceSchedule.objects.filter(
        gym=gym,
        slot__day=day,
        slot__hour=hour,
        active=True,
    ).select_related("member", "slot")

    today = date.today()

    result = []

    for schedule in schedules:
        attended = Attendance.objects.filter(
            gym=gym,
            schedule=schedule,
            date=today,
        ).exists()

        result.append({
            "schedule_id": schedule.id,
            "member_id": schedule.member.id,
            "member_name": f"{schedule.member.first_name} {schedule.member.last_name}",
            "attended": attended,
        })

    return Response(result)


class AttendanceCreateView(generics.CreateAPIView):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer


class ScheduleSlotListCreateView(generics.ListCreateAPIView):
    serializer_class = ScheduleSlotSerializer

    def get_queryset(self):
        return ScheduleSlot.objects.filter(
            gym=self.request.user.profile.gym,
        ).order_by("day", "hour")

    def perform_create(self, serializer):
        serializer.save(gym=self.request.user.profile.gym)


class ScheduleSlotDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ScheduleSlotSerializer

    def get_queryset(self):
        return ScheduleSlot.objects.filter(
            gym=self.request.user.profile.gym,
        )

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar el horario porque tiene socios asignados."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ScheduleChangeRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduleChangeRequestSerializer

    def get_serializer_class(self):
        if self.action in ("approve", "reject"):
            return ScheduleChangeRequestActionSerializer
        return ScheduleChangeRequestSerializer

    def get_queryset(self):
        return ScheduleChangeRequest.objects.filter(
            gym=self.request.user.profile.gym,
        ).select_related(
            "member", "current_schedule__slot", "requested_slot", "reviewed_by"
        )

    def perform_create(self, serializer):
        gym = self.request.user.profile.gym
        serializer.save(gym=gym)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._handle_action(request, pk, "approved")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._handle_action(request, pk, "rejected")

    def _handle_action(self, request, pk, new_status):
        instance = self.get_object()

        if instance.status != "pending":
            return Response(
                {"detail": f"No se puede modificar una solicitud con estado '{instance.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ScheduleChangeRequestActionSerializer(
            instance,
            data={**request.data, "status": new_status},
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        if new_status == "approved":
            current_schedule = instance.current_schedule
            requested_slot = instance.requested_slot

            current_schedule.active = False
            current_schedule.save(update_fields=["active"])

            existing = AttendanceSchedule.objects.filter(
                member=instance.member,
                slot=requested_slot,
            ).first()

            if existing:
                existing.active = True
                existing.save(update_fields=["active"])
            else:
                AttendanceSchedule.objects.create(
                    member=instance.member,
                    gym=instance.gym,
                    slot=requested_slot,
                    active=True,
                )

        serializer.save(
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )

        return Response(ScheduleChangeRequestSerializer(instance).data)