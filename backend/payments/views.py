from django.db import transaction

from core.viewsets import GymModelViewSet

from subscriptions.models import Subscription
from subscriptions.services import sync_subscription_paid

from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(GymModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def perform_destroy(self, instance):
        subscription = instance.subscription

        with transaction.atomic():
            instance.delete()

            if not subscription:
                return

            sub = (
                Subscription.objects
                .select_for_update()
                .get(pk=subscription.pk)
            )
            sync_subscription_paid(sub)
