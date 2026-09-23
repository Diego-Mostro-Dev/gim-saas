from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from .models import PasswordResetToken, verify_reset_code


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            username=attrs["username"],
            password=attrs["password"],
        )

        if not user:
            raise serializers.ValidationError(
                "Invalid username or password."
            )

        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(
        write_only=True
    )

    new_password = serializers.CharField(
        write_only=True
    )

    def validate_old_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError(
                "Current password is incorrect."
            )

        return value

    def validate_new_password(self, value):
        validate_password(value)

        return value

    def save(self):
        user = self.context["request"].user

        user.set_password(
            self.validated_data["new_password"]
        )

        user.save()

        profile = user.profile

        profile.must_change_password = False
        profile.save()

        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Solicitud de restablecimiento de contraseña por email.

    La respuesta es siempre genérica (aunque el email no exista) para no
    revelar qué cuentas están registradas.
    """

    email = serializers.EmailField()

    def get_user(self):
        """Retorna el usuario con ese email, o None si no existe."""
        email = self.validated_data["email"]
        try:
            return User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return None


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Confirma el restablecimiento con el email + código recibido por email.

    El código (6 dígitos, de uso único) llega solo por email y nunca viaja
    en una URL, así que no queda en el historial ni en los logs del hosting.
    Se valida en tiempo constante contra el token pendiente del usuario.
    """

    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(write_only=True)

    def validate_code(self, value):
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError("Código inválido.")
        return value

    def validate(self, attrs):
        invalid = serializers.ValidationError(
            {"code": "El código no es válido o ya fue usado."}
        )

        try:
            user = User.objects.get(email__iexact=attrs["email"])
        except User.DoesNotExist:
            raise invalid

        matched = None
        for reset_token in PasswordResetToken.objects.filter(
            user=user, used=False
        ).order_by("-created_at"):
            if verify_reset_code(reset_token, attrs["code"]):
                matched = reset_token
                break

        if matched is None or not matched.is_valid:
            # Mismo mensaje para código inválido, usado o expirado: el cliente
            # no debe poder distinguir estados (evita enumeración de cuentas).
            raise invalid

        validate_password(attrs["new_password"], user=user)

        attrs["reset_token"] = matched
        return attrs

    def save(self):
        """
        Aplica la nueva contraseña e invalida el token.

        Retorna el usuario actualizado.
        """
        reset_token = self.validated_data["reset_token"]
        user = reset_token.user

        user.set_password(self.validated_data["new_password"])
        user.save()

        reset_token.used = True
        reset_token.save(update_fields=["used"])

        # Invalidar tokens de sesión para que las sesiones viejas caduquen
        # después del reseteo (fuerza re-login con la nueva contraseña).
        from rest_framework.authtoken.models import Token

        Token.objects.filter(user=user).delete()

        return user


class AdminPasswordResetSerializer(serializers.Serializer):
    """
    Reseteo de contraseña iniciado por un admin (owner o superadmin).

    El admin define una contraseña temporal y el usuario debe cambiarla en su
    próximo login (must_change_password=True).
    """

    user_id = serializers.IntegerField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value