from rest_framework import viewsets

from django_filters.rest_framework import DjangoFilterBackend

from .models import Subscription
from .serializers import SubscriptionSerializer


class SubscriptionViewSet(viewsets.ModelViewSet):

    queryset = Subscription.objects.all()

    serializer_class = SubscriptionSerializer

    filter_backends = [DjangoFilterBackend]

    filterset_fields = ['paid']
    