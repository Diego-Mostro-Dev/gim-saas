import logging
import re


class AccessTokenScrubFilter(logging.Filter):
    """Redacta los access_token del portal del socio en los mensajes de log.

    El token del socio viaja como segmento de URL (p.ej. /routine/<token>/),
    así que un request fallido, un 404 o un Referer terminan volcándolo en
    django.request/gunicorn. Este filtro reemplaza ese segmento por
    "<redacted>" antes de emitirse.

    Solo alcanza segmentos de 32-64 chars base64url precedidos por "/" o "="
    (los access_token se generan con ``secrets.token_urlsafe(32)`` → 43 chars).
    Los IDs/PKs de esta app son ints pequeños, por lo que no hay colisión
    con rutas legítimas.
    """

    _TOKEN_SEGMENT = re.compile(
        r"(?<=[/=])[A-Za-z0-9_-]{32,64}(?=/|\?|$|[\s'\"])"
    )

    def filter(self, record):
        try:
            message = record.getMessage()
        except (TypeError, ValueError):
            return True

        if not message:
            return True

        scrubbed = self._TOKEN_SEGMENT.sub("<redacted>", message)
        if scrubbed is not message:
            record.msg = scrubbed
            record.args = ()

        return True