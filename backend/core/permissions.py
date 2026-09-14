from rest_framework.permissions import BasePermission


class IsSuperUser(BasePermission):
    """Only Django superusers (the central admin) can access the resource."""

    message = "Esta acción está reservada para el administrador central."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)