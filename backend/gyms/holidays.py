"""Feriados de Argentina para cargar como fechas cerradas.

Se traen en tiempo real desde la API pública api.argentinadatos.com (sin key,
MIT): devuelve los feriados nacionales del año con los traslados de la
Ley 27.399 ya aplicados (ej: Soberanía Nacional 2026 → 23/11) y los puentes
turísticos.

La única fecha hardcodeada es el Día de Rosario (07/10), feriado local que la
API de alcance nacional no incluye, decidido junto al cliente. El resto lo
puede agregar el owner manualmente como siempre.
"""

from datetime import date

import requests
from django.core.cache import cache

ARGENTINADATOS_API_URL = "https://api.argentinadatos.com/v1/feriados/{year}"

CACHE_KEY = "argentina-holidays:{year}"
CACHE_TIMEOUT = 24 * 60 * 60

HARDCODED_HOLIDAYS = {
    (10, 7): "Día de Rosario",
}


class HolidaysAPIError(Exception):
    """No se pudieron obtener los feriados desde la API pública."""


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

    holidays.sort(key=lambda x: x[0])
    cache.set(cache_key, holidays, CACHE_TIMEOUT)
    return holidays