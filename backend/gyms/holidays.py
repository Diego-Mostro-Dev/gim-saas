"""Feriados de Argentina para cargar como fechas cerradas.

Se traen en tiempo real desde la API pública api.argentinadatos.com (sin key,
MIT): devuelve los feriados nacionales del año con los traslados de la
Ley 27.399 ya aplicados (ej: Soberanía Nacional 2026 → 23/11) y los puentes
turísticos.

Además se suman fechas fijas no oficiales (Día de Rosario, Nochebuena,
Fin de año) y Jueves Santo (computado según domingo de Pascua del año).
"""

from datetime import date, timedelta

import requests
from django.core.cache import cache

ARGENTINADATOS_API_URL = "https://api.argentinadatos.com/v1/feriados/{year}"

CACHE_KEY = "argentina-holidays:v2:{year}"
CACHE_TIMEOUT = 24 * 60 * 60

HARDCODED_HOLIDAYS = {
    (10, 7): "Día de Rosario",
    (12, 24): "Nochebuena",
    (12, 31): "Fin de año",
}


class HolidaysAPIError(Exception):
    """No se pudieron obtener los feriados desde la API pública."""


def _easter_sunday(year):
    """Algoritmo de Meeus/Jones/Butcher: devuelve el domingo de Pascua."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _jueves_santo(year):
    """Jueves Santo: tres días antes del domingo de Pascua."""
    return _easter_sunday(year) - timedelta(days=3)


def _handle_api_response(resp):
    data = resp.json()
    if not isinstance(data, list):
        raise HolidaysAPIError(
            "Respuesta inesperada de la API de feriados."
        )
    return data


def fetch_argentina_holidays(year):
    """Devuelve [(date, reason)] con los feriados de Argentina del año.

    La respuesta de la API se cachea 24h por año para no martillar el
    servicio de terceros. Si la API no responde, se propaga HolidaysAPIError.
    """
    cache_key = CACHE_KEY.format(year=year)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            ARGENTINADATOS_API_URL.format(year=year),
            timeout=10,
        )
        resp.raise_for_status()
        data = _handle_api_response(resp)
    except HolidaysAPIError:
        raise
    except (requests.RequestException, ValueError) as exc:
        raise HolidaysAPIError(
            "No se pudieron obtener los feriados. Reintentalo en unos minutos."
        ) from exc

    holidays = []
    for item in data:
        fecha = item.get("fecha")
        nombre = (item.get("nombre") or "Feriado").strip()
        if not fecha or not nombre:
            continue
        try:
            holiday_date = date.fromisoformat(fecha)
        except ValueError:
            continue
        holidays.append((holiday_date, nombre))

    for (month, day), reason in HARDCODED_HOLIDAYS.items():
        holidays.append((date(year, month, day), reason))

    js = _jueves_santo(year)
    if js is not None:
        holidays.append((js, "Jueves Santo"))

    holidays.sort(key=lambda x: x[0])
    cache.set(cache_key, holidays, CACHE_TIMEOUT)
    return holidays