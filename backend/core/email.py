"""
Servicio de envío de emails transaccionales usando Resend.

Se usa únicamente para emails de la plataforma (password reset, etc.),
NO para comunicaciones de marketing.
"""

import logging

from django.conf import settings

_logger = logging.getLogger(__name__)


def _get_client():
    """Retorna un cliente Resend configurado con la API key."""
    import resend

    resend.api_key = settings.RESEND_API_KEY
    return resend


def send_password_reset_email(
    to_email: str,
    reset_url: str,
    code: str,
    gym_name: str | None = None,
) -> bool:
    """
    Envía un email de restablecimiento de contraseña.

    Parámetros:
        to_email: Dirección del destinatario.
        reset_url: URL limpia de la app (sin ningún secreto en la query).
        code: Código de 6 dígitos para completar el restablecimiento.
        gym_name: Nombre del gimnasio (opcional, para personalizar el asunto).

    Retorna True si el email fue enviado exitosamente, False en caso contrario.
    Si RESEND_API_KEY no está configurado, loguea y retorna False sin lanzar error.
    """
    if not settings.RESEND_API_KEY:
        _logger.warning(
            "RESEND_API_KEY no está configurado. "
            "No se envía email de reseteo a %s.",
            to_email,
        )
        return False

    from .email_templates import build_password_reset_email

    subject, html_body = build_password_reset_email(
        reset_url=reset_url,
        code=code,
        gym_name=gym_name,
    )

    try:
        client = _get_client()
        client.Emails.send({
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        })
        _logger.info("Email de reseteo enviado a %s", to_email)
        return True
    except Exception:
        _logger.exception("Error al enviar email de reseteo a %s", to_email)
        return False
