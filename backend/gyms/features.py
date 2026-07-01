from django.core.exceptions import PermissionDenied

FEATURE_ACTIVITIES = "activities"


def require_activities(gym):
    if not gym.features.get(FEATURE_ACTIVITIES, False):
        raise PermissionDenied("Actividades no está habilitado para este gimnasio.")
