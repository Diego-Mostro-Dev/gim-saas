from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.authtoken.models import Token

from gyms.models import Gym
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