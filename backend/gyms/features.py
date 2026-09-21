from django.core.exceptions import PermissionDenied

from .labels import msg


class FeatureDisabled(PermissionDenied):
    """Raised when a gym has not enabled a required feature.

    DRF renders this as ``{"detail": "...", "code": "FEATURE_DISABLED",
    "feature": "<key>"}`` so the frontend can detect which feature is
    disabled and act accordingly (e.g. refresh features, redirect).
    """

    def __init__(self, message, feature):
        self.feature = feature
        super().__init__(message)
        self.status_code = 403


FEATURE_ACTIVITIES = "activities"
FEATURE_PERSONAL_TRAINING = "personal_training"


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
    {
        "key": FEATURE_PERSONAL_TRAINING,
        "label": "Entrenamiento personal",
        "description": (
            "Entrenamiento personal con trainers, horarios fijos "
            "y pago por sesión o mensual."
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
        raise FeatureDisabled(
            msg(gym, "features.activities_disabled"),
            FEATURE_ACTIVITIES,
        )


def personal_training_enabled(gym):
    """Return True when the personal-training add-on is enabled for the gym."""
    return bool(gym.features.get(FEATURE_PERSONAL_TRAINING, False))


def require_personal_training(gym):
    if not personal_training_enabled(gym):
        raise FeatureDisabled(
            msg(gym, "features.pt_disabled"),
            FEATURE_PERSONAL_TRAINING,
        )
