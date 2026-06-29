from datetime import time

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.utils.timezone import now

from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from gyms.models import Gym
from members.models import Member
from plans.models import MembershipPlan
from subscriptions.models import Subscription
from subscriptions.services import get_last_day_of_month

from ..models import Activity, ActivitySchedule, Enrollment


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
class ScheduleEnrollTest(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-activity-enroll",
            phone="123",
            email="gym@test.com",
            features={"extra_activities": True},
        )

        self.user = User.objects.create_user(
            username="staff1", password="Pass123!"
        )
        self.user.profile.gym = self.gym
        self.user.profile.save()

        self.token = Token.objects.get_or_create(user=self.user)[0]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.activity = Activity.objects.create(
            gym=self.gym,
            name="Yoga",
            description="Clase de yoga",
            active=True,
        )
        self.schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(10, 0),
            end_time=time(11, 0),
            capacity=5,
        )

        self.member = Member.objects.create(
            gym=self.gym,
            first_name="Juan",
            last_name="Pérez",
            phone="555-0001",
            email="juan@example.com",
        )

        end = get_last_day_of_month(now().date())
        self.plan = MembershipPlan.objects.create(
            gym=self.gym,
            name="Mensual",
            price=100,
            duration_days=30,
            weekly_visits=5,
            active=True,
        )
        self.sub = Subscription.objects.create(
            gym=self.gym,
            member=self.member,
            plan=self.plan,
            start_date=now().date(),
            end_date=end,
            paid=True,
            auto_renew=True,
        )

        self.enroll_url = (
            f"/api/activities/schedules/{self.schedule.id}/enroll/"
        )
        self.enrollments_url = (
            f"/api/activities/schedules/{self.schedule.id}/enrollments/"
        )

    def _assert_enroll_success(self, response):
        self.assertEqual(response.status_code, 201)
        self.assertIn("id", response.data)
        self.assertEqual(response.data["active"], True)
        self.assertEqual(response.data["schedule"], self.schedule.id)
        self.assertEqual(response.data["member"]["id"], self.member.id)
        self.assertEqual(response.data["member"]["first_name"], "Juan")
        self.assertEqual(response.data["member"]["last_name"], "Pérez")

    def test_enroll_success(self):
        response = self.client.post(
            self.enroll_url, {"member_id": self.member.id}, format="json"
        )
        self._assert_enroll_success(response)
        self.assertTrue(
            Enrollment.objects.filter(
                gym=self.gym,
                member=self.member,
                schedule=self.schedule,
                active=True,
            ).exists()
        )

    def test_enroll_requires_member_id(self):
        response = self.client.post(self.enroll_url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("member_id", response.data.get("detail", ""))

    def test_enroll_rejects_duplicate(self):
        Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.schedule,
            active=True,
        )
        response = self.client.post(
            self.enroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("ya está inscripto", response.data.get("detail", "").lower())

    def test_enroll_rejects_when_full(self):
        for i in range(self.schedule.capacity):
            m = Member.objects.create(
                gym=self.gym,
                first_name=f"Extra{i}",
                last_name="Test",
                phone=f"555-01{i:02d}",
                email=f"extra{i}@test.com",
            )
            Enrollment.objects.create(
                gym=self.gym, member=m, schedule=self.schedule, active=True,
            )
        response = self.client.post(
            self.enroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("capacidad máxima", response.data.get("detail", "").lower())

    def test_enroll_rejects_member_from_other_gym(self):
        other_gym = Gym.objects.create(
            name="Other",
            slug="test-other-enroll",
            phone="999",
            email="other@test.com",
        )
        other_member = Member.objects.create(
            gym=other_gym,
            first_name="Otro",
            last_name="Gym",
            phone="555-9999",
            email="other@test.com",
        )
        response = self.client.post(
            self.enroll_url, {"member_id": other_member.id}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_enroll_rejects_when_feature_disabled(self):
        self.gym.features["extra_activities"] = False
        self.gym.save()
        response = self.client.post(
            self.enroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_list_enrollments(self):
        Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.schedule,
            active=True,
        )
        response = self.client.get(self.enrollments_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["member"]["id"], self.member.id)

    def test_list_enrollments_requires_auth(self):
        self.client.credentials()
        response = self.client.get(self.enrollments_url)
        self.assertEqual(response.status_code, 401)

    def test_enroll_requires_auth(self):
        self.client.credentials()
        response = self.client.post(
            self.enroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_enroll_rejects_inactive_activity(self):
        self.activity.active = False
        self.activity.save()
        response = self.client.post(
            self.enroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_enroll_rejects_non_existent_schedule(self):
        url = "/api/activities/schedules/999999/enroll/"
        response = self.client.post(
            url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_enroll_rejects_unknown_member_id(self):
        response = self.client.post(
            self.enroll_url, {"member_id": 999999}, format="json"
        )
        self.assertEqual(response.status_code, 404)


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class ScheduleUnenrollTest(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-activity-unenroll",
            phone="123",
            email="gym@test.com",
            features={"extra_activities": True},
        )

        self.user = User.objects.create_user(
            username="staff2", password="Pass123!"
        )
        self.user.profile.gym = self.gym
        self.user.profile.save()

        self.token = Token.objects.get_or_create(user=self.user)[0]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.activity = Activity.objects.create(
            gym=self.gym,
            name="CrossFit",
            description="WOD",
            active=True,
        )
        self.schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(10, 0),
            end_time=time(11, 0),
            capacity=5,
        )

        self.member = Member.objects.create(
            gym=self.gym,
            first_name="María",
            last_name="González",
            phone="555-0002",
            email="maria@example.com",
        )

        end = get_last_day_of_month(now().date())
        self.plan = MembershipPlan.objects.create(
            gym=self.gym,
            name="Mensual",
            price=100,
            duration_days=30,
            weekly_visits=5,
            active=True,
        )
        self.sub = Subscription.objects.create(
            gym=self.gym,
            member=self.member,
            plan=self.plan,
            start_date=now().date(),
            end_date=end,
            paid=True,
            auto_renew=True,
        )

        self.enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.schedule,
            active=True,
        )

        self.unenroll_url = (
            f"/api/activities/schedules/{self.schedule.id}/unenroll/"
        )

    def test_unenroll_success(self):
        response = self.client.post(
            self.unenroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["active"], False)
        self.assertFalse(
            Enrollment.objects.filter(
                gym=self.gym,
                member=self.member,
                schedule=self.schedule,
                active=True,
            ).exists()
        )

    def test_unenroll_requires_member_id(self):
        response = self.client.post(self.unenroll_url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("member_id", response.data.get("detail", ""))

    def test_unenroll_rejects_not_enrolled(self):
        other_member = Member.objects.create(
            gym=self.gym,
            first_name="Pedro",
            last_name="López",
            phone="555-0003",
            email="pedro@example.com",
        )
        response = self.client.post(
            self.unenroll_url,
            {"member_id": other_member.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_unenroll_rejects_member_from_other_gym(self):
        other_gym = Gym.objects.create(
            name="Other",
            slug="test-other-unenroll",
            phone="999",
            email="other@test.com",
        )
        other_member = Member.objects.create(
            gym=other_gym,
            first_name="Otro",
            last_name="Gym",
            phone="555-9998",
            email="other2@test.com",
        )
        response = self.client.post(
            self.unenroll_url,
            {"member_id": other_member.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_unenroll_rejects_when_feature_disabled(self):
        self.gym.features["extra_activities"] = False
        self.gym.save()
        response = self.client.post(
            self.unenroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_unenroll_requires_auth(self):
        self.client.credentials()
        response = self.client.post(
            self.unenroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 401)

    def test_unenroll_rejects_nonexistent_schedule(self):
        url = "/api/activities/schedules/999999/unenroll/"
        response = self.client.post(
            url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_unenroll_rejects_unknown_member_id(self):
        response = self.client.post(
            self.unenroll_url, {"member_id": 999999}, format="json"
        )
        self.assertEqual(response.status_code, 404)

    def test_unenroll_allows_re_enroll(self):
        response = self.client.post(
            self.unenroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["active"], False)

        enroll_url = (
            f"/api/activities/schedules/{self.schedule.id}/enroll/"
        )
        response = self.client.post(
            enroll_url, {"member_id": self.member.id}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["active"], True)


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class EnrollmentViewSetFeatureFlagTest(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-ff-enrollment",
            phone="123",
            email="gym@test.com",
            features={"extra_activities": False},
        )

        self.user = User.objects.create_user(
            username="staff3", password="Pass123!"
        )
        self.user.profile.gym = self.gym
        self.user.profile.save()

        self.token = Token.objects.get_or_create(user=self.user)[0]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

    def test_enrollment_viewset_rejects_when_feature_disabled(self):
        response = self.client.get("/api/activities/enrollments/")
        self.assertEqual(response.status_code, 403)
        self.assertIn(
            "no están habilitadas",
            response.data.get("detail", "").lower(),
        )
