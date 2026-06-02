from core.viewsets import GymModelViewSet
from .models import Payment
from .serializers import PaymentSerializer


class PaymentViewSet(GymModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer