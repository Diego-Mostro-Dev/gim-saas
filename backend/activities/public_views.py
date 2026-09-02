from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from gyms.features import require_activities
from gyms.models import Gym
from members.models import Member
from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain
from config.api.throttles import PublicMemberRateThrottle

from .enrollment_service import EnrollmentError, EnrollmentService
from .models import Activity, ActivitySchedule, Enrollment
from .serializers import PublicEnrollmentSerializer


class PublicMemberEnrollmentsView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_activities(gym)

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
        gym = SubscriptionDomain.resolve_gym(member)
        require_activities(gym)

        if not MemberEligibility.can_operate(member):
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

        schedule = get_object_or_404(
            ActivitySchedule,
            id=schedule_id,
            activity__service__gym=gym,
        )

        try:
            enrollment = EnrollmentService.enroll_member(member, schedule)
        except EnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = PublicEnrollmentSerializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
            for schedule in activity.schedules.filter(active=True):
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
                "monthly_price": str(activity.monthly_price),
                "schedules": schedules,
            })

        return Response(result)


class PublicAvailableActivitiesView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_activities(gym)

        activity_id = request.query_params.get("activity_id")
        day = request.query_params.get("day")
        start_time = request.query_params.get("start_time")
        end_time = request.query_params.get("end_time")

        activities = Activity.objects.filter(
            service__gym=gym,
            active=True,
        ).prefetch_related("schedules")

        if activity_id:
            activities = activities.filter(id=activity_id)

        result = []
        for activity in activities:
            schedules = []
            for schedule in activity.schedules.filter(active=True):
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

            if not schedules:
                continue

            result.append({
                "id": activity.id,
                "name": activity.name,
                "description": activity.description,
                "monthly_price": str(activity.monthly_price),
                "schedules": schedules,
            })

        if day and start_time and end_time:
            def match_key(a):
                for s in a["schedules"]:
                    if s["day"] == day and s["start_time"] == start_time and s["end_time"] == end_time:
                        return 0
                return 1
            result.sort(key=match_key)

        return Response(result)


class PublicMemberEnrollView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_activities(gym)

        schedule_id = request.data.get("schedule_id")
        if not schedule_id:
            return Response(
                {"detail": "El campo schedule_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedule = get_object_or_404(
            ActivitySchedule,
            id=schedule_id,
            activity__service__gym=gym,
            active=True,
            activity__active=True,
        )

        try:
            enrollment = EnrollmentService.enroll_member(member, schedule)
        except EnrollmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = PublicEnrollmentSerializer(enrollment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
