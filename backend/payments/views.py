from django.db import transaction

from core.viewsets import GymModelViewSet

from subscriptions.models import Subscription

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
            has_payments = Payment.objects.filter(
                subscription=sub
            ).exists()

            if not has_payments and sub.paid:
                sub.paid = False
                sub.save(update_fields=["paid"])