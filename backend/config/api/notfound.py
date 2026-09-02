from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def handler404(request, exception=None):
    return Response(
        {"detail": "Not found."},
        status=status.HTTP_404_NOT_FOUND,
    )
