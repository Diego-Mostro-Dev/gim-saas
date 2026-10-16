"""Detección de mezclas de base entre entornos.

En Neon los endpoint IDs son únicos por branch, así que el hostname es lo
único que distingue la branch de staging de la de producción. El nombre de la
base no sirve para eso: todas las branches se llaman `neondb` por default, y
comparar contra él hacía que el check diera el mismo resultado en un setup
correcto y en uno donde staging y producción escriben en la misma base.

Vive acá y no en `settings.py` porque `django.conf.settings` sólo expone los
valores en MAYÚSCULAS; las funciones de módulo no son accesibles desde el
objeto `Settings`.
"""

import os


def neon_endpoint_role(host):
    """Qué entorno representa este host de Neon, o None si no se reconoce.

    El fragmento va embebido en el hostname, que tiene la forma
    ep-<name>-pooler.c-<id>.<region>.aws.neon.tech.

    Args:
        host: el HOST de la conexión, o "" si no hay.

    Returns:
        "staging", "production", o None si el host no corresponde a ninguno de
        los endpoints conocidos.
    """
    if not host:
        return None

    staging = os.getenv("NEON_ENDPOINT_STAGING", "green-sea-aqmezbmg").strip()
    production = os.getenv("NEON_ENDPOINT_PRODUCTION", "round-sunset-aq8oo16v").strip()

    for role, fragment in (("staging", staging), ("production", production)):
        if fragment and fragment in host:
            return role
    return None