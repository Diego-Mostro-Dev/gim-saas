from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from core.viewsets import GymModelViewSet

from subscriptions.models import Subscription
from subscriptions.services import calculate_subscription_total

from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(GymModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def perform_destroy(self, instance):
        subscription = instance.subscription

        instance.delete()

        if not subscription:
            return

        with transaction.atomic():
            sub = (
                Subscription.objects
                .select_for_update()
                .get(pk=subscription.pk)
            )
            paid_total = Payment.objects.filter(
                subscription=sub
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

            if sub.paid and paid_total < calculate_subscription_total(sub):
                sub.paid = False
                sub.save(update_fields=["paid"])