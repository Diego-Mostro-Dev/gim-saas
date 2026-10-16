"""Tests focalizados de bugs de dinero (Fase 7 de PLAN-dinero.md, #2).

Por ahora cubren la invariante de la oferta de PT: una oferta por sesiones
no puede tener cuota mensual, porque sus dos modalidades se cobran por
caminos distintos y juntas hacen que el socio pague el paquete y además la
cuota todos los meses.
"""

from decimal import Decimal

from core.testing import BaseAPITest
from gyms.features import FEATURE_PERSONAL_TRAINING

from .models import PersonalTrainingService


class PTServicePriceInvariantTests(BaseAPITest):
    """Una oferta por sesiones se crea y se edita con monthly_price = 0."""

    URL = "/api/personal-training/services/"

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.features = {FEATURE_PERSONAL_TRAINING: True}
        self.gym.save(update_fields=["features"])
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

    def _create(self, name, billing_mode, monthly_price):
        resp = self.client.post(
            self.URL,
            {
                "name": name,
                "billing_mode": billing_mode,
                "monthly_price": monthly_price,
            },
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        return PersonalTrainingService.objects.get(gym=self.gym, name=name)

    def test_sessions_offer_forces_monthly_price_to_zero(self):
        service = self._create("PT por sesiones", "sessions", "22000")

        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_sessions_offer_without_price_stays_zero(self):
        service = self._create("PT sin precio", "sessions", "0")

        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_monthly_offer_keeps_its_price(self):
        service = self._create("PT mensual", "monthly", "22000")

        self.assertEqual(service.monthly_price, Decimal("22000.00"))

    def test_switching_to_sessions_zeroes_existing_price(self):
        service = self._create("PT mensual", "monthly", "22000")

        resp = self.client.patch(
            f"{self.URL}{service.id}/",
            {"billing_mode": "sessions"},
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        service.refresh_from_db()
        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_editing_price_of_sessions_offer_cannot_reintroduce_it(self):
        service = self._create("PT por sesiones", "sessions", "22000")

        resp = self.client.patch(
            f"{self.URL}{service.id}/",
            {"monthly_price": "22000"},
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        service.refresh_from_db()
        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_editing_price_of_monthly_offer_keeps_working(self):
        service = self._create("PT mensual", "monthly", "22000")

        resp = self.client.patch(
            f"{self.URL}{service.id}/",
            {"monthly_price": "25000"},
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        service.refresh_from_db()
        self.assertEqual(service.monthly_price, Decimal("25000.00"))
