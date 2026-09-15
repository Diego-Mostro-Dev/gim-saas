import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class PasswordResetToken(models.Model):
    """
    Token de uso único para restablecimiento de contraseña.

    Se genera cuando el usuario solicita un reseteo y se invalida una vez
    utilizado. El token es un UUID4 que se incluye en la URL del email.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    expires_at = models.DateTimeField()

    used = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Token de restablecimiento"
        verbose_name_plural = "Tokens de restablecimiento"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reset token for {self.user.username}"

    @classmethod
    def create_for_user(cls, user, ttl_seconds: int | None = None):
        """
        Crea un token de reseteo para el usuario.

        Invalida todos los tokens anteriores del mismo usuario antes de crear
        uno nuevo (solo puede haber un token activo por usuario).
        """
        from django.conf import settings

        if ttl_seconds is None:
            ttl_seconds = getattr(
                settings, "PASSWORD_RESET_TOKEN_TTL_SECONDS", 3600
            )

        # Invalidar tokens anteriores del usuario
        cls.objects.filter(user=user, used=False).update(used=True)

        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timezone.timedelta(seconds=ttl_seconds),
        )

    @property
    def is_valid(self):
        """True si el token no fue usado y no expiró."""
        return not self.used and timezone.now() < self.expires_at
