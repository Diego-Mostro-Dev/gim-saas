from core.viewsets import GymModelViewSet
from .models import MembershipPlan, Service
from .serializers import MembershipPlanSerializer, ServiceSerializer


class ServiceViewSet(GymModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    pagination_class = None
    http_method_names = ["get"]

    def get_queryset(self):
        Service.get_default_activities_service(self.get_gym())
        return super().get_queryset()


class MembershipPlanViewSet(GymModelViewSet):
    queryset = MembershipPlan.objects.filter(is_base=False)
    serializer_class = MembershipPlanSerializer
    pagination_class = None