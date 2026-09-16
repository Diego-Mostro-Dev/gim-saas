from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """DRF exception handler that enriches FeatureDisabled responses.

    Adds ``code`` and ``feature`` keys to the response body when the
    exception is a ``gyms.features.FeatureDisabled`` instance, so the
    frontend can detect which feature is disabled.
    """
    response = exception_handler(exc, context)

    if response is not None and hasattr(exc, "feature"):
        response.data["code"] = "FEATURE_DISABLED"
        response.data["feature"] = exc.feature

    return response
