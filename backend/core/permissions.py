"""Permisos por rol sobre el gimnasio del usuario autenticado."""

from django.core.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from gyms.labels import msg
from profiles.models import UserProfile


class IsSuperUser(BasePermission):
    """Only Django superusers (the central admin) can access the resource."""

    message = "Esta acción está reservada para el administrador central."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


def is_owner(request) -> bool:
    """True si el usuario autenticado es dueño del gimnasio que usa."""
    profile = getattr(request.user, "profile", None)
    return bool(profile and profile.role == UserProfile.ROLE_OWNER)


def require_owner(request, label="errors.owner_only"):
    """Lanza PermissionDenied si el usuario no es dueño del gimnasio."""
    profile = getattr(request.user, "profile", None)
    if not is_owner(request):
        gym = profile.gym if profile else None
        raise PermissionDenied(msg(gym, label))


ROUTINE_MANAGER_ROLES = {
    UserProfile.ROLE_OWNER,
    UserProfile.ROLE_STAFF,
    UserProfile.ROLE_PROFESSOR,
}


def is_routine_manager(request) -> bool:
    """True si el usuario puede administrar el catálogo y asignar rutinas.

    Dueño, staff y profesor arman rutinas; el entrenador/a personal (trainer)
    queda afuera porque su pantalla es su propia agenda (RUT-01).
    """
    profile = getattr(request.user, "profile", None)
    return bool(profile and profile.role in ROUTINE_MANAGER_ROLES)


def require_routine_manager(request, label="errors.routine_role_required"):
    """Lanza PermissionDenied si el usuario no puede gestionar rutinas."""
    profile = getattr(request.user, "profile", None)
    if not is_routine_manager(request):
        gym = profile.gym if profile else None
        raise PermissionDenied(msg(gym, label))
