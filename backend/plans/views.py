from rest_framework import viewsets

from .models import MembershipPlan
from .serializers import MembershipPlanSerializer


class MembershipPlanViewSet(viewsets.ModelViewSet):

    queryset = MembershipPlan.objects.all()
    serializer_class = MembershipPlanSerializer