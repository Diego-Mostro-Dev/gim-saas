from decimal import Decimal

from django.contrib.auth.models import User

from activities.models import Activity, ActivitySchedule
from attendance.models import ScheduleSlot
from gyms.models import Discount, Gym, GymClosedDate
from members.models import HealthInsurance
from plans.models import MembershipPlan, Service
from profiles.models import UserProfile

from core.testing import BaseAPITest

from rest_framework.authtoken.models import Token


PAYLOAD_BASE = {
    "name": "SportBox Villa Urquiza",
    "slug": "sportbox-villa-urquiza",
    "whatsapp": "+5491112345678",
    "phone": "1123456789",
    "email": "info@sportbox.com",
    "payment_due_day": 5,
    "access_block_day": 10,
    "features": {"activities": False},
    "plans": [
        {
            "service": "Mensualidad",
            "name": "Pase Mensual",
            "description": "Acceso ilimitado",
            "price": "30000.00",
            "weekly_visits": None,
        }
    ],
    "slots": [
        {"day": "monday", "hour": "08:00", "capacity": 20},
        {"day": "monday", "hour": "18:00", "capacity": 20},
    ],
    "discounts": [
        {"name": "Pareja", "discount_percent": 15}
    ],
    "health_insurances": [
        {"name": "IAPOS", "session_price": "6000.00"}
    ],
    "closed_dates": [
        {"date": "2026-12-25", "reason": "Navidad"}
    ],
    "owner": {"mode": "link"},
}


class AdminGymApiTests(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.superuser = User.objects.create_superuser(
            username="central",
            password="pass12345",
        )
        self.super_token = Token.objects.create(
            user=self.superuser
        ).key

    def auth(self, token):
        return {"HTTP_AUTHORIZATION": f"Token {token}"}

    def test_non_superuser_gets_403(self):
        # Un owner/gym normal NO puede listar ni crear gyms.
        gym = self.create_gym()
        user = self.create_user(gym, username="owner", role="owner")
        token = Token.objects.create(user=user).key

        resp = self.client.get(
            "/api/admin/gyms/", **self.auth(token)
        )
        self.assertEqual(resp.status_code, 403)

        resp2 = self.client.post(
            "/api/admin/gyms/",
            data=PAYLOAD_BASE,
            format="json",
            **self.auth(token),
        )
        self.assertEqual(resp2.status_code, 403)

    def test_create_gym_without_activities(self):
        resp = self.client.post(
            "/api/admin/gyms/",
            data=PAYLOAD_BASE,
            format="json",
            **self.auth(self.super_token),
        )
        self.assertEqual(
            resp.status_code, 201, resp.data
        )

        gym = Gym.objects.get(slug="sportbox-villa-urquiza")
        self.assertEqual(gym.name, "SportBox Villa Urquiza")
        self.assertEqual(gym.payment_due_day, 5)
        self.assertEqual(gym.access_block_day, 10)
        self.assertEqual(gym.features, {"activities": False})

        # Owner NO se crea (modo link)
        self.assertEqual(
            UserProfile.objects.filter(gym=gym, role="owner").count(),
            0,
        )
        self.assertFalse(resp.data["owner_created"])
        self.assertTrue(gym.get_onboarding_url())

        # Plan base + plan del wizard
        self.assertTrue(
            MembershipPlan.objects.filter(gym=gym, is_base=True).exists()
        )
        std = MembershipPlan.objects.get(
            gym=gym, name="Pase Mensual"
        )
        self.assertEqual(std.price, Decimal("30000.00"))

        # Slots, descuentos, obras sociales, cierres
        self.assertEqual(ScheduleSlot.objects.filter(gym=gym).count(), 2)
        self.assertTrue(Discount.objects.filter(gym=gym, name="Pareja").exists())
        self.assertTrue(
            HealthInsurance.objects.filter(gym=gym, name="IAPOS").exists()
        )
        self.assertTrue(
            GymClosedDate.objects.filter(gym=gym, date="2026-12-25").exists()
        )

        # Sin actividades
        self.assertEqual(Activity.objects.filter(service__gym=gym).count(), 0)

    def test_create_gym_with_activities(self):
        payload = {
            **PAYLOAD_BASE,
            "features": {"activities": True},
            "activities": [
                {
                    "service": "Actividades",
                    "name": "Musculación",
                    "instructor_name": "Juan Pérez",
                    "monthly_price": "15000.00",
                    "billing_mode": "monthly",
                    "schedules": [
                        {
                            "day": "monday",
                            "start_time": "18:00",
                            "end_time": "19:00",
                            "capacity": 12,
                        }
                    ],
                }
            ],
        }

        resp = self.client.post(
            "/api/admin/gyms/",
            data=payload,
            format="json",
            **self.auth(self.super_token),
        )
        self.assertEqual(
            resp.status_code, 201, resp.data
        )

        gym = Gym.objects.filter(
            slug="sportbox-villa-urquiza"
        ).first()
        act = Activity.objects.get(service__gym=gym, name="Musculación")
        self.assertEqual(act.instructor_name, "Juan Pérez")
        self.assertEqual(act.monthly_price, Decimal("15000.00"))
        self.assertEqual(
            ActivitySchedule.objects.filter(activity=act).count(),
            1,
        )

    def test_create_gym_with_owner_credentials(self):
        payload = {
            **PAYLOAD_BASE,
            "owner": {
                "mode": "credentials",
                "username": "marcos.sportbox",
                "email": "marcos@sportbox.com",
                "password": "clave-temporal-2026",
            },
        }

        resp = self.client.post(
            "/api/admin/gyms/",
            data=payload,
            format="json",
            **self.auth(self.super_token),
        )
        self.assertEqual(
            resp.status_code, 201, resp.data
        )
        self.assertTrue(resp.data["owner_created"])

        gym = Gym.objects.get(slug="sportbox-villa-urquiza")
        owner = User.objects.get(username="marcos.sportbox")
        self.assertEqual(owner.profile.gym, gym)
        self.assertEqual(owner.profile.role, "owner")

        # El onboarding link queda inutilizable (ya hay owner): protegido.
        already = UserProfile.objects.filter(gym=gym).exists()
        self.assertTrue(already)

    def test_invalid_slug_duplicate_rejected(self):
        Gym.objects.create(
            name="Existente",
            slug="sportbox-villa-urquiza",
        )
        resp = self.client.post(
            "/api/admin/gyms/",
            data=PAYLOAD_BASE,
            format="json",
            **self.auth(self.super_token),
        )
        self.assertEqual(resp.status_code, 400)

    def test_block_day_must_follow_due_day(self):
        payload = {
            **PAYLOAD_BASE,
            "payment_due_day": 15,
            "access_block_day": 10,
        }
        resp = self.client.post(
            "/api/admin/gyms/",
            data=payload,
            format="json",
            **self.auth(self.super_token),
        )
        self.assertEqual(resp.status_code, 400)

    def test_admin_gyms_list(self):
        self.client.post(
            "/api/admin/gyms/",
            data=PAYLOAD_BASE,
            format="json",
            **self.auth(self.super_token),
        )

        resp = self.client.get(
            "/api/admin/gyms/",
            **self.auth(self.super_token),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data), 1)
        names = [g["name"] for g in resp.data]
        self.assertIn("SportBox Villa Urquiza", names)
        # Las URLs de registro/onboarding vienen listas para copiar
        self.assertTrue(resp.data[0]["register_url"])
        self.assertTrue(resp.data[0]["onboarding_url"])

    def test_admin_features_catalog(self):
        resp = self.client.get(
            "/api/admin/features/",
            **self.auth(self.super_token),
        )
        self.assertEqual(resp.status_code, 200)
        keys = [f["key"] for f in resp.data["features"]]
        self.assertIn("activities", keys)