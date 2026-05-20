from rest_framework import viewsets

from .models import Member
from .serializers import MemberSerializer


class MemberViewSet(viewsets.ModelViewSet):

    queryset = Member.objects.all().order_by('last_name')
    serializer_class = MemberSerializer