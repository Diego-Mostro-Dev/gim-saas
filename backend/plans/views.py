from core.viewsets import GymModelViewSet
from .models import MembershipPlan, Service
from .serializers import MembershipPlanSerializer, ServiceSerializer


class ServiceViewSet(GymModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    pagination_class = None
    http_method_names = ["get"]


class MembershipPlanViewSet(GymModelViewSet):
    queryset = MembershipPlan.objects.filter(is_base=False)
    serializer_class = MembershipPlanSerializer
    pagination_class = None