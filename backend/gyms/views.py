from rest_framework.response import Response
from rest_framework import viewsets
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
from django.utils import timezone

from core.mixins import GymQuerysetMixin
from core.permissions import require_owner
from members.models import Member
from profiles.models import UserProfile
from .holidays import HolidaysAPIError, fetch_argentina_holidays
from .labels import get_gym_labels, msg
from .models import Discount, Gym, GymClosedDate
from .serializers import DiscountSerializer, GymSerializer, GymClosedDateSerializer


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

        require_owner(request, "errors.owner_only_settings")

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


class GymClosedDateListCreateView(APIView):
    """Listar y crear fechas cerradas del gimnasio. Gestiona solo el owner."""

    permission_classes = [IsAuthenticated]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return profile.gym

    def get(self, request):
        gym = self.get_gym(request)

        closed_dates = GymClosedDate.objects.filter(gym=gym).order_by("date")

        serializer = GymClosedDateSerializer(closed_dates, many=True)

        return Response(serializer.data)

    def post(self, request):
        require_owner(request, "errors.owner_only_closed_dates")
        gym = self.get_gym(request)

        serializer = GymClosedDateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(gym=gym)

        return Response(serializer.data, status=201)


class GymClosedDateDetailView(APIView):
    """Elimina una fecha cerrada del gimnasio. Solo el owner."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, closed_date_id):
        require_owner(request, "errors.owner_only_closed_dates")

        profile = getattr(request.user, "profile", None)
        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        closed_date = get_object_or_404(
            GymClosedDate,
            pk=closed_date_id,
            gym=profile.gym,
        )
        closed_date.delete()

        return Response(status=204)


class GymClosedDateHolidaysView(APIView):
    """Carga en bloque los feriados de Argentina. Solo el owner.

    Trae los feriados del año desde la API pública y crea una fecha cerrada
    por cada uno que sea futura y no exista aún en el gimnasio.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        require_owner(request, "errors.owner_only_closed_dates")

        profile = getattr(request.user, "profile", None)
        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        gym = profile.gym

        raw_year = request.data.get("year")
        try:
            year = int(raw_year)
        except (TypeError, ValueError):
            return Response({"error": "Año inválido"}, status=400)

        try:
            holidays = fetch_argentina_holidays(year)
        except HolidaysAPIError as exc:
            return Response({"error": str(exc)}, status=502)

        today = timezone.localdate()
        existing = set(
            GymClosedDate.objects.filter(gym=gym).values_list("date", flat=True)
        )

        to_create = []
        added = []
        skipped_past = []
        skipped_existing = []

        for holiday_date, reason in holidays:
            if holiday_date < today:
                skipped_past.append(
                    {"date": holiday_date.isoformat(), "reason": reason}
                )
                continue
            if holiday_date in existing:
                skipped_existing.append(
                    {"date": holiday_date.isoformat(), "reason": reason}
                )
                continue
            to_create.append(
                GymClosedDate(gym=gym, date=holiday_date, reason=reason)
            )
            added.append(
                {"date": holiday_date.isoformat(), "reason": reason}
            )

        if to_create:
            GymClosedDate.objects.bulk_create(to_create)

        return Response(
            {
                "created": len(to_create),
                "added": added,
                "skipped_past": skipped_past,
                "skipped_existing": skipped_existing,
            }
        )


class GymStaffView(APIView):
    """Gestión de usuarios del gimnasio. Solo el owner puede gestionar staff."""

    permission_classes = [IsAuthenticated]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return profile.gym

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
                    "gender": p.gender,
                    "phone": p.phone or None,
                    "whatsapp": p.whatsapp or None,
                    "must_change_password": p.must_change_password,
                }
                for p in users
            ]
        )

    def post(self, request):
        require_owner(request, "errors.owner_only_staff")
        gym = self.get_gym(request)

        username = (request.data.get("username") or "").strip()
        email = (request.data.get("email") or "").strip()
        password = request.data.get("password")
        role = request.data.get("role", UserProfile.ROLE_STAFF)
        gender = (request.data.get("gender") or "").strip()
        phone = (request.data.get("phone") or "").strip()
        whatsapp = (request.data.get("whatsapp") or "").strip()

        if not username or not password:
            return Response(
                {"error": "Faltan campos obligatorios"},
                status=400,
            )

        if role not in (
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_PROFESSOR,
            UserProfile.ROLE_TRAINER,
        ):
            return Response(
                {"error": "Rol inválido"},
                status=400,
            )

        if gender and gender not in dict(UserProfile.GENDER_CHOICES):
            return Response(
                {"error": "Género inválido"},
                status=400,
            )

        if role == UserProfile.ROLE_TRAINER and not whatsapp:
            return Response(
                {"error": "El whatsapp es obligatorio para entrenadores"},
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
        profile.role = role
        profile.gender = gender
        profile.phone = phone
        profile.whatsapp = whatsapp
        profile.save()

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": profile.role,
                "gender": profile.gender,
                "phone": profile.phone,
                "whatsapp": profile.whatsapp,
            },
            status=201,
        )


class GymStaffDetailView(APIView):
    """Elimina o edita un usuario staff/profesor del gimnasio. Solo el owner."""

    permission_classes = [IsAuthenticated]

    def get_gym(self, request):
        profile = getattr(request.user, "profile", None)

        if not profile or not profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return profile.gym

    def delete(self, request, user_id):
        require_owner(request, "errors.owner_only_staff")

        gym = self.get_gym(request)

        if user_id == request.user.id:
            raise PermissionDenied("No puedes eliminar tu propia cuenta")

        profile = get_object_or_404(UserProfile, user_id=user_id, gym=gym)

        if profile.role == UserProfile.ROLE_OWNER:
            raise PermissionDenied(
                msg(gym, "errors.cannot_remove_owner")
            )

        profile.user.delete()

        return Response(status=204)

    def patch(self, request, user_id):
        require_owner(request, "errors.owner_only_staff")

        gym = self.get_gym(request)

        if user_id == request.user.id:
            raise PermissionDenied("No puedes cambiar tu propio rol")

        profile = get_object_or_404(UserProfile, user_id=user_id, gym=gym)

        if profile.role == UserProfile.ROLE_OWNER:
            raise PermissionDenied("No se puede cambiar el rol del dueño")

        role = request.data.get("role")

        if role is not None:
            if role not in (
                UserProfile.ROLE_STAFF,
                UserProfile.ROLE_PROFESSOR,
                UserProfile.ROLE_TRAINER,
            ):
                return Response(
                    {"error": "Rol inválido"},
                    status=400,
                )
            profile.role = role

        gender = (request.data.get("gender") or "").strip()
        if gender:
            if gender not in dict(UserProfile.GENDER_CHOICES):
                return Response(
                    {"error": "Género inválido"},
                    status=400,
                )
            profile.gender = gender

        phone = (request.data.get("phone") or "").strip()
        if phone:
            profile.phone = phone

        whatsapp = (request.data.get("whatsapp") or "").strip()
        if whatsapp or role == UserProfile.ROLE_TRAINER:
            if role == UserProfile.ROLE_TRAINER and not whatsapp:
                return Response(
                    {"error": "El whatsapp es obligatorio para entrenadores"},
                    status=400,
                )
            profile.whatsapp = whatsapp

        profile.save()

        return Response(
            {
                "id": profile.user.id,
                "username": profile.user.username,
                "email": profile.user.email,
                "role": profile.role,
                "gender": profile.gender,
                "phone": profile.phone,
                "whatsapp": profile.whatsapp,
            }
        )


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


class PublicGymView(APIView):
    """Datos públicos de un gimnasio para los flujos abiertos (registro, check-in).

    Devuelve identidad visual y labels de texto para que el frontend hable
    con el vocabulario de cada gimnasio (ej: SINKRO usa "entrenamiento").
    """

    permission_classes = [AllowAny]

    def get(self, request, gym_code):
        gym = get_object_or_404(Gym, onboarding_code=gym_code)

        logo_url = None
        app_icon_url = None
        app_icon_favicon_url = None
        if gym.logo:
            logo_url = gym.logo.url
        if gym.app_icon:
            app_icon_url = gym.app_icon.url
            app_icon_favicon_url = gym.app_icon.build_url(
                width=64, height=64, crop="fill", format="png"
            )

        return JsonResponse(
            {
                "name": gym.name,
                "slug": gym.slug,
                "logo_url": logo_url,
                "app_icon_url": app_icon_url,
                "app_icon_favicon_url": app_icon_favicon_url,
                "labels": get_gym_labels(gym),
                "active": gym.active,
            }
        )


class DiscountViewSet(GymQuerysetMixin, viewsets.ModelViewSet):
    queryset = Discount.objects.all()
    serializer_class = DiscountSerializer
    pagination_class = None
