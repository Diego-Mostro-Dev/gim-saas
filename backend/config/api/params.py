from datetime import date, time

from rest_framework import status
from rest_framework.response import Response


def error_response(detail):
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)


def parse_date(raw_value):
    """AAAA-MM-DD → date. Devuelve (date|None, error|None)."""
    if not raw_value:
        return None, None
    try:
        return date.fromisoformat(raw_value), None
    except ValueError:
        return None, error_response("Formato de fecha inválido. Usá AAAA-MM-DD.")


def parse_time(raw_value):
    """HH:MM[:SS] → time. Devuelve (time|None, error|None)."""
    if not raw_value:
        return None, None
    try:
        return time.fromisoformat(raw_value), None
    except ValueError:
        return None, error_response("Formato de hora inválido. Usá HH:MM.")


def parse_int(raw_value, label="id"):
    """cadena → int. Devuelve (int|None, error|None)."""
    if not raw_value:
        return None, None
    try:
        return int(raw_value), None
    except (TypeError, ValueError):
        return None, error_response(f"El valor de '{label}' no es válido.")


def validate_choice(raw_value, choices, label="campo"):
    """Permite solo los valores de `choices` (lista de pares o conjunto)."""
    if not raw_value:
        return None, None
    allowed = {
        choice[0] if isinstance(choice, (tuple, list)) else choice
        for choice in choices
    }
    if raw_value not in allowed:
        return None, error_response(f"Valor inválido para '{label}'.")
    return raw_value, None


def as_error_detail(error):
    """Extrae el detail de un error_response para usarlo al lanzar ParseError.

    En contextos donde get_queryset no puede devolver una Response (un queryset
    roto rompe la paginación), el Caller lanza ParseError con el mismo mensaje.
    """
    if error is None:
        return None
    data = getattr(error, "data", None)
    if isinstance(data, dict) and "detail" in data:
        return data["detail"]
    return "Valor inválido."