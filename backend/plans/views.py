from core.viewsets import GymModelViewSet
from .models import MembershipPlan
from .serializers import MembershipPlanSerializer


class MembershipPlanViewSet(GymModelViewSet):
    queryset = MembershipPlan.objects.all()
    serializer_class = MembershipPlanSerializer