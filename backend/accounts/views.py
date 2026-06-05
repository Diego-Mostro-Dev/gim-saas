from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated

from django.contrib.auth.models import User

from gyms.models import Gym
from .serializers import (
    LoginSerializer,
    ChangePasswordSerializer,
)


# -------------------------
# LOGIN
# -------------------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

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

        return Response(
            {
                "success": True,
            },
            status=status.HTTP_200_OK,
        )


# -------------------------
# ONBOARDING: VALIDAR GYM LINK
# -------------------------
class GymOnboardingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code):
        try:
            gym = Gym.objects.get(onboarding_code=code)
        except Gym.DoesNotExist:
            return Response(
                {"valid": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "valid": True,
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
        except Gym.DoesNotExist:
            return Response(
                {"error": "Invalid gym code"},
                status=status.HTTP_400_BAD_REQUEST,
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
        profile.save()

        # 3. token automático
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "ok": True,
                "token": token.key,
                "user": user.username,
                "gym": gym.name,
            },
            status=status.HTTP_201_CREATED,
        )