from django.shortcuts import get_object_or_404

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.mixins import GymQuerysetMixin
from core.permissions import require_owner
from gyms.features import require_community

from .models import CommunityBusiness
from .serializers import CommunityBusinessSerializer


class CommunityGuardMixin:
    """Rechaza la request si el gimnasio no tiene habilitada la Comunidad."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_community(self.get_gym())


class CommunityBusinessView(CommunityGuardMixin, GymQuerysetMixin, APIView):
    """Lista los locales adheridos del gimnasio. Crear: solo el dueño."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        businesses = CommunityBusiness.objects.filter(
            gym=self.get_gym()
        ).order_by("name")
        return Response(CommunityBusinessSerializer(businesses, many=True).data)

    def post(self, request):
        require_owner(request, "errors.owner_only_community")
        gym = self.get_gym()
        serializer = CommunityBusinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(gym=gym)
        return Response(serializer.data, status=201)


class CommunityBusinessDetailView(CommunityGuardMixin, GymQuerysetMixin, APIView):
    """Edita o elimina un local adherido. Solo el dueño."""

    permission_classes = [IsAuthenticated]

    def get_object(self, request, business_id):
        return get_object_or_404(
            CommunityBusiness,
            pk=business_id,
            gym=self.get_gym(),
        )

    def patch(self, request, business_id):
        require_owner(request, "errors.owner_only_community")
        business = self.get_object(request, business_id)
        serializer = CommunityBusinessSerializer(
            business,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, business_id):
        require_owner(request, "errors.owner_only_community")
        business = self.get_object(request, business_id)
        business.delete()
        return Response(status=204)