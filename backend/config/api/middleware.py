import logging

from django.conf import settings

from subscriptions.services import maybe_run_scheduled_tasks

logger = logging.getLogger(__name__)


class ScheduledTaskTriggerMiddleware:
    """Dispara las tareas programadas cuando la app recibe tráfico.

    Es el mecanismo perezoso (opción A): si pasó el intervalo de
    SCHEDULED_TASKS_INTERVAL_SECONDS desde la última ejecución y nadie más
    tiene el advisory lock, ejecuta las renovaciones/cambios de plan en la
    cola de este request. Los errores se loguean y nunca rompen el request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if getattr(settings, "SCHEDULED_TASKS_ENABLED", True):
            if request.path.startswith("/api/system/"):
                return response
            if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
                return response
            try:
                maybe_run_scheduled_tasks()
            except Exception:
                logger.exception("Scheduled task trigger failed on %s", request.path)

        return response