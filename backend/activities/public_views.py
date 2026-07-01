from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from gyms.features import require_activities
from gyms.models import Gym
from members.models import Member
from subscriptions.services import can_member_operate
from config.api.throttles import PublicMemberRateThrottle

from .models import Activity, ActivitySchedule, Enrollment
from .serializers import PublicEnrollmentSerializer


class PublicMemberEnrollmentsView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        require_activities(member.gym)

        enrollments = Enrollment.objects.filter(
            member=member,
            active=True,
        ).select_related(
            "schedule__activity",
        ).order_by("-enrolled_at")

        serializer = PublicEnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        require_activities(member.gym)

        if not can_member_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        schedule_id = request.data.get("schedule_id")
        if not schedule_id:
            return Response(
                {"detail": "El campo schedule_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment = get_object_or_404(
            Enrollment,
            gym=member.gym,
            member=member,
            schedule_id=schedule_id,
            active=True,
        )

        enrollment.active = False
        enrollment.save(update_fields=["active"])

        serializer = PublicEnrollmentSerializer(enrollment)
        return Response(serializer.data)


class PublicGymActivitiesView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, gym_code):
        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )
        require_activities(gym)

        activities = Activity.objects.filter(
            service__gym=gym,
            active=True,
        ).prefetch_related("schedules")

        result = []
        for activity in activities:
            schedules = []
            for schedule in activity.schedules.all():
                enrolled_count = Enrollment.objects.filter(
                    schedule=schedule,
                    active=True,
                ).count()
                available = schedule.capacity - enrolled_count
                if available > 0:
                    schedules.append({
                        "id": schedule.id,
                        "day": schedule.day,
                        "start_time": schedule.start_time.strftime("%H:%M"),
                        "end_time": schedule.end_time.strftime("%H:%M"),
                        "capacity": schedule.capacity,
                        "available_spots": available,
                    })

            result.append({
                "id": activity.id,
                "name": activity.name,
                "description": activity.description,
                "schedules": schedules,
            })

        return Response(result)
