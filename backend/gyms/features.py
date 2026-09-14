from django.core.exceptions import PermissionDenied

FEATURE_ACTIVITIES = "activities"


# Catálogo de features conocidas. El panel admin lo consume para renderizar
# el wizard de creación de forma data-driven: agregar una feature acá la
# hace configurables sin tocar el frontend.
FEATURE_CATALOG = [
    {
        "key": FEATURE_ACTIVITIES,
        "label": "Actividades",
        "description": (
            "Actividades con horarios, profesores y pago por sesión o mensual."
        ),
        "default": False,
    },
]


def feature_catalog():
    return FEATURE_CATALOG


def activities_enabled(gym):
    """Return True when the activities add-on is enabled for the gym."""
    return bool(gym.features.get(FEATURE_ACTIVITIES, False))


def require_activities(gym):
    if not activities_enabled(gym):
        raise PermissionDenied("Actividades no está habilitado para este gimnasio.")
