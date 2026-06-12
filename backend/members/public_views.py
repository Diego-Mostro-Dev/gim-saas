from datetime import date, timedelta

from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from gyms.models import Gym
from attendance.models import ScheduleSlot
from plans.models import MembershipPlan
from subscriptions.models import Subscription

from .serializers import MemberSerializer
from config.api.throttles import PublicMemberRateThrottle


class PublicRegisterView(APIView):

    authentication_classes = []
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def post(self, request, gym_code):

        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        serializer = MemberSerializer(
            data=request.data,
            context={
                "gym": gym,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        member = serializer.save(
            gym=gym
        )

        plan_id = request.data.get("plan_id")
        if plan_id:
            try:
                plan = MembershipPlan.objects.get(
                    id=plan_id,
                    gym=gym,
                )
            except (MembershipPlan.DoesNotExist, ValueError):
                return Response(
                    {"plan_id": "El plan seleccionado no es válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            today = date.today()
            Subscription.objects.create(
                gym=gym,
                member=member,
                plan=plan,
                start_date=today,
                end_date=today + timedelta(days=plan.duration_days),
                paid=False,
            )

        return Response(
            MemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )


class PublicSlotsView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, gym_code):
        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        slots = ScheduleSlot.objects.filter(
            gym=gym,
        ).order_by("day", "hour")

        return Response([
            {
                "id": s.id,
                "day": s.day,
                "hour": s.hour.strftime("%H:%M"),
                "capacity": s.capacity,
            }
            for s in slots
        ])


class PublicPlansView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, gym_code):
        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        plans = MembershipPlan.objects.filter(
            gym=gym,
            active=True,
        ).order_by("price")

        return Response([
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "price": str(p.price),
                "duration_days": p.duration_days,
                "weekly_visits": p.weekly_visits,
            }
            for p in plans
        ])