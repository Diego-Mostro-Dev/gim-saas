from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers

from .models import PasswordResetToken


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
    Confirma el restablecimiento con el token recibido por email.

    Valida que el token exista, no haya sido usado y no esté expirado.
    """

    token = serializers.UUIDField()
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            reset_token = PasswordResetToken.objects.select_related(
                "user"
            ).get(id=attrs["token"])
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError(
                {"token": "El enlace no es válido o ya fue usado."}
            )

        if not reset_token.is_valid:
            raise serializers.ValidationError(
                {"token": "El enlace expiró. Solicitá uno nuevo."}
            )

        validate_password(attrs["new_password"], user=reset_token.user)

        attrs["reset_token"] = reset_token
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