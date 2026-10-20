from django.test import override_settings

from core.testing import BaseAPITest

from community.models import CommunityBusiness


def community_gym(testcase, name="Gym"):
    gym = testcase.create_gym(name)
    gym.features = {**gym.features, "community": True}
    gym.save(update_fields=["features"])
    return gym


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class CommunityBusinessDiscountTests(BaseAPITest):
    """COM-02: ``discount`` es el beneficio que el socio muestra en el local.

    Es texto libre (no participa de ningún cobro), pero un beneficio vacío o
    en blanco deja al local adherido sin nada que ofrecer: se rechaza con un
    mensaje de dominio en lugar del error genérico en inglés.
    """

    URL = "/api/community/businesses/"

    def setUp(self):
        self.gym = community_gym(self)
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


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class CommunitySoftDeleteTests(BaseAPITest):
    """COM-04: dar de baja un local es baja lógica, no borrado."""

    URL = "/api/community/businesses/"

    def setUp(self):
        self.gym = community_gym(self)
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.business = CommunityBusiness.objects.create(
            gym=self.gym, name="Café Central", discount="10% en café"
        )

    def test_delete_keeps_row_but_deactivates(self):
        resp = self.client.delete(
            f"{self.URL}{self.business.id}/", HTTP_ACCEPT="application/json"
        )

        self.assertEqual(resp.status_code, 204, resp.data)
        self.business.refresh_from_db()
        self.assertFalse(self.business.active)

    def test_deactivated_business_left_out_of_list(self):
        self.business.delete()

        resp = self.client.get(self.URL)

        self.assertEqual(resp.status_code, 200, resp.data)
        names = [b["name"] for b in resp.data]
        self.assertNotIn("Café Central", names)

    def test_deactivated_business_detail_is_404(self):
        self.business.delete()

        resp = self.client.patch(
            f"{self.URL}{self.business.id}/",
            {"name": "Otro"},
            format="json",
        )

        self.assertEqual(resp.status_code, 404, resp.data)


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class CommunityNameUniquenessTests(BaseAPITest):
    """COM-03: el nombre del local es único por gimnasio (entre activos)."""

    URL = "/api/community/businesses/"

    def setUp(self):
        self.gym = community_gym(self)
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

    def test_duplicate_name_same_gym_rejected(self):
        CommunityBusiness.objects.create(
            gym=self.gym, name="Café Central", discount="10% en café"
        )

        resp = self.client.post(
            self.URL,
            {"name": "Café Central", "discount": "2x1"},
            format="json",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("name", resp.data)

    def test_same_name_other_gym_allowed(self):
        other_gym = community_gym(self, "Otro Gym")
        CommunityBusiness.objects.create(
            gym=other_gym, name="Café Central", discount="10% en café"
        )

        resp = self.client.post(
            self.URL,
            {"name": "Café Central", "discount": "2x1"},
            format="json",
        )

        self.assertEqual(resp.status_code, 201, resp.data)

    def test_name_reusable_after_deactivation(self):
        business = CommunityBusiness.objects.create(
            gym=self.gym, name="Café Central", discount="10% en café"
        )
        business.delete()

        resp = self.client.post(
            self.URL,
            {"name": "Café Central", "discount": "2x1"},
            format="json",
        )

        self.assertEqual(resp.status_code, 201, resp.data)


@override_settings(SCHEDULED_TASKS_ENABLED=False)
class CommunityRoleGuardTests(BaseAPITest):
    """Sólo el dueño gestiona locales adheridos."""

    URL = "/api/community/businesses/"

    def setUp(self):
        self.gym = community_gym(self)
        self.staff = self.create_user(self.gym, role="staff")
        self.business = CommunityBusiness.objects.create(
            gym=self.gym, name="Café Central", discount="10% en café"
        )
        self.client.force_authenticate(user=self.staff)

    def test_staff_cannot_create(self):
        resp = self.client.post(
            self.URL,
            {"name": "Otro", "discount": "2x1"},
            format="json",
        )

        self.assertEqual(resp.status_code, 403, resp.data)

    def test_staff_cannot_patch(self):
        resp = self.client.patch(
            f"{self.URL}{self.business.id}/",
            {"name": "Otro"},
            format="json",
        )

        self.assertEqual(resp.status_code, 403, resp.data)

    def test_staff_cannot_delete(self):
        resp = self.client.delete(
            f"{self.URL}{self.business.id}/", HTTP_ACCEPT="application/json"
        )

        self.assertEqual(resp.status_code, 403, resp.data)


class PublicCommunityVisibilityTests(BaseAPITest):
    """Tarjeta pública del socio: sólo locales activos; inactivo ve su tarjeta.

    COM-01 (decisión de negocio): el portal no bloquea a socios inactivos, así
    que su tarjeta de comunidad sigue funcionando; sólo se ocultan los locales
    dados de baja.
    """

    def setUp(self):
        self.gym = community_gym(self)
        self.member = self.create_member(self.gym)
        self.active_business = CommunityBusiness.objects.create(
            gym=self.gym, name="Café Central", discount="10% en café"
        )
        self.dead_business = CommunityBusiness.objects.create(
            gym=self.gym, name="Local Cerrado", discount="2x1"
        )
        self.dead_business.delete()

    def _url(self):
        return f"/api/community/public/{self.member.access_token}/"

    def test_public_card_hides_inactive_business(self):
        resp = self.client.get(self._url())

        self.assertEqual(resp.status_code, 200, resp.data)
        names = [b["name"] for b in resp.data["businesses"]]
        self.assertIn("Café Central", names)
        self.assertNotIn("Local Cerrado", names)

    def test_inactive_member_still_sees_card(self):
        self.member.active = False
        self.member.save(update_fields=["active"])

        resp = self.client.get(self._url())

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["member"]["first_name"], self.member.first_name)

