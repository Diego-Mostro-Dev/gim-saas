from datetime import timedelta

from django.utils.timezone import now

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import GymModelViewSet

from .models import Subscription
from .serializers import SubscriptionSerializer


class SubscriptionViewSet(GymModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        return super().get_queryset().select_related("member", "plan")

    @action(
        detail=True,
        methods=["post"],
    )
    def renew(self, request, pk=None):
        subscription = self.get_object()

        today = now().date()

        if subscription.end_date < today:
            start_date = today
        else:
            start_date = (
                subscription.end_date +
                timedelta(days=1)
            )

        end_date = (
            start_date +
            timedelta(
                days=subscription.plan.duration_days
            )
        )

        new_subscription = Subscription.objects.create(
            gym=subscription.gym,
            member=subscription.member,
            plan=subscription.plan,
            start_date=start_date,
            end_date=end_date,
            paid=False,
        )

        serializer = self.get_serializer(
            new_subscription
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )