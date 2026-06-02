from django.core.exceptions import PermissionDenied


class GymQuerysetMixin:
    """
    Filtra automáticamente todo por el gym del usuario autenticado
    """

    def get_gym(self):
        user = self.request.user

        if not hasattr(user, "profile") or not user.profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return user.profile.gym

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(gym=self.get_gym())

    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())