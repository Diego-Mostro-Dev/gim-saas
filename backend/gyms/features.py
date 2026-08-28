from django.core.exceptions import PermissionDenied

FEATURE_ACTIVITIES = "activities"


def activities_enabled(gym):
    """Return True when the activities add-on is enabled for the gym."""
    return bool(gym.features.get(FEATURE_ACTIVITIES, False))


def require_activities(gym):
    if not activities_enabled(gym):
        raise PermissionDenied("Actividades no está habilitado para este gimnasio.")
