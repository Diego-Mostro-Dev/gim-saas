from datetime import date

from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import AttendanceSchedule, Attendance, ScheduleSlot
from .serializers import (
    AttendanceScheduleSerializer,
    AttendanceSerializer,
    ScheduleSlotSerializer,
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
                day=day,
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
        day=day,
        hour=hour,
        active=True,
    ).select_related("member")

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
        day=day,
        hour=hour,
        active=True,
    ).select_related("member")

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