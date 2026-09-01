import hmac

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response

from subscriptions.services import run_scheduled_tasks


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def scheduled_tasks_endpoint(request):
    """Dispara las tareas de mantenimiento (renovaciones + cambios de plan).

    Protegido por una API key compartida (header ``X-Task-Key``) para que un
    cron externo (GitHub Actions) o cualquier disparador pueda ejecutarlo sin
    un token de usuario. Responde 403 si la key falta o no coincide.
    """

    expected = getattr(settings, "SCHEDULED_TASKS_KEY", None)
    provided = request.headers.get("X-Task-Key", "")

    if not expected or not provided or not hmac.compare_digest(expected, provided):
        return Response(
            {"detail": "Invalid or missing task key"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        force = request.query_params.get("force", "false").lower() == "true"
    except Exception:
        force = False

    result = run_scheduled_tasks(force=force)

    http_status = (
        status.HTTP_200_OK if result.get("status") != "error" else status.HTTP_500_INTERNAL_SERVER_ERROR
    )

    return Response(result, status=http_status)