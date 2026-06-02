from rest_framework import viewsets
from .mixins import GymQuerysetMixin


class GymModelViewSet(GymQuerysetMixin, viewsets.ModelViewSet):
    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())