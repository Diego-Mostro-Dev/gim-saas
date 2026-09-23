from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError, PermissionDenied
from django.conf import settings

from gyms.models import Gym
from profiles.models import UserProfile
from .models import PasswordResetToken
from .serializers import (
    LoginSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    AdminPasswordResetSerializer,
)
from config.api.authentication import (
    get_or_create_session_token,
    token_expires_in_seconds,
    RefreshTokenAuthentication,
)
from config.api.throttles import (
    LoginRateThrottle,
    OnboardingCreateRateThrottle,
    OnboardingValidateRateThrottle,
    PasswordResetRequestRateThrottle,
    PasswordResetConfirmRateThrottle,
)


# -------------------------
# LOGIN
# -------------------------
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        # Único token por usuario, igual que antes (el gym se resuelve desde
        # request.user, no desde el token), pero con rotación al vencer: si el
        # token existente ya expiró se emite uno nuevo. `expires_in` permite al
        # frontend saber cuándo va a necesitar refrescar.
        token = get_or_create_session_token(user)

        return Response(
            {
                "token": token.key,
                "username": user.username,
                "expires_in": token_expires_in_seconds(),
                "must_change_password": (
                    user.profile.must_change_password
                ),
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# LOGOUT
# -------------------------
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.auth.delete()

        return Response(
            {"success": True},
            status=status.HTTP_200_OK,
        )


# -------------------------
# ME (USER INFO)
# -------------------------
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)

        return Response(
            {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "gym": (
                    profile.gym.name
                    if profile and profile.gym
                    else None
                ),
                "gym_id": (
                    profile.gym.id
                    if profile and profile.gym
                    else None
                ),
                "must_change_password": (
                    profile.must_change_password
                    if profile
                    else False
                ),
                "role": (
                    profile.role
                    if profile
                    else UserProfile.ROLE_STAFF
                ),
                "is_superuser": request.user.is_superuser,
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# CHANGE PASSWORD
# -------------------------
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        Token.objects.filter(user=request.user).delete()
        new_token = Token.objects.create(user=request.user)

        return Response(
            {
                "success": True,
                "token": new_token.key,
                "expires_in": token_expires_in_seconds(),
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# REFRESH TOKEN
# -------------------------
class RefreshTokenView(APIView):
    """
    Rota el token de sesión por uno nuevo con expiración renovada.

    Usa RefreshTokenAuthentication: admite un token vencido (pero existente)
    para renovarlo sin obligar al usuario a volver a entrar. Al rotar se
    invalida la clave anterior, lo que mantiene el modelo de un token por
    usuario.
    """

    authentication_classes = [RefreshTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_token = request.auth
        user = request.user

        old_token.delete()
        new_token = Token.objects.create(user=user)

        return Response(
            {
                "token": new_token.key,
                "username": user.username,
                "expires_in": token_expires_in_seconds(),
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# ONBOARDING: VALIDAR GYM LINK
# -------------------------
class GymOnboardingView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OnboardingValidateRateThrottle]

    def get(self, request, code):
        try:
            gym = Gym.objects.get(onboarding_code=code)
        except Gym.DoesNotExist:
            return Response(
                {"valid": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        already_configured = UserProfile.objects.filter(
            gym=gym
        ).exists()

        return Response(
            {
                "valid": True,
                "already_configured": already_configured,
                "gym_name": gym.name,
                "gym_id": gym.id,
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# ONBOARDING: CREAR OWNER
# -------------------------
class CreateGymOwnerView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OnboardingCreateRateThrottle]

    def post(self, request):
        code = request.data.get("gym_code")
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")

        if not all([code, username, password]):
            return Response(
                {"error": "Missing required fields"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            gym = Gym.objects.get(onboarding_code=code)
        except (Gym.DoesNotExist, ValidationError):
            return Response(
                {"error": "Invalid gym code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # A gym can only have one owner created through public onboarding.
        # Rejecting repeats here prevents anyone who gets hold of the
        # onboarding_code (it circulates in QR/URLs) from creating an
        # additional owner and taking over an already-configured gym. The code
        # itself stays valid forever because it is also used for public member
        # registration. Additional staff/owners are created from inside the
        # app, never through this public endpoint.
        if UserProfile.objects.filter(gym=gym).exists():
            return Response(
                {
                    "error": (
                        "Este gimnasio ya fue configurado. "
                        "El enlace solo sirve para la primera cuenta."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        # 1. crear user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )

        # 2. link con profile (creado por signal)
        profile = user.profile
        profile.gym = gym
        profile.role = UserProfile.ROLE_OWNER
        profile.save()

        # 3. token automático
        token = get_or_create_session_token(user)

        return Response(
            {
                "ok": True,
                "token": token.key,
                "user": user.username,
                "gym": gym.name,
                "expires_in": token_expires_in_seconds(),
                "must_change_password": (
                    profile.must_change_password
                ),
            },
            status=status.HTTP_201_CREATED,
        )


# -------------------------
# PASSWORD RESET (self-service)
# -------------------------
class PasswordResetRequestView(APIView):
    """
    Solicitud de restablecimiento por email.

    La respuesta es SIEMPRE la misma (exista o no el email) para evitar
    enumeración de cuentas. El email se envía solo si el usuario existe y
    tiene una dirección registrada.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRequestRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user = serializer.get_user()

        if user and user.email:
            reset_token = PasswordResetToken.create_for_user(user)

            gym_name = (
                user.profile.gym.name
                if getattr(user, "profile", None)
                and user.profile.gym
                else None
            )

            from core.email import send_password_reset_email

            reset_url = "{}/reset-password?token={}".format(
                settings.FRONTEND_URL.rstrip("/"),
                reset_token.id,
            )

            send_password_reset_email(
                to_email=user.email,
                reset_url=reset_url,
                gym_name=gym_name,
            )

        return Response(
            {
                "detail": (
                    "Si el email está registrado, vas a recibir "
                    "un enlace para restablecer tu contraseña."
                )
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    Aplica la nueva contraseña usando el token del email.

    - Valida que el token sea válido (no usado, no expirado).
    - Cambia la contraseña.
    - Invalida el token y todas las sesiones del usuario.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetConfirmRateThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        serializer.save()

        return Response(
            {
                "detail": "Contraseña restablecida correctamente.",
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# PASSWORD RESET (admin)
# -------------------------
class AdminResetPasswordView(APIView):
    """
    Reseteo de contraseña iniciado por un admin.

    - Owner: puede resetear la contraseña de cualquier usuario de su gym.
    - Superadmin: puede resetear la contraseña de cualquier usuario.

    La nueva contraseña es temporal: el usuario debe cambiarla al entrar.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AdminPasswordResetSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data["user_id"]
        new_password = serializer.validated_data["new_password"]

        target_user = User.objects.filter(id=user_id).first()

        if not target_user:
            return Response(
                {"detail": "Usuario no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        request_profile = getattr(request.user, "profile", None)
        target_profile = getattr(target_user, "profile", None)

        if not request.user.is_superuser:
            # Owner: solo usuarios del MISMO gym
            if (
                not request_profile
                or not request_profile.gym
                or not target_profile
                or target_profile.gym_id
                != request_profile.gym_id
            ):
                raise PermissionDenied(
                    "Solo podés restablecer la contraseña de "
                    "usuarios de tu gimnasio."
                )

            # El owner no puede resetear la contraseña de otro owner
            if target_profile.role == UserProfile.ROLE_OWNER:
                raise PermissionDenied(
                    "No podés restablecer la contraseña del dueño."
                )

        target_user.set_password(new_password)
        target_user.save()

        target_profile.must_change_password = True
        target_profile.save(update_fields=["must_change_password"])

        # Invalidar sesiones activas para forzar re-login con la nueva clave
        Token.objects.filter(user=target_user).delete()

        return Response(
            {
                "detail": (
                    f"Contraseña de '{target_user.username}' restablecida. "
                    "El usuario deberá cambiarla al iniciar sesión."
                )
            },
            status=status.HTTP_200_OK,
        )