from rest_framework.authtoken.models import Token

from core.testing import BaseAPITest


class LoginTests(BaseAPITest):

    def test_login_returns_token_and_username(self):
        gym = self.create_gym()
        self.create_user(gym)

        resp = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "pass12345"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["token"])
        self.assertEqual(resp.data["username"], "owner")

    def test_login_wrong_password_rejected(self):
        gym = self.create_gym()
        self.create_user(gym)

        resp = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "incorrecta"},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)

    def test_me_returns_gym_and_role(self):
        from profiles.models import UserProfile

        gym = self.create_gym()
        self.create_user(gym)

        resp = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "pass12345"},
            format="json",
        )
        token = resp.data["token"]

        me = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Token {token}",
        )

        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["gym"], gym.name)
        self.assertEqual(me.data["gym_id"], gym.id)
        self.assertEqual(me.data["role"], UserProfile.ROLE_OWNER)

    def test_change_password_rotates_token(self):
        gym = self.create_gym()
        self.create_user(gym)

        resp = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "pass12345"},
            format="json",
        )
        old_token = resp.data["token"]

        changed = self.client.post(
            "/api/auth/change-password/",
            {
                "old_password": "pass12345",
                "new_password": "NuevaPass!2026",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Token {old_token}",
        )

        self.assertEqual(changed.status_code, 200)
        self.assertTrue(changed.data["token"])
        self.assertNotEqual(changed.data["token"], old_token)

        # Old token is now invalid.
        old_still_works = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Token {old_token}",
        )
        self.assertEqual(old_still_works.status_code, 401)

        # New token works and must_change_password is cleared.
        me = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Token {changed.data['token']}",
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["must_change_password"], False)

    def test_me_requires_auth(self):
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 401)

    def test_logout_deletes_token(self):
        gym = self.create_gym()
        self.create_user(gym)

        resp = self.client.post(
            "/api/auth/login/",
            {"username": "owner", "password": "pass12345"},
            format="json",
        )
        token = resp.data["token"]

        out = self.client.post(
            "/api/auth/logout/",
            HTTP_AUTHORIZATION=f"Token {token}",
        )
        self.assertEqual(out.status_code, 200)

        self.assertFalse(Token.objects.filter(key=token).exists())


class OnboardingTests(BaseAPITest):

    def test_onboarding_create_owner_links_gym_and_returns_token(self):
        from profiles.models import UserProfile

        gym = self.create_gym()

        resp = self.client.post(
            "/api/auth/onboarding/create-owner/",
            {
                "gym_code": str(gym.onboarding_code),
                "username": "nuevo_owner",
                "email": "owner@test.com",
                "password": "pass12345",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["token"])
        self.assertEqual(resp.data["gym"], gym.name)

        profile = UserProfile.objects.get(user__username="nuevo_owner")
        self.assertEqual(profile.gym, gym)
        self.assertEqual(profile.role, UserProfile.ROLE_OWNER)

    def test_onboarding_rejects_second_owner(self):
        gym = self.create_gym()
        self.create_user(gym)  # first owner exists

        resp = self.client.post(
            "/api/auth/onboarding/create-owner/",
            {
                "gym_code": str(gym.onboarding_code),
                "username": "intruso",
                "email": "x@test.com",
                "password": "pass12345",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 409)

    def test_onboarding_invalid_code(self):
        resp = self.client.post(
            "/api/auth/onboarding/create-owner/",
            {
                "gym_code": "no-existe",
                "username": "alguien",
                "email": "x@test.com",
                "password": "pass12345",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)