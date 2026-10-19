from core.testing import BaseAPITest

from community.models import CommunityBusiness


class CommunityBusinessDiscountTests(BaseAPITest):
    """COM-02: ``discount`` es el beneficio que el socio muestra en el local.

    Es texto libre (no participa de ningún cobro), pero un beneficio vacío o
    en blanco deja al local adherido sin nada que ofrecer: se rechaza con un
    mensaje de dominio en lugar del error genérico en inglés.
    """

    URL = "/api/community/businesses/"

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "community": True}
        self.gym.save(update_fields=["features"])
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

    def _post(self, payload):
        return self.client.post(self.URL, payload, format="json")

    def test_valid_business_created(self):
        resp = self._post({"name": "Café Central", "discount": "10% en café"})

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(
            CommunityBusiness.objects.get(name="Café Central").discount,
            "10% en café",
        )

    def test_blank_discount_rejected(self):
        resp = self._post({"name": "Café Central", "discount": ""})

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("discount", resp.data)
        self.assertFalse(
            CommunityBusiness.objects.filter(name="Café Central").exists()
        )

    def test_whitespace_only_discount_rejected(self):
        resp = self._post({"name": "Café Central", "discount": "   "})

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("discount", resp.data)

    def test_missing_discount_rejected(self):
        resp = self._post({"name": "Café Central"})

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("discount", resp.data)
