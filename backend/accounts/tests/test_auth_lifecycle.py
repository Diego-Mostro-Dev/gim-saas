from django.test import TestCase, override_settings
from django.contrib.auth.models import User

from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from gyms.models import Gym


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
class TokenLifecycleTest(TestCase):
    """Token rotation and invalidation on login, logout, password change."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Lifecycle Gym", slug="lifecycle-gym", phone="123", email="l@g.com"
        )
        self.user = User.objects.create_user(username="lifeuser", password="Pass123!")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.login_url = "/api/auth/login/"
        self.me_url = "/api/auth/me/"
        self.logout_url = "/api/auth/logout/"
        self.change_pw_url = "/api/auth/change-password/"

    def test_logout_invalidates_token(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, 200)

        resp = self.client.post(self.logout_url)
        self.assertEqual(resp.status_code, 200)

        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, 401)

        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_login_rotates_tokens(self):
        resp = self.client.post(self.login_url,
                                {"username": "lifeuser", "password": "Pass123!"},
                                format="json")
        self.assertEqual(resp.status_code, 200)
        token_a = resp.data["token"]

        resp = self.client.post(self.login_url,
                                {"username": "lifeuser", "password": "Pass123!"},
                                format="json")
        self.assertEqual(resp.status_code, 200)
        token_b = resp.data["token"]

        self.assertNotEqual(token_a, token_b)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token_a}")
        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, 401)

    def test_password_change_rotates_token(self):
        resp = self.client.post(self.login_url,
                                {"username": "lifeuser", "password": "Pass123!"},
                                format="json")
        self.assertEqual(resp.status_code, 200)
        old_token = resp.data["token"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {old_token}")
        resp = self.client.post(self.change_pw_url, {
            "old_password": "Pass123!",
            "new_password": "NewPass456!",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        new_token = resp.data.get("token")
        self.assertIsNotNone(new_token)
        self.assertNotEqual(old_token, new_token)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {old_token}")
        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {new_token}")
        resp = self.client.get(self.me_url)
        self.assertEqual(resp.status_code, 200)
