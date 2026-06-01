from datetime import date

from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view

from .models import (
    AttendanceSchedule,
    Attendance,
)

from .serializers import (
    AttendanceScheduleSerializer,
    AttendanceSerializer,
)


class WeeklyScheduleView(APIView):
    def get(self, request):
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
                day=day
            ).select_related("member")

            result[day] = AttendanceScheduleSerializer(
                schedules,
                many=True,
            ).data

        return Response(result)


@api_view(["GET"])
def members_by_schedule(request):
    day = request.GET.get("day")
    hour = request.GET.get("hour")

    schedules = AttendanceSchedule.objects.filter(
        day=day,
        hour=hour,
    ).select_related("member")

    return Response(
        [
            {
                "schedule_id": schedule.id,
                "member_id": schedule.member.id,
                "member_name": (
                    f"{schedule.member.first_name} "
                    f"{schedule.member.last_name}"
                ),
            }
            for schedule in schedules
        ]
    )


@api_view(["GET"])
def attendance_status(request):
    day = request.GET.get("day")
    hour = request.GET.get("hour")

    schedules = AttendanceSchedule.objects.filter(
        day=day,
        hour=hour,
    ).select_related("member")

    today = date.today()

    result = []

    for schedule in schedules:
        attended = Attendance.objects.filter(
            schedule=schedule,
            date=today,
        ).exists()

        result.append(
            {
                "schedule_id": schedule.id,
                "member_id": schedule.member.id,
                "member_name": (
                    f"{schedule.member.first_name} "
                    f"{schedule.member.last_name}"
                ),
                "attended": attended,
            }
        )

    return Response(result)

class AttendanceCreateView(
    generics.CreateAPIView
):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer