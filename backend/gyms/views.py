from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated,
)

from .serializers import GymSerializer


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

    def patch(self, request):
        gym = request.user.profile.gym

        serializer = GymSerializer(
            gym,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data
        )