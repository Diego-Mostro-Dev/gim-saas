from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import GymModelViewSet

from payments.models import Payment

from .models import Member
from .serializers import MemberSerializer


class MemberViewSet(GymModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

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
                member_name__iexact=(
                    f"{member.first_name} "
                    f"{member.last_name}"
                ),
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