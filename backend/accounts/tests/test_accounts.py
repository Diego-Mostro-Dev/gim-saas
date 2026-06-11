from unittest.mock import patch

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.utils.timezone import now
from datetime import timedelta, time

from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from gyms.models import Gym
from members.models import Member
from subscriptions.models import Subscription
from plans.models import MembershipPlan
from attendance.models import ScheduleSlot


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
class OnboardingValidationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        self.valid_url = (
            f"/api/auth/onboarding/validate/"
            f"{self.gym.onboarding_code}/"
        )
        self.invalid_url = (
            "/api/auth/onboarding/validate/"
            "00000000-0000-0000-0000-000000000000/"
        )

    def test_valid_onboarding_code(self):
        response = self.client.get(self.valid_url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["gym_name"], "Test Gym")
        self.assertEqual(response.data["gym_id"], self.gym.id)

    def test_invalid_onboarding_code(self):
        response = self.client.get(self.invalid_url)
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.data["valid"])


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class OwnerCreationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        self.url = "/api/auth/onboarding/create-owner/"

    def test_create_owner_success(self):
        with patch("accounts.views.OnboardingCreateRateThrottle.rate", "1000/hour"):
            code = str(self.gym.onboarding_code)
            response = self.client.post(self.url, {
            "gym_code": code,
            "username": "owner1",
            "email": "owner@test.com",
            "password": "SecurePass123!",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["ok"])
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"], "owner1")
        self.assertEqual(response.data["gym"], "Test Gym")
        self.assertTrue(response.data["must_change_password"])

        user = User.objects.get(username="owner1")
        self.assertEqual(user.profile.gym, self.gym)
        self.assertTrue(user.profile.must_change_password)
        self.assertTrue(Token.objects.filter(user=user).exists())

    def test_create_owner_missing_fields(self):
        code = str(self.gym.onboarding_code)
        response = self.client.post(self.url, {
            "gym_code": code,
            "username": "owner2",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing required fields", response.data["error"])

    def test_create_owner_invalid_code(self):
        response = self.client.post(self.url, {
            "gym_code": "00000000-0000-0000-0000-000000000000",
            "username": "owner3",
            "password": "SecurePass123!",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid gym code", response.data["error"])


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class MustChangePasswordFlowTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        self.user = User.objects.create_user(
            username="testuser",
            password="OldPass123!",
        )
        self.user.profile.gym = self.gym
        self.user.profile.must_change_password = True
        self.user.profile.save()
        self.login_url = "/api/auth/login/"
        self.me_url = "/api/auth/me/"
        self.change_pw_url = "/api/auth/change-password/"

    def test_login_returns_must_change_password(self):
        response = self.client.post(self.login_url, {
            "username": "testuser",
            "password": "OldPass123!",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertTrue(response.data["must_change_password"])

    def test_me_returns_must_change_password(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["must_change_password"])

    def test_change_password_clears_flag(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = self.client.post(self.change_pw_url, {
            "old_password": "OldPass123!",
            "new_password": "NewSecure456!",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])

        self.user.refresh_from_db()
        self.assertFalse(self.user.profile.must_change_password)

    def test_me_reflects_cleared_flag(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        resp = self.client.post(self.change_pw_url, {
            "old_password": "OldPass123!",
            "new_password": "NewSecure456!",
        }, format="json")

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {resp.data['token']}"
        )

        response = self.client.get(self.me_url)
        self.assertFalse(response.data["must_change_password"])


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class ProfileGymGuardTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        self.url = "/api/gyms/me/"

    def test_user_without_gym_gets_403(self):
        user = User.objects.create_user(
            username="nogym",
            password="Pass123!",
        )
        self.assertIsNotNone(user.profile)
        self.assertIsNone(user.profile.gym)

        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_user_with_gym_succeeds(self):
        user = User.objects.create_user(
            username="withgym",
            password="Pass123!",
        )
        user.profile.gym = self.gym
        user.profile.save()

        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Test Gym")

    def test_unauthenticated_gets_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class DashboardOptimizationTest(TestCase):
    def setUp(self):
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        user = User.objects.create_user(
            username="admin",
            password="Pass123!",
        )
        user.profile.gym = self.gym
        user.profile.save()
        self.token, _ = Token.objects.get_or_create(user=user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.today = now().date()

        # Create ScheduleSlots for Mon-Sat (gym closed Sunday)
        for day_key in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]:
            ScheduleSlot.objects.create(gym=self.gym, day=day_key, hour=time(8, 0))

        plan = MembershipPlan.objects.create(
            gym=self.gym, name="Basic", price=50, duration_days=30,
        )
        plan2 = MembershipPlan.objects.create(
            gym=self.gym, name="Premium", price=100, duration_days=30,
        )

        for i in range(100):
            member = Member.objects.create(
                first_name=f"First{i}", last_name=f"Last{i}",
                phone=f"555{i:04d}", gym=self.gym, active=True,
            )
            end = (
                self.today + timedelta(days=i + 1)
                if i < 10
                else self.today + timedelta(days=60)
            )
            Subscription.objects.create(
                gym=self.gym, member=member,
                plan=plan if i % 2 == 0 else plan2,
                start_date=self.today - timedelta(days=30),
                end_date=end,
                paid=i % 3 != 0,
            )

        self.url = "/api/dashboard/"

    def test_dashboard_returns_expected_fields(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

        expected_keys = {
            "activeMembers", "currentMonthRevenue",
            "previousMonthRevenue", "expiringSoon",
            "upcomingExpirations", "recentActivity",
            "pendingPayments", "weeklyAttendance",
        }
        self.assertEqual(set(response.data.keys()), expected_keys)

    def test_dashboard_expiring_soon_bounds(self):
        response = self.client.get(self.url)
        self.assertGreaterEqual(response.data["expiringSoon"], 0)
        self.assertLessEqual(
            len(response.data["upcomingExpirations"]), 5,
        )

    def test_dashboard_section_limits(self):
        response = self.client.get(self.url)
        self.assertLessEqual(
            len(response.data["recentActivity"]), 5,
        )
        self.assertLessEqual(
            len(response.data["pendingPayments"]), 10,
        )

    def test_dashboard_no_full_list_load(self):
        import tracemalloc
        tracemalloc.start()

        response = self.client.get(self.url)

        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        self.assertEqual(response.status_code, 200)
        self.assertLess(peak, 10 * 1024 * 1024)

    def test_weekly_attendance_excludes_sunday(self):
        response = self.client.get(self.url)
        days = [entry["day"] for entry in response.data["weeklyAttendance"]]
        self.assertNotIn("Dom", days)
        self.assertLessEqual(len(days), 6)

    def test_pending_payments_excludes_expired(self):
        # Create a subscription that ended yesterday and is unpaid
        expired_member = Member.objects.create(
            first_name="Expired", last_name="Member",
            phone="5550000", gym=self.gym, active=True,
        )
        plan = MembershipPlan.objects.first()
        Subscription.objects.create(
            gym=self.gym, member=expired_member,
            plan=plan,
            start_date=self.today - timedelta(days=60),
            end_date=self.today - timedelta(days=1),
            paid=False,
        )

        response = self.client.get(self.url)
        for payment in response.data["pendingPayments"]:
            self.assertNotEqual(payment["member_name"], "Expired Member")
