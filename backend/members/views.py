from rest_framework import viewsets

from .models import Member
from .serializers import MemberSerializer
print("MEMBERS VIEW LOADED")

class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

    def get_queryset(self):
        return Member.objects.filter(
            gym=self.request.user.profile.gym
        ).order_by("last_name")

    def perform_create(self, serializer):
        print("=== PERFORM CREATE ===")
        print(self.request.user)
        print(self.request.user.profile.gym)

        serializer.save(
            gym=self.request.user.profile.gym
        )