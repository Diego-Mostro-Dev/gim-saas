import hmac
import logging

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def sentry_test_endpoint(request):
    """Smoke test de monitoreo: lanza una excepción a propósito.

    Protegido con la misma API key que /api/system/tasks/. Si Sentry está
    configurado (SENTRY_DSN), el evento aparece en el proyecto; si no, la
    app responde 500 y nada se rompe por la falta de Sentry.
    """
    expected = getattr(settings, "SCHEDULED_TASKS_KEY", None)
    provided = request.headers.get("X-Task-Key", "")

    if not expected or not provided or not hmac.compare_digest(expected, provided):
        return Response(
            {"detail": "Invalid or missing task key"},
            status=status.HTTP_403_FORBIDDEN,
        )

    raise RuntimeError(
        "Sentry smoke test: if this appears in Sentry, monitoring is live."
    )