from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from django.shortcuts import get_object_or_404
from django.db.models import Prefetch

from core.viewsets import GymModelViewSet
from payments.models import Payment

from attendance.models import AttendanceSchedule
from config.api.throttles import (
    PublicMemberRateThrottle,
)

from .models import Member
from .serializers import (
    MemberSerializer,
    MemberPhotoSerializer,
)


class MemberViewSet(GymModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

    def get_queryset(self):
        return super().get_queryset().prefetch_related(
            Prefetch(
                "schedules",
                queryset=AttendanceSchedule.objects.filter(
                    active=True
                ).select_related("slot"),
            )
        )

    def update(self, request, *args, **kwargs):

        return super().update(
            request,
            *args,
            **kwargs,
        )

    @action(
        detail=True,
        methods=["get"],
    )
    def payments(self, request, pk=None):
        member = self.get_object()

        payments = (
            Payment.objects.filter(
                gym=member.gym,
                member=member,
            )
            .order_by("-paid_at")
            .values(
                "id",
                "member_name",
                "plan_name",
                "amount",
                "payment_method",
                "paid_at",
                "subscription_end_date",
            )
        )

        return Response(payments)


class PublicMemberPhotoView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def patch(self, request, token):

        member = get_object_or_404(
        Member,
        access_token=token,
    )

        serializer = MemberPhotoSerializer(
            member,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(serializer.data)