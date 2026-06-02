from core.viewsets import GymModelViewSet
from .models import Member
from .serializers import MemberSerializer


class MemberViewSet(GymModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer