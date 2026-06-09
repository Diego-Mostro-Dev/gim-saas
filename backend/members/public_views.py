from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from gyms.models import Gym
from attendance.models import ScheduleSlot

from .serializers import MemberSerializer


class PublicRegisterView(APIView):

    authentication_classes = []
    permission_classes = []

    def post(self, request, gym_code):

        print("DATA:", request.data)
        print("FILES:", request.FILES)

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

        return Response(
            MemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )


class PublicSlotsView(APIView):
    authentication_classes = []
    permission_classes = []

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