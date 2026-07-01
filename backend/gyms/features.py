from django.core.exceptions import PermissionDenied

FEATURE_EXTRAS = "extras"


def require_extras(gym):
    if not gym.features.get(FEATURE_EXTRAS, False):
        raise PermissionDenied("Extras no está habilitado para este gimnasio.")
