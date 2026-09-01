from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response
from django.db import connection


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
def health_check(request):
    # verificar DB básica
    db_ok = True
    try:
        connection.ensure_connection()
    except Exception:
        db_ok = False

    return Response({
        "status": "ok" if db_ok else "error",
        "database": "connected" if db_ok else "disconnected"
    })