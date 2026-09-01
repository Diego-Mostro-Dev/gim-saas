from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

from gyms.models import Gym
from profiles.models import UserProfile
from .serializers import (
    LoginSerializer,
    ChangePasswordSerializer,
)
from config.api.throttles import (
    LoginRateThrottle,
    OnboardingCreateRateThrottle,
    OnboardingValidateRateThrottle,
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

        # Keep each session's token independent so logging in on another
        # tab/device does not revoke the tokens of existing sessions. The
        # multi-tenant gym is resolved from request.user, not the token, so
        # concurrent tokens for the same user stay scoped to their own gym.
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "token": token.key,
                "username": user.username,
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
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "ok": True,
                "token": token.key,
                "user": user.username,
                "gym": gym.name,
                "must_change_password": (
                    profile.must_change_password
                ),
            },
            status=status.HTTP_201_CREATED,
        )