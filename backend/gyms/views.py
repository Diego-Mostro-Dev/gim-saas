from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated,
    AllowAny,
)
from rest_framework.exceptions import PermissionDenied
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.conf import settings

from members.models import Member
from profiles.models import UserProfile
from .models import Gym
from .serializers import GymSerializer


def _truncate_short_name(name, limit):
    name = (name or "Gimnasio").strip()
    if len(name) <= limit:
        return name
    return name[: limit - 1] + "…"


def _build_manifest_icons(gym):
    if not gym.app_icon:
        return [
            {
                "src": "/pwa-192x192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": "/pwa-512x512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
        ]

    return [
        {
            "src": gym.app_icon.build_url(
                width=192, height=192, crop="fill", format="png"
            ),
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any",
        },
        {
            "src": gym.app_icon.build_url(
                width=512, height=512, crop="fill", format="png"
            ),
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any",
        },
    ]


def _build_pwa_manifest(gym, *, member):
    name = gym.name or "Gimnasio"

    if member:
        title = f"Portal de {name}"
        short_name = _truncate_short_name(name, 10)
        description = f"Portal del socio de {name}"
        app_id = "/routine/"
    else:
        title = name
        short_name = _truncate_short_name(name, 12)
        description = "Sistema de gestión para gimnasios"
        app_id = "/"

    manifest = {
        "name": title,
        "short_name": short_name,
        "description": description,
        "id": app_id,
        "scope": "/",
        "display": "standalone",
        "background_color": "#f8f9fa",
        "theme_color": "#6366f1",
        "orientation": "portrait-primary",
        "lang": "es-AR",
        "icons": _build_manifest_icons(gym),
    }

    if not member:
        manifest["start_url"] = "/"

    return manifest


class PwaMemberManifestView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        return JsonResponse(
            _build_pwa_manifest(member.gym, member=True),
            content_type="application/manifest+json",
        )


class PwaStaffManifestView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        gym = get_object_or_404(Gym, slug=slug)

        return JsonResponse(
            _build_pwa_manifest(gym, member=False),
            content_type="application/manifest+json",
        )


class GymMeView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied(
                "Usuario sin gimnasio asignado"
            )

        return profile.gym

    def get(self, request):
        gym = self.get_gym(request)

        serializer = GymSerializer(gym)

        data = serializer.data
        data["role"] = request.user.profile.role

        return Response(data)

    def patch(self, request):
        gym = self.get_gym(request)

        if request.user.profile.role != request.user.profile.ROLE_OWNER:
            raise PermissionDenied(
                "Solo el dueño del gimnasio puede modificar la configuración"
            )

        serializer = GymSerializer(
            gym,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save()

        return Response(
            serializer.data
        )


class GymStaffView(APIView):
    """Gestión de usuarios del gimnasio. Solo el owner puede gestionar staff."""

    permission_classes = [IsAuthenticated]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return profile.gym

    def require_owner(self, request):
        if request.user.profile.role != UserProfile.ROLE_OWNER:
            raise PermissionDenied(
                "Solo el dueño del gimnasio puede gestionar el staff"
            )

    def get(self, request):
        gym = self.get_gym(request)

        users = UserProfile.objects.filter(gym=gym).select_related("user")

        return Response(
            [
                {
                    "id": p.user.id,
                    "username": p.user.username,
                    "email": p.user.email,
                    "role": p.role,
                    "must_change_password": p.must_change_password,
                }
                for p in users
            ]
        )

    def post(self, request):
        self.require_owner(request)
        gym = self.get_gym(request)

        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Faltan campos obligatorios"},
                status=400,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "El nombre de usuario ya existe"},
                status=400,
            )

        user = User.objects.create_user(
            username=username,
            email=email or None,
            password=password,
        )

        profile = user.profile
        profile.gym = gym
        profile.role = UserProfile.ROLE_STAFF
        profile.save()

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": profile.role,
            },
            status=201,
        )


class GymStaffRemoveView(APIView):
    """Elimina un usuario staff del gimnasio. Solo el owner."""

    permission_classes = [IsAuthenticated]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return profile.gym

    def delete(self, request, user_id):
        if request.user.profile.role != UserProfile.ROLE_OWNER:
            raise PermissionDenied(
                "Solo el dueño del gimnasio puede gestionar el staff"
            )

        gym = self.get_gym(request)

        if user_id == request.user.id:
            raise PermissionDenied("No puedes eliminar tu propia cuenta")

        profile = get_object_or_404(UserProfile, user_id=user_id, gym=gym)

        if profile.role == UserProfile.ROLE_OWNER:
            raise PermissionDenied("No se puede eliminar al dueño del gimnasio")

        profile.user.delete()

        return Response(status=204)


class GymSeoView(APIView):
    """Devolver los datos SEO públicos de un gimnasio para prerender serverless.

    Es la fuente de verdad que consume la serverless function de Vercel
    (frontend/api/seo/register/<gym_code>.js) para servir HTML indexable por Google.
    """

    permission_classes = [AllowAny]

    def get(self, request, gym_code):
        gym = get_object_or_404(Gym, onboarding_code=gym_code)

        register_url = (
            settings.FRONTEND_URL + f"/register/{gym.onboarding_code}"
        )

        title = (
            gym.seo_title.strip()
            or f"{gym.name} | Registrate como socio"
        ).strip()

        description = (
            gym.seo_description.strip()
            or f"Registrate como socio en {gym.name}."
        ).strip()

        logo_url = None
        og_image_url = None
        if gym.logo:
            logo_url = gym.logo.url
            og_image_url = gym.logo.build_url(
                width=1200, height=630, crop="fill"
            )
        elif gym.app_icon:
            og_image_url = gym.app_icon.build_url(
                width=1200, height=630, crop="fill"
            )

        payload = {
            "name": gym.name,
            "logo_url": logo_url,
            "og_image_url": og_image_url,
            "title": title,
            "description": description,
            "keywords": gym.seo_keywords.strip(),
            "city": gym.seo_city.strip(),
            "address": gym.seo_address.strip(),
            "hours": gym.seo_hours.strip(),
            "phone": gym.phone.strip(),
            "whatsapp": gym.whatsapp.strip(),
            "email": gym.email.strip(),
            "register_url": register_url,
            "canonical_url": register_url,
            "active": gym.active,
        }

        return JsonResponse(payload)
