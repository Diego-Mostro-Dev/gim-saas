"""
Autenticación por DRF Token con expiración activa.

El modelo `rest_framework.authtoken.models.Token` no expira por defecto, lo
que convierte el robo de un token en un acceso indefinido. Acá el token se
considera vencido después de `settings.TOKEN_EXPIRY_HOURS` horas: los
endpoints lo rechazan con 401 y el cliente puede rotarlo (emitir uno nuevo)
contra `/api/auth/refresh/`.

El token vencido NO se elimina en el chequeo de auth: primero el cliente
tiene la chance de refrescarlo. La limpieza real ocurre en el próximo login.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed


def token_lifetime():
    """Vida útil de un token de sesión."""
    hours = int(getattr(settings, "TOKEN_EXPIRY_HOURS", 168))
    return timedelta(hours=hours)


def token_expires_in_seconds():
    """Segundos restantes de vida de un token recién emitido."""
    return int(token_lifetime().total_seconds())


def token_expired(token):
    return token.created < timezone.now() - token_lifetime()


def get_or_create_session_token(user):
    """
    Token único por usuario (misma semántica que get_or_create) pero con
    rotación: si el token existente ya venció, se elimina y se emite uno
    nuevo. Las llamadas concurrentes no agregan tokens.
    """
    token, created = Token.objects.get_or_create(user=user)
    if not created and token_expired(token):
        token.delete()
        token = Token.objects.create(user=user)
    return token


class ExpiringTokenAuthentication(TokenAuthentication):
    """
    TokenAuthentication que rechaza tokens vencidos con AuthenticationFailed
    (401), para que el frontend pueda detectar la expiración y refrescar.
    """

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if token_expired(token):
            raise AuthenticationFailed("Token expirado.")
        return user, token


class RefreshTokenAuthentication(TokenAuthentication):
    """
    Igual que TokenAuthentication pero admite tokens vencidos, para que
    `/api/auth/refresh/` pueda rotar un token antes de descartarlo. Sigue
    validando que el token exista y que el usuario esté activo.
    """

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        return user, token