from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response

from gyms.features import require_outings
from members.models import Member
from subscriptions.domain import SubscriptionDomain
from config.api.throttles import PublicMemberRateThrottle

from .models import OutingEnrollment
from .serializers import PublicOutingEnrollmentSerializer


class PublicMemberOutingsView(APIView):
    """Portal del socio: sus salidas grupales activas."""

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_outings(gym)

        enrollments = OutingEnrollment.objects.filter(
            member=member,
            active=True,
        ).select_related(
            "schedule__outing",
            "schedule__outing__trainer__profile",
        ).order_by("schedule__day", "schedule__start_time")

        return Response({
            "outings": PublicOutingEnrollmentSerializer(
                enrollments, many=True
            ).data,
            "gym_name": gym.name,
        })