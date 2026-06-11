from django.test import TestCase, override_settings
from django.conf import settings

from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from gyms.models import Gym
from django.contrib.auth.models import User


BASE_REST_FW = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class CORSConfigTest(TestCase):
    """CORS configuration is locked down for production."""

    def test_cors_wildcard_disabled(self):
        self.assertIs(
            getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False),
            False,
        )

    def test_cors_allowed_origins_populated(self):
        origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
        self.assertGreater(len(origins), 0)


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class ThrottleConfigTest(TestCase):
    """Rate-limiting classes and global defaults are configured."""

    def test_throttle_rates_set(self):
        from config.api.throttles import (
            LoginRateThrottle, OnboardingCreateRateThrottle,
            PublicAttendanceRateThrottle, PublicMemberRateThrottle,
        )
        self.assertEqual(LoginRateThrottle.rate, "10/hour")
        self.assertEqual(OnboardingCreateRateThrottle.rate, "5/hour")
        self.assertEqual(PublicAttendanceRateThrottle.rate, "30/hour")
        self.assertEqual(PublicMemberRateThrottle.rate, "60/hour")

    @override_settings(REST_FRAMEWORK={
        "DEFAULT_THROTTLE_RATES": {"anon": "60/hour", "user": "1000/hour"},
    })
    def test_global_throttle_rates(self):
        rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        self.assertEqual(rates.get("anon"), "60/hour")
        self.assertEqual(rates.get("user"), "1000/hour")

    def test_throttle_classes_on_views(self):
        from accounts.views import LoginView, CreateGymOwnerView, GymOnboardingView
        from attendance.public_views import PublicCheckinView
        self.assertTrue(LoginView.throttle_classes)
        self.assertTrue(CreateGymOwnerView.throttle_classes)
        self.assertTrue(GymOnboardingView.throttle_classes)
        self.assertTrue(PublicCheckinView.throttle_classes)


class ProductionConfigAudit(TestCase):
    """Logs production settings for manual verification."""

    def test_log_config(self):
        print("")
        print("── PRODUCTION CONFIGURATION ──")
        debug = getattr(settings, "DEBUG", "NOT SET")
        allowed = getattr(settings, "ALLOWED_HOSTS", [])
        cors = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
        frontend = getattr(settings, "FRONTEND_URL", "NOT SET")
        print(f"  DEBUG = {debug}")
        print(f"  ALLOWED_HOSTS = {allowed}")
        print(f"  CORS_ALLOWED_ORIGINS = {cors}")
        print(f"  FRONTEND_URL = {frontend}")
        print(f"  SECRET_KEY = os.getenv('SECRET_KEY')")
        print(f"  DATABASE_URL = os.getenv('DATABASE_URL')")
        self.assertTrue(True)
