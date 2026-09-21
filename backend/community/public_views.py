from django.shortcuts import get_object_or_404

from rest_framework.response import Response
from rest_framework.views import APIView

from config.api.throttles import PublicMemberRateThrottle
from gyms.features import require_community
from members.models import Member
from subscriptions.domain import SubscriptionDomain

from .models import CommunityBusiness
from .serializers import CommunityBusinessSerializer


class PublicMemberCommunityView(APIView):
    """Tarjeta de comunidad de un socio (pública, por token).

    Muestra el nombre del socio, el gimnasio y los locales adheridos con
    su descuento. No expone ningún dato del portal.
    """

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_community(gym)

        businesses = CommunityBusiness.objects.filter(
            gym=gym
        ).order_by("name")

        return Response({
            "member": {
                "first_name": member.first_name,
                "last_name": member.last_name,
            },
            "gym_name": gym.name,
            "businesses": CommunityBusinessSerializer(
                businesses, many=True
            ).data,
        })