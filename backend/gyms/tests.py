from datetime import date, timedelta
from unittest.mock import patch

import requests
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token

from gyms.features import (
    FeatureDisabled,
    outings_enabled,
    require_outings,
)
from gyms.holidays import fetch_argentina_holidays
from gyms.models import Discount, Gym, GymClosedDate
from profiles.models import UserProfile
from core.testing import BaseAPITest


class GymRolePermissionTests(BaseAPITest):
    """Owner managea configuración y staff; el rol staff solo opera."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym, username="owner_user")
        self.staff = self.create_user(
            self.gym, username="staff_user", role=UserProfile.ROLE_STAFF
        )
        Token.objects.create(user=self.owner)
        Token.objects.create(user=self.staff)

    def credentials(self, user):
        token = Token.objects.get(user=user)
        return {"HTTP_AUTHORIZATION": f"Token {token.key}"}

    def test_staff_cannot_patch_gym_config(self):
        self.client.credentials(**self.credentials(self.staff))
        resp = self.client.patch(
            "/api/gyms/me/",
            {"name": "Renombrada"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_owner_can_patch_gym_config(self):
        self.client.credentials(**self.credentials(self.owner))
        resp = self.client.patch(
            "/api/gyms/me/",
            {"name": "Renombrada"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "Renombrada")

    def test_owner_cannot_change_active_by_api(self):
        self.client.credentials(**self.credentials(self.owner))

        resp = self.client.patch(
            "/api/gyms/me/",
            {"active": False},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.gym.refresh_from_db()
        self.assertTrue(self.gym.active)

    def test_owner_cannot_change_slug_by_api(self):
        self.client.credentials(**self.credentials(self.owner))
        original_slug = self.gym.slug

        resp = self.client.patch(
            "/api/gyms/me/",
            {"slug": "slug-cambiado"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.gym.refresh_from_db()
        self.assertEqual(self.gym.slug, original_slug)

    def test_owner_can_still_patch_other_fields_with_read_only_fields(self):
        self.client.credentials(**self.credentials(self.owner))

        resp = self.client.patch(
            "/api/gyms/me/",
            {"name": "Renombrada", "active": False},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.gym.refresh_from_db()
        self.assertEqual(self.gym.name, "Renombrada")
        self.assertTrue(self.gym.active)

    def test_staff_cannot_create_staff(self):
        self.client.credentials(**self.credentials(self.staff))
        resp = self.client.post(
            "/api/gyms/staff/",
            {"username": "nuevo", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_staff_cannot_delete_staff(self):
        self.client.credentials(**self.credentials(self.staff))
        resp = self.client.delete(f"/api/gyms/staff/{self.owner.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_staff_can_list_gym_users(self):
        self.client.credentials(**self.credentials(self.staff))
        resp = self.client.get("/api/gyms/staff/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_owner_creates_staff_user(self):
        self.client.credentials(**self.credentials(self.owner))
        resp = self.client.post(
            "/api/gyms/staff/",
            {"username": "recepcion", "email": "rec@example.com", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        profile = UserProfile.objects.get(user__username="recepcion")
        self.assertEqual(profile.gym, self.gym)
        self.assertEqual(profile.role, UserProfile.ROLE_STAFF)

    def test_owner_cannot_delete_owner(self):
        self.client.credentials(**self.credentials(self.owner))
        resp = self.client.delete(f"/api/gyms/staff/{self.owner.id}/")
        self.assertEqual(resp.status_code, 403)


class CreateGymCommandTests(BaseAPITest):
    def test_create_gym_creates_gym_and_owner(self):
        call_command(
            "create_gym",
            "Atlas Gym",
            owner_username="atlas",
            owner_password="S3cret!pass",
        )
        gym = Gym.objects.get(slug="atlas-gym")
        profile = UserProfile.objects.get(user__username="atlas")
        self.assertEqual(profile.gym, gym)
        self.assertEqual(profile.role, UserProfile.ROLE_OWNER)
        self.assertTrue(gym.onboarding_code)

    def test_create_gym_custom_slug(self):
        call_command(
            "create_gym",
            "Mi Gimnasio",
            slug="mi-gym",
            owner_username="migym",
            owner_password="S3cret!pass",
        )
        self.assertTrue(Gym.objects.filter(slug="mi-gym").exists())

    def test_create_gym_rejects_duplicate_slug(self):
        call_command(
            "create_gym",
            "Atlas",
            owner_username="atlas",
            owner_password="S3cret!pass",
        )
        with self.assertRaises(CommandError):
            call_command(
                "create_gym",
                "Atlas",
                owner_username="atlas2",
                owner_password="S3cret!pass",
            )

    def test_create_gym_rejects_duplicate_username(self):
        call_command(
            "create_gym",
            "Atlas",
            owner_username="atlas",
            owner_password="S3cret!pass",
        )
        with self.assertRaises(CommandError):
            call_command(
                "create_gym",
                "Atlas Dos",
                owner_username="atlas",
                owner_password="S3cret!pass",
            )


class GymClosedDateHolidaysTests(BaseAPITest):
    """Carga en bloque de feriados de Argentina como fechas cerradas."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym, username="owner_holidays")
        self.staff = self.create_user(
            self.gym, username="staff_holidays", role=UserProfile.ROLE_STAFF
        )
        Token.objects.create(user=self.owner)
        Token.objects.create(user=self.staff)

        self.today = timezone.localdate()
        self.past = self.today - timedelta(days=5)
        self.future_a = self.today + timedelta(days=10)
        self.future_b = self.today + timedelta(days=20)

        self.payload = [
            {
                "fecha": self.past.isoformat(),
                "tipo": "inamovible",
                "nombre": "Feriado pasado",
            },
            {
                "fecha": self.future_a.isoformat(),
                "tipo": "inamovible",
                "nombre": "Feriado futuro A",
            },
            {
                "fecha": self.future_b.isoformat(),
                "tipo": "trasladable",
                "nombre": "Feriado futuro B",
            },
        ]

    def credentials(self, user):
        token = Token.objects.get(user=user)
        return {"HTTP_AUTHORIZATION": f"Token {token.key}"}

    def mock_api(self, payload):
        return patch(
            "requests.get",
            return_value=type(
                "FakeResp",
                (),
                {
                    "raise_for_status": lambda self: None,
                    "json": lambda self: payload,
                },
            )(),
        )

    def test_staff_cannot_load_holidays(self):
        self.client.credentials(**self.credentials(self.staff))
        with self.mock_api(self.payload), patch(
            "gyms.holidays.HARDCODED_HOLIDAYS", {}
        ), patch("gyms.holidays._jueves_santo", return_value=None):
            resp = self.client.post(
                "/api/gyms/me/closed-dates/holidays/", {"year": 2026}, format="json"
            )
        self.assertEqual(resp.status_code, 403)

    def test_owner_loads_only_future_holidays(self):
        self.client.credentials(**self.credentials(self.owner))
        with self.mock_api(self.payload), patch(
            "gyms.holidays.HARDCODED_HOLIDAYS", {}
        ), patch("gyms.holidays._jueves_santo", return_value=None):
            resp = self.client.post(
                "/api/gyms/me/closed-dates/holidays/", {"year": 2026}, format="json"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["created"], 2)
        self.assertEqual(
            {item["date"] for item in resp.data["added"]},
            {self.future_a.isoformat(), self.future_b.isoformat()},
        )
        self.assertEqual(len(resp.data["skipped_past"]), 1)
        self.assertEqual(
            resp.data["skipped_past"][0]["date"], self.past.isoformat()
        )
        self.assertEqual(
            set(GymClosedDate.objects.filter(gym=self.gym).values_list("date", flat=True)),
            {self.future_a, self.future_b},
        )

    def test_owner_skips_existing_dates(self):
        GymClosedDate.objects.create(
            gym=self.gym, date=self.future_a, reason="Ya cargado"
        )
        self.client.credentials(**self.credentials(self.owner))
        with self.mock_api(self.payload), patch(
            "gyms.holidays.HARDCODED_HOLIDAYS", {}
        ), patch("gyms.holidays._jueves_santo", return_value=None):
            resp = self.client.post(
                "/api/gyms/me/closed-dates/holidays/", {"year": 2026}, format="json"
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["created"], 1)
        self.assertEqual(
            [item["date"] for item in resp.data["skipped_existing"]],
            [self.future_a.isoformat()],
        )
        self.assertEqual(
            set(GymClosedDate.objects.filter(gym=self.gym).values_list("date", flat=True)),
            {self.future_a, self.future_b},
        )

    def test_default_year_is_current(self):
        self.client.credentials(**self.credentials(self.owner))
        with self.mock_api(self.payload), patch(
            "gyms.holidays.HARDCODED_HOLIDAYS", {}
        ), patch("gyms.holidays._jueves_santo", return_value=None):
            resp = self.client.post("/api/gyms/me/closed-dates/holidays/", {}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["created"], 2)

    def test_invalid_year_rejected(self):
        self.client.credentials(**self.credentials(self.owner))
        resp = self.client.post(
            "/api/gyms/me/closed-dates/holidays/", {"year": "abc"}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_api_error_returns_502(self):
        self.client.credentials(**self.credentials(self.owner))
        with patch(
            "requests.get", side_effect=requests.RequestException("caído")
        ):
            resp = self.client.post(
                "/api/gyms/me/closed-dates/holidays/", {"year": 2026}, format="json"
            )
        self.assertEqual(resp.status_code, 502)

    def test_fetch_includes_rosario_hardcoded(self):
        with self.mock_api([]):
            holidays = fetch_argentina_holidays(2026)
        self.assertIn((date(2026, 10, 7), "Día de Rosario"), holidays)

    def test_fetch_includes_traditional_non_working_days(self):
        with self.mock_api([]):
            holidays = fetch_argentina_holidays(2026)
        self.assertIn((date(2026, 12, 24), "Nochebuena"), holidays)
        self.assertIn((date(2026, 12, 31), "Fin de año"), holidays)

    def test_fetch_includes_jueves_santo_from_easter(self):
        with self.mock_api([]):
            holidays_2026 = fetch_argentina_holidays(2026)
            holidays_2027 = fetch_argentina_holidays(2027)
        self.assertIn((date(2026, 4, 2), "Jueves Santo"), holidays_2026)
        self.assertIn((date(2027, 3, 25), "Jueves Santo"), holidays_2027)


class OutingsFeatureFlagTests(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()

    def test_outings_disabled_by_default(self):
        self.assertFalse(outings_enabled(self.gym))

    def test_require_outings_raises_when_disabled(self):
        with self.assertRaises(FeatureDisabled):
            require_outings(self.gym)

    def test_require_outings_passes_when_enabled(self):
        self.gym.features["salidas"] = True
        self.gym.save()
        self.assertTrue(outings_enabled(self.gym))
        require_outings(self.gym)


class GymScheduleHoursValidationTests(BaseAPITest):
    """CFG-01: los plazos de cambio de horario se configuran en horas.

    El campo es ``IntegerField``: una fracción (antes interpretada como días
    desde la UI) se redondeaba y un negativo quedaba guardado, dejando el
    cooldown/aviso sin efecto o con comportamiento inverso.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym, username="owner_user")
        Token.objects.create(user=self.owner)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.get(user=self.owner).key}"
        )

    def _patch(self, payload):
        return self.client.patch("/api/gyms/me/", payload, format="json")

    def test_fractional_hours_rejected(self):
        resp = self._patch({"schedule_change_notice_hours": 1.5})

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("schedule_change_notice_hours", resp.data)

    def test_negative_hours_rejected(self):
        resp = self._patch({"schedule_change_cooldown_hours": -1})

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("schedule_change_cooldown_hours", resp.data)

    def test_whole_hours_accepted(self):
        resp = self._patch(
            {
                "schedule_change_notice_hours": 24,
                "schedule_change_cooldown_hours": 0,
            }
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.gym.refresh_from_db()
        self.assertEqual(self.gym.schedule_change_notice_hours, 24)
        self.assertEqual(self.gym.schedule_change_cooldown_hours, 0)


@override_settings(FRONTEND_URL=None)
class FrontendUrlMissingTests(BaseAPITest):
    """REF-09: sin FRONTEND_URL los constructores de URLs no deben romper.

    ``FRONTEND_URL`` es opcional (``os.getenv``); en CI no existe, y concatenar
    ``None`` con un str daba ``TypeError`` en ``get_onboarding_url``/
    ``get_public_register_url``, el admin y la vista pública de registro. Acá se
    fuerza el caso ``None`` (no configurada) para reproducir exactamente el CI,
    porque ``settings.py`` ya normaliza a ``""`` al cargar.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym, username="owner_user")
        Token.objects.create(user=self.owner)

    def test_onboarding_and_register_urls_are_relative(self):
        self.assertEqual(
            self.gym.get_onboarding_url(),
            f"/onboarding/{self.gym.onboarding_code}",
        )
        self.assertEqual(
            self.gym.get_public_register_url(),
            f"/register/{self.gym.onboarding_code}",
        )

    def test_gym_serialization_succeeds(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.get(user=self.owner).key}"
        )
        resp = self.client.get("/api/gyms/me/")

        self.assertEqual(resp.status_code, 200, resp.data)

    def test_public_seo_view_succeeds(self):
        resp = self.client.get(
            f"/api/gyms/public/seo/{self.gym.onboarding_code}/"
        )

        self.assertEqual(resp.status_code, 200, resp.content)


class DiscountOwnerGateTests(BaseAPITest):
    """CFG-16: el catálogo se lee con cualquier rol, pero sólo lo escribe el dueño."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym, username="owner_discounts")
        self.staff = self.create_user(
            self.gym,
            username="staff_discounts",
            role=UserProfile.ROLE_STAFF,
        )
        self.professor = self.create_user(
            self.gym,
            username="professor_discounts",
            role=UserProfile.ROLE_PROFESSOR,
        )
        self.discount = Discount.objects.create(
            gym=self.gym,
            name="Promo",
            discount_percent=10,
        )
        self.list_url = "/api/gyms/me/discounts/"
        self.detail_url = f"{self.list_url}{self.discount.id}/"

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_staff_cannot_create_discount(self):
        self._auth(self.staff)

        resp = self.client.post(
            self.list_url,
            {"name": "Promo staff", "discount_percent": 15},
            format="json",
        )

        self.assertEqual(resp.status_code, 403, resp.data)
        self.assertEqual(
            resp.data["detail"],
            "Solo el dueño puede gestionar los descuentos.",
        )
        self.assertFalse(Discount.objects.filter(name="Promo staff").exists())

    def test_professor_cannot_edit_or_delete_discount(self):
        self._auth(self.professor)

        with self.subTest(action="patch"):
            resp = self.client.patch(
                self.detail_url,
                {"discount_percent": 20},
                format="json",
            )
            self.assertEqual(resp.status_code, 403, resp.data)

        with self.subTest(action="delete"):
            resp = self.client.delete(self.detail_url)
            self.assertEqual(resp.status_code, 403, resp.data)

        self.discount.refresh_from_db()
        self.assertEqual(self.discount.discount_percent, 10)

    def test_owner_can_create_edit_and_delete_discount(self):
        self._auth(self.owner)

        resp = self.client.post(
            self.list_url,
            {"name": "Promo dueño", "discount_percent": 15},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        discount = Discount.objects.get(pk=resp.data["id"])

        resp = self.client.patch(
            f"{self.list_url}{discount.id}/",
            {"discount_percent": 25},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        discount.refresh_from_db()
        self.assertEqual(discount.discount_percent, 25)

        resp = self.client.delete(f"{self.list_url}{discount.id}/")
        self.assertEqual(resp.status_code, 204, resp.data)
        self.assertFalse(Discount.objects.filter(pk=discount.id).exists())

    def test_staff_can_list_discounts(self):
        self._auth(self.staff)

        resp = self.client.get(self.list_url)

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(len(resp.data), 1)
