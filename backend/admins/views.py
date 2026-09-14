from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from core.permissions import IsSuperUser
from gyms.features import feature_catalog
from gyms.models import Gym
from gyms.serializers import GymSerializer

from .serializers import AdminGymCreateSerializer, AdminGymUpdateSerializer
from .services import create_gym_with_config


class AdminGymListCreateView(APIView):
    """Listar y crear gimnasios. Solo accesible para el superusuario central."""

    permission_classes = [IsSuperUser]

    def get(self, request):
        gyms = Gym.objects.all().order_by("-created_at", "name")
        return Response(GymSerializer(gyms, many=True).data)

    def post(self, request):
        serializer = AdminGymCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            gym, owner_created = create_gym_with_config(serializer.validated_data)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = GymSerializer(gym).data
        data["owner_created"] = owner_created

        return Response(
            data,
            status=status.HTTP_201_CREATED,
        )


class AdminGymDetailView(APIView):
    """Detalle y actualización de un gimnasio. Solo superusuario central."""

    permission_classes = [IsSuperUser]

    def get(self, request, pk):
        gym = get_object_or_404(Gym, pk=pk)
        return Response(GymSerializer(gym).data)

    def patch(self, request, pk):
        gym = get_object_or_404(Gym, pk=pk)
        serializer = AdminGymUpdateSerializer(gym, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        features = serializer.validated_data.pop("features", None)
        if features is not None:
            gym.features = {**gym.features, **features}

        serializer.save()

        return Response(GymSerializer(gym).data)


class AdminFeaturesView(APIView):
    """Catálogo de features configurables al crear un gimnasio (data-driven)."""

    permission_classes = [IsSuperUser]

    def get(self, request):
        return Response({"features": feature_catalog()})