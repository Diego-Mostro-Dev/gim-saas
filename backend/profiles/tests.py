"""Fase J — REF-01: cobertura base de la app ``profiles``.

La señal ``post_save`` de ``User`` crea el ``UserProfile`` y el rol por
defecto; sin perfil, ``GymQuerysetMixin.get_gym`` no tiene a qué gym apuntar.
"""

from django.contrib.auth.models import User
from django.test import TestCase

from profiles.models import UserProfile


class UserProfileSignalTests(TestCase):
    def test_profile_created_with_user(self):
        user = User.objects.create_user(username="nuevo", password="pass12345")

        profile = UserProfile.objects.get(user=user)
        self.assertIsNone(profile.gym)
        self.assertEqual(profile.role, UserProfile.ROLE_STAFF)
        self.assertTrue(profile.must_change_password)

    def test_profile_not_recreated_on_user_update(self):
        user = User.objects.create_user(username="viejo", password="pass12345")
        first_id = user.profile.id

        user.first_name = "Cambiado"
        user.save()

        self.assertEqual(UserProfile.objects.filter(user=user).count(), 1)
        self.assertEqual(user.profile.id, first_id)

    def test_role_helpers_are_distinct(self):
        roles = {
            UserProfile.ROLE_OWNER,
            UserProfile.ROLE_STAFF,
            UserProfile.ROLE_PROFESSOR,
            UserProfile.ROLE_TRAINER,
        }
        self.assertEqual(len(roles), len(UserProfile.ROLE_CHOICES))
