"""Tests de la Fase K5 · ACC-23 (obra social sin verificar).

El texto de obra social que el socio escribe (alta pública) casi nunca
coincidía con el nombre configurado en el gym: el socio quedaba con texto
pero sin vínculo, el coseguro por sesión valía 0 y nadie se enteraba.

Aquí se cubre:

- el flag ``insurance_unverified`` que hace visible el problema;
- el auto-enlace cuando el texto sí coincide (con o sin mayúsculas/acentos);
- el re-enlace automático cuando el gym configura o renombra la obra social;
- el endpoint público con las obras configuradas (para el alta);
- el comando de re-enlace masivo.
"""

import json
from decimal import Decimal
from io import StringIO

from django.core.management import call_command

from core.testing import BaseAPITest
from members.insurance import normalize_insurance_name, relink_members_for_insurance
from members.models import HealthInsurance, Member
from members.serializers import MemberSerializer


class Acc23TestBase(BaseAPITest):
    """Helpers compartidos por los tests de ACC-23."""

    def create_insurance(self, gym, name="IAPOS", active=True, session_price="6000.00"):
        return HealthInsurance.objects.create(
            gym=gym,
            name=name,
            session_price=Decimal(session_price),
            sellado_amount=Decimal("5000.00"),
            active=active,
        )

    def member_payload(self, **overrides):
        payload = {
            "first_name": "Ana",
            "last_name": "Gomez",
            "phone": "112233",
            "document_number": "12345678",
            "date_of_birth": "1990-05-04",
            "services": json.dumps(["gym"]),
            "schedules": json.dumps(
                [{"day": self.slot.day, "hour": "10:00"}]
            ),
            "plan_id": self.plan.id,
        }
        payload.update(overrides)
        return payload


class Acc23NormalizeNameTests(Acc23TestBase):
    """La comparación de nombres ignora mayúsculas, acentos y espacios."""

    def test_normalize_lowercases_and_strips_accents(self):
        self.assertEqual(normalize_insurance_name("IaPoS"), "iapos")
        self.assertEqual(normalize_insurance_name("  Osecu  "), "osecu")
        self.assertEqual(normalize_insurance_name(""), "")

    def test_normalize_collapses_inner_spaces(self):
        self.assertEqual(normalize_insurance_name("Obra   Social"), "obra social")


class Acc23UnverifiedFlagTests(Acc23TestBase):
    """El serializer expone si la obra social quedó sin verificar."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)
        self.plan = self.create_plan(self.gym)
        self.insurance = self.create_insurance(self.gym)

    def test_text_without_configured_insurance_is_unverified(self):
        member = self.create_member(self.gym, phone="111", first_name="Ana")
        member.health_insurance = "Obra Que No Existe"
        member.save()

        data = MemberSerializer(member).data

        self.assertTrue(data["insurance_unverified"])

    def test_linked_member_is_not_unverified(self):
        member = self.create_member(self.gym, phone="112", first_name="Ana")
        member.health_insurance = "IAPOS"
        member.insurance = self.insurance
        member.save()

        data = MemberSerializer(member).data

        self.assertFalse(data["insurance_unverified"])

    def test_member_without_insurance_text_is_not_unverified(self):
        member = self.create_member(self.gym, phone="113", first_name="Ana")

        data = MemberSerializer(member).data

        self.assertFalse(data["insurance_unverified"])

    def test_blank_text_is_not_unverified(self):
        member = self.create_member(self.gym, phone="114", first_name="Ana")
        member.health_insurance = "   "
        member.save()

        data = MemberSerializer(member).data

        self.assertFalse(data["insurance_unverified"])


class Acc23AutoLinkTests(Acc23TestBase):
    """El alta enlaza sola cuando el texto coincide con una obra configurada."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)
        self.plan = self.create_plan(self.gym)
        self.insurance = self.create_insurance(self.gym, name="IAPOS")
        self.client.force_authenticate(user=self.user)

    def test_exact_name_is_linked(self):
        resp = self.client.post(
            "/api/members/",
            self.member_payload(health_insurance="IAPOS"),
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="112233")
        self.assertEqual(member.insurance, self.insurance)

    def test_name_with_different_case_is_linked(self):
        resp = self.client.post(
            "/api/members/",
            self.member_payload(phone="112244", health_insurance="iapos"),
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="112244")
        self.assertEqual(member.insurance, self.insurance)

    def test_unknown_name_is_created_but_not_linked(self):
        """No se bloquea el alta: el socio entra y queda marcado."""
        resp = self.client.post(
            "/api/members/",
            self.member_payload(phone="112255", health_insurance="Obra Desconocida"),
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="112255")
        self.assertIsNone(member.insurance)
        self.assertEqual(member.health_insurance, "Obra Desconocida")
        self.assertTrue(MemberSerializer(member).data["insurance_unverified"])


class Acc23RelinkTests(Acc23TestBase):
    """Cuando el gym configura o renombra la obra social, los socios se enlazan."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)
        self.plan = self.create_plan(self.gym)

    def test_creating_insurance_links_pending_member(self):
        member = self.create_member(self.gym, phone="111", first_name="Ana")
        member.health_insurance = "IAPOS"
        member.save()

        insurance = self.create_insurance(self.gym, name="IAPOS")

        member.refresh_from_db()
        self.assertEqual(member.insurance, insurance)

    def test_renaming_insurance_relinks_member(self):
        member = self.create_member(self.gym, phone="111", first_name="Ana")
        member.health_insurance = "IAPOS"
        member.save()

        insurance = self.create_insurance(self.gym, name="IAPOS")

        member.refresh_from_db()
        self.assertEqual(member.insurance, insurance)

        insurance.name = "IAPOS Renovada"
        insurance.save()

        member.refresh_from_db()
        self.assertEqual(member.insurance, insurance)
        self.assertEqual(member.health_insurance, "IAPOS Renovada")

    def test_renaming_insurance_links_members_with_old_text(self):
        """Un socio con el texto viejo sin enlazar se enlaza al renombrar."""
        insurance = self.create_insurance(self.gym, name="IAPOS")

        member = self.create_member(self.gym, phone="111", first_name="Ana")
        member.health_insurance = "IAPOS"
        member.save()

        self.assertIsNone(member.insurance)

        insurance.name = "IAPOS Renovada"
        insurance.save()

        member.refresh_from_db()
        self.assertEqual(member.insurance, insurance)

    def test_member_with_other_insurance_is_not_relinked(self):
        other = self.create_insurance(self.gym, name="OSECU")
        member = self.create_member(self.gym, phone="111", first_name="Ana")
        member.health_insurance = "OSECU"
        member.insurance = other
        member.save()

        self.create_insurance(self.gym, name="IAPOS")

        member.refresh_from_db()
        self.assertEqual(member.insurance, other)

    def test_relink_members_for_insurance_returns_count(self):
        pending = self.create_member(self.gym, phone="111", first_name="Ana")
        pending.health_insurance = "IAPOS"
        pending.save()
        self.create_member(self.gym, phone="222", first_name="Bob")

        insurance = self.create_insurance(self.gym, name="IAPOS")

        # El signal ya lo enlazó: no queda nada pendiente.
        self.assertEqual(relink_members_for_insurance(insurance), 0)


class Acc23PublicEndpointTests(Acc23TestBase):
    """El alta pública puede listar las obras sociales del gym."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)
        self.plan = self.create_plan(self.gym)
        self.active = self.create_insurance(self.gym, name="IAPOS", active=True)
        self.inactive = self.create_insurance(self.gym, name="OSECU", active=False)

    def test_endpoint_lists_only_active_insurances(self):
        resp = self.client.get(
            f"/api/public/health-insurances/{self.gym.onboarding_code}/"
        )

        self.assertEqual(resp.status_code, 200)
        names = [row["name"] for row in resp.data]
        self.assertEqual(names, ["IAPOS"])
        self.assertEqual(str(resp.data[0]["session_price"]), "6000.00")
        self.assertIn("id", resp.data[0])

    def test_endpoint_works_without_session(self):
        resp = self.client.get(
            f"/api/public/health-insurances/{self.gym.onboarding_code}/"
        )

        self.assertEqual(resp.status_code, 200)

    def test_unknown_gym_code_returns_404(self):
        resp = self.client.get(
            "/api/public/health-insurances/00000000-0000-0000-0000-000000000000/"
        )

        self.assertEqual(resp.status_code, 404)


class Acc23PublicRegisterTests(Acc23TestBase):
    """El alta pública (Register.jsx) también auto-enlaza la obra social."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)
        self.plan = self.create_plan(self.gym)
        self.insurance = self.create_insurance(self.gym, name="IAPOS")

    def _payload(self, **overrides):
        payload = {
            "first_name": "Luz",
            "last_name": "Pérez",
            "phone": "11-public-001",
            "document_number": "12345678",
            "date_of_birth": "1990-05-04",
            "services": ["gym"],
            "schedules": [{"day": self.slot.day, "hour": "10:00"}],
            "plan_id": self.plan.id,
        }
        payload.update(overrides)
        return payload

    def test_public_register_links_matching_insurance(self):
        resp = self.client.post(
            f"/api/public/register/{self.gym.onboarding_code}/",
            self._payload(health_insurance="IAPOS"),
            format="json",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="11-public-001")
        self.assertEqual(member.insurance, self.insurance)

    def test_public_register_keeps_unknown_insurance_unlinked(self):
        resp = self.client.post(
            f"/api/public/register/{self.gym.onboarding_code}/",
            self._payload(health_insurance="Obra Desconocida"),
            format="json",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        member = Member.objects.get(phone="11-public-001")
        self.assertIsNone(member.insurance)
        self.assertTrue(MemberSerializer(member).data["insurance_unverified"])


class Acc23RelinkCommandTests(Acc23TestBase):
    """El comando de re-enlace masivo."""

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)
        self.plan = self.create_plan(self.gym)

    def test_command_links_pending_members(self):
        insurance = self.create_insurance(self.gym, name="IAPOS")

        member = self.create_member(self.gym, phone="111", first_name="Ana")
        member.health_insurance = "IAPOS"
        member.save()

        self.assertIsNone(member.insurance)

        out = StringIO()
        call_command("relink_insurances", "--gym", str(self.gym.id), stdout=out)

        member.refresh_from_db()
        self.assertEqual(member.insurance, insurance)
        self.assertIn("1 socio(s) enlazados", out.getvalue())

    def test_command_requires_gym_or_all(self):
        from django.core.management.base import CommandError

        with self.assertRaises(CommandError):
            call_command("relink_insurances")
