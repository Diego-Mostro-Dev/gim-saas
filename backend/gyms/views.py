from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)

from .models import Gym
from .serializers import GymSerializer


class GymCreateView(APIView):

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GymSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        gym = serializer.save()

        return Response(
            GymSerializer(gym).data,
            status=status.HTTP_201_CREATED,
        )


class GymListView(APIView):

    def get(self, request):
        gyms = Gym.objects.all()

        serializer = GymSerializer(
            gyms,
            many=True
        )

        return Response(serializer.data)


class GymMeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
        gym = request.user.profile.gym

        serializer = GymSerializer(gym)

        return Response(
            serializer.data
        )