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

    def perform_create(self, serializer):
        gym = self.get_gym()
        # Plans created from the UI don't send a service; default to the
        # gym's "gym" service, the same one the service-field backfill and
        # ensure_base_plan_for_gym use.
        service = serializer.validated_data.get("service") or Service.get_default_for_gym(gym)
        serializer.save(gym=gym, service=service)
