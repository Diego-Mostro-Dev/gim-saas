from core.viewsets import GymModelViewSet
from .models import Subscription
from .serializers import SubscriptionSerializer


class SubscriptionViewSet(GymModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer