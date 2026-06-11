from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.exceptions import PermissionDenied

from .serializers import GymSerializer


class GymMeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied(
                "Usuario sin gimnasio asignado"
            )

        return profile.gym

    def get(self, request):
        gym = self.get_gym(request)

        serializer = GymSerializer(gym)

        return Response(
            serializer.data
        )

    def patch(self, request):
        gym = self.get_gym(request)

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