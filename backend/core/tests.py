"""Fase J — REF-01: cobertura base del módulo ``core``.

Cubre las piezas compartidas que hasta ahora no tenían test propio:
``BillingPriceMixin`` (reglas de precio por modalidad), ``GymQuerysetMixin``
(gimnasio obligatorio del usuario) y los helpers de permiso por rol.
"""

from decimal import Decimal

from django.core.exceptions import PermissionDenied
from django.http import QueryDict
from django.test import RequestFactory, TestCase
from rest_framework import serializers

from core.mixins import BillingPriceMixin, GymQuerysetMixin
from core.permissions import (
    ROUTINE_MANAGER_ROLES,
    is_owner,
    is_routine_manager,
    require_owner,
    require_routine_manager,
)
from core.testing import BaseAPITest
from activities.models import Activity
from profiles.models import UserProfile


class _StubBillingSerializer(BillingPriceMixin, serializers.Serializer):
    """Serializer mínimo para ejercitar la regla de precio.

    Usa ``Activity`` como ``Meta.model`` sólo para que la regla lea los
    defaults reales de ``billing_mode``/``monthly_price``; no persiste nada.
    """

    class Meta:
        model = Activity
        fields = ["billing_mode", "monthly_price"]


class BillingPriceRulesTests(TestCase):
    def setUp(self):
        self.serializer = _StubBillingSerializer()

    def test_sessions_forces_monthly_price_to_zero(self):
        attrs = self.serializer.apply_billing_price_rules(
            {"billing_mode": "sessions", "monthly_price": Decimal("5000")}
        )
        self.assertEqual(attrs["monthly_price"], Decimal("0"))

    def test_monthly_requires_positive_price(self):
        with self.assertRaises(serializers.ValidationError):
            self.serializer.apply_billing_price_rules(
                {"billing_mode": "monthly", "monthly_price": Decimal("0")}
            )

    def test_monthly_keeps_positive_price(self):
        attrs = self.serializer.apply_billing_price_rules(
            {"billing_mode": "monthly", "monthly_price": Decimal("2500")}
        )
        self.assertEqual(attrs["monthly_price"], Decimal("2500"))


class GymQuerysetMixinTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()
        self.mixin = GymQuerysetMixin()

    def _with_user(self, user):
        request = self.factory.get("/")
        request.user = user
        self.mixin.request = request
        return self.mixin

    def test_get_gym_raises_without_gym(self):
        from django.contrib.auth.models import User

        user = User.objects.create_user(username="singym", password="x")
        mixin = self._with_user(user)

        with self.assertRaises(PermissionDenied):
            mixin.get_gym()

    def test_get_gym_returns_user_gym(self):
        gym = self.create_gym(name="Con Gym")
        user = self.create_user(gym, username="congym")
        mixin = self._with_user(user)

        self.assertEqual(mixin.get_gym(), gym)


class RolePermissionTests(BaseAPITest):
    def test_owner_and_routine_manager_roles(self):
        gym = self.create_gym()
        owner = self.create_user(gym, username="owner-x")
        staff = self.create_user(gym, username="staff-x", role=UserProfile.ROLE_STAFF)
        trainer = self.create_user(
            gym, username="trainer-x", role=UserProfile.ROLE_TRAINER
        )

        def req(user):
            r = RequestFactory().get("/")
            r.user = user
            return r

        self.assertTrue(is_owner(req(owner)))
        self.assertFalse(is_owner(req(staff)))

        self.assertTrue(is_routine_manager(req(staff)))
        self.assertFalse(is_routine_manager(req(trainer)))
        self.assertEqual(
            ROUTINE_MANAGER_ROLES,
            {
                UserProfile.ROLE_OWNER,
                UserProfile.ROLE_STAFF,
                UserProfile.ROLE_PROFESSOR,
            },
        )

        require_owner(req(owner))  # no lanza
        with self.assertRaises(PermissionDenied):
            require_owner(req(staff))

        require_routine_manager(req(owner))  # no lanza
        with self.assertRaises(PermissionDenied):
            require_routine_manager(req(trainer))
