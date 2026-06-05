from core.viewsets import GymModelViewSet

from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(GymModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def perform_destroy(self, instance):
        subscription = instance.subscription

        instance.delete()

        has_payments = subscription.payments.exists()

        if not has_payments and subscription.paid:
            subscription.paid = False
            subscription.save(update_fields=["paid"])