from rest_framework.views import APIView
from rest_framework.response import Response

from .models import AttendanceSchedule
from .serializers import AttendanceScheduleSerializer


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