"""Fase J — REF-01: cobertura base de la app ``seed``.

``BaseSeeder`` puebla un gimnasio con datos de demo. El riesgo real es el
aislamiento: no debe tocar ni contar datos de otro gimnasio, y ``needs_seeding``
es la guarda que evita re-sembrar sin querer.
"""

from datetime import date

from django.test import TestCase

from core.testing import BaseAPITest
from members.models import Member
from plans.models import MembershipPlan
from seed.base import BaseSeeder


class SeederHelperTests(TestCase):
    def _seeder(self, ref_date):
        from gyms.models import Gym
        from plans.models import Service

        gym = Gym.objects.create(name="Seed Gym", slug="seed-gym")
        Service.get_default_for_gym(gym)
        return BaseSeeder(gym=gym, ref_date=ref_date)

    def test_previous_month_range_is_full_month(self):
        seeder = self._seeder(date(2026, 3, 20))
        first, last = seeder._get_previous_month_range()
        self.assertEqual(first, date(2026, 2, 1))
        self.assertEqual(last, date(2026, 2, 28))

    def test_two_months_ago_range_is_full_month(self):
        seeder = self._seeder(date(2026, 3, 20))
        first, last = seeder._get_two_months_ago_range()
        self.assertEqual(first, date(2026, 1, 1))
        self.assertEqual(last, date(2026, 1, 31))

    def test_phone_is_namespaced_by_gym(self):
        seeder = self._seeder(date(2026, 3, 20))
        self.assertTrue(seeder._generate_phone(3).startswith(f"555-{seeder.gym.id:04d}"))


class NeedsSeedingTests(BaseAPITest):
    def test_needs_seeding_when_empty(self):
        gym = self.create_gym(name="Vacio")
        seeder = BaseSeeder(gym=gym, ref_date=date(2026, 3, 20))

        self.assertTrue(seeder.needs_seeding())

    def test_does_not_need_seeding_with_members(self):
        gym = self.create_gym(name="Con Socios")
        self.create_member(gym)
        seeder = BaseSeeder(gym=gym, ref_date=date(2026, 3, 20))

        self.assertFalse(seeder.needs_seeding())

    def test_force_overrides_existing_members(self):
        gym = self.create_gym(name="Forzado")
        self.create_member(gym)
        seeder = BaseSeeder(gym=gym, ref_date=date(2026, 3, 20), force=True)

        self.assertTrue(seeder.needs_seeding())

    def test_needs_seeding_ignores_other_gyms(self):
        gym = self.create_gym(name="Solo")
        other = self.create_gym(name="Otro")
        self.create_member(other)
        seeder = BaseSeeder(gym=gym, ref_date=date(2026, 3, 20))

        self.assertTrue(seeder.needs_seeding())


class SeedPhase1IsolationTests(BaseAPITest):
    def test_seed_phase1_populates_only_target_gym(self):
        gym = self.create_gym(name="Target")
        other = self.create_gym(name="Ajeno")
        BaseSeeder(gym=other, ref_date=date(2026, 3, 20)).seed_phase1()
        other_members = Member.objects.filter(gym=other).count()

        BaseSeeder(gym=gym, ref_date=date(2026, 3, 20)).seed_phase1()

        self.assertTrue(Member.objects.filter(gym=gym).exists())
        self.assertTrue(MembershipPlan.objects.filter(gym=gym).exists())
        # El gimnasio ajeno no se toca.
        self.assertEqual(Member.objects.filter(gym=other).count(), other_members)
