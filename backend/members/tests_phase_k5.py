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
from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command

from core.testing import BaseAPITest
from members.insurance import normalize_insurance_name, relink_members_for_insurance
from members.models import HealthInsurance, Member
from members.phone_cleanup import (
    PHONE_MAX_LENGTH,
    apply_phone_dedupe,
    build_unique_phone,
    plan_phone_dedupe,
)
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


# ─────────────────────────────────────────────────────────────────────────────
# ACC-19 · el teléfono es único por gym
# ─────────────────────────────────────────────────────────────────────────────


def _phone_constraint():
    return next(
        c
        for c in Member._meta.constraints
        if c.name == "unique_member_phone_per_gym"
    )


class _PhoneConstraintRemoved:
    """Quita el índice único mientras dura el test.

    La limpieza de duplicados existe justamente para datos que no pueden
    convivir con el constraint, así que para probarla hay que sacarlo un
    momento. La transacción del TestCase lo devuelve a su lugar al final.
    """

    def __enter__(self):
        from django.db import connection

        self._connection = connection
        with connection.schema_editor() as editor:
            editor.remove_constraint(Member, _phone_constraint())
        return self

    def __exit__(self, *exc_info):
        try:
            with self._connection.schema_editor() as editor:
                editor.add_constraint(Member, _phone_constraint())
        except Exception:
            pass
        return False


class Acc19PhoneConstraintTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)

    def test_same_phone_in_same_gym_is_rejected(self):
        from django.db import IntegrityError, transaction

        self.create_member(self.gym, phone="11-1111")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.create_member(self.gym, phone="11-1111")

    def test_same_phone_in_other_gym_is_allowed(self):
        other_gym = self.create_gym(name="Otro Gym")

        self.create_member(self.gym, phone="11-1111")
        self.create_member(other_gym, phone="11-1111")

        self.assertEqual(Member.objects.filter(phone="11-1111").count(), 2)

    def test_empty_phone_is_excluded_from_the_constraint(self):
        self.create_member(self.gym, phone="")
        self.create_member(self.gym, phone="")

        self.assertEqual(Member.objects.filter(gym=self.gym, phone="").count(), 2)

    def test_api_rejects_duplicate_phone_with_clear_message(self):
        slot = self.create_today_slot(self.gym)
        self.create_plan(self.gym)
        self.create_member(self.gym, phone="11-1111")
        self.client.force_authenticate(user=self.user)

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Ana",
                "last_name": "Gomez",
                "phone": "11-1111",
                "document_number": "12345678",
                "services": json.dumps(["gym"]),
                "schedules": json.dumps(
                    [{"day": slot.day, "hour": "10:00"}]
                ),
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("en este gimnasio", str(resp.data))

    def test_api_rejects_duplicate_phone_on_update(self):
        self.create_member(self.gym, phone="11-1111")
        other = self.create_member(self.gym, phone="11-2222", first_name="Beto")
        self.client.force_authenticate(user=self.user)

        resp = self.client.patch(
            f"/api/members/{other.pk}/",
            {"phone": "11-1111"},
            format="json",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("en este gimnasio", str(resp.data))
        other.refresh_from_db()
        self.assertEqual(other.phone, "11-2222")

    def test_public_register_rejects_duplicate_phone(self):
        slot = self.create_today_slot(self.gym)
        plan = self.create_plan(self.gym)
        self.create_member(self.gym, phone="11-1111")

        resp = self.client.post(
            f"/api/public/register/{self.gym.onboarding_code}/",
            {
                "first_name": "Luz",
                "last_name": "Perez",
                "phone": "11-1111",
                "document_number": "87654321",
                "date_of_birth": "1990-05-04",
                "services": ["gym"],
                "schedules": [{"day": slot.day, "hour": "10:00"}],
                "plan_id": plan.id,
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("en este gimnasio", str(resp.data))
        self.assertEqual(Member.objects.filter(gym=self.gym).count(), 1)


class Acc19PhoneCleanupTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.other_gym = self.create_gym(name="Otro Gym")

    def _duplicate_members(self, phone="000-0000", count=3):
        from django.utils import timezone

        members = []
        for index in range(count):
            member = self.create_member(
                self.gym,
                first_name=f"Socio {index}",
                phone=phone,
            )
            # created_at lo pone auto_now_add: para que el "más antiguo"
            # sea determinista se fuerza el orden.
            Member.objects.filter(pk=member.pk).update(
                created_at=timezone.now() + timedelta(minutes=index)
            )
            members.append(member)
        return members

    def test_no_duplicates_means_no_changes(self):
        self.create_member(self.gym, phone="11-1111")
        self.create_member(self.gym, phone="11-2222")

        self.assertEqual(plan_phone_dedupe(), [])

    def test_plan_keeps_the_oldest_and_suffixes_the_rest(self):
        with _PhoneConstraintRemoved():
            members = self._duplicate_members()
            changes = plan_phone_dedupe(self.gym)

            self.assertEqual(len(changes), 2)
            self.assertEqual(changes[0]["keeper_id"], members[0].id)
            self.assertEqual(
                {c["member_id"] for c in changes},
                {members[1].id, members[2].id},
            )
            for change in changes:
                self.assertEqual(
                    change["new_phone"], f"000-0000-{change['member_id']}"
                )

    def test_apply_leaves_every_phone_unique(self):
        with _PhoneConstraintRemoved():
            members = self._duplicate_members()
            apply_phone_dedupe(self.gym)

            phones = list(
                Member.objects.filter(gym=self.gym).values_list("phone", flat=True)
            )
            self.assertEqual(len(phones), len(set(phones)))
            self.assertEqual(
                Member.objects.get(pk=members[0].id).phone, "000-0000"
            )

    def test_plan_does_not_touch_other_gyms(self):
        with _PhoneConstraintRemoved():
            self._duplicate_members()
            self.create_member(
                self.other_gym, phone="000-0000", first_name="Otro"
            )
            changes = plan_phone_dedupe(self.gym)

            self.assertTrue(all(c["gym_id"] == self.gym.id for c in changes))
            self.assertEqual(
                Member.objects.filter(
                    gym=self.other_gym, phone="000-0000"
                ).count(),
                1,
            )

    def test_command_dry_run_does_not_change_data(self):
        with _PhoneConstraintRemoved():
            members = self._duplicate_members()
            out = StringIO()
            call_command(
                "cleanup_duplicate_phones",
                "--gym",
                str(self.gym.id),
                stdout=out,
            )

            self.assertIn("Pendientes", out.getvalue())
            self.assertEqual(
                Member.objects.filter(gym=self.gym, phone="000-0000").count(), 3
            )
            self.assertEqual(len(members), 3)

    def test_command_apply_changes_data(self):
        with _PhoneConstraintRemoved():
            self._duplicate_members()
            out = StringIO()
            call_command(
                "cleanup_duplicate_phones",
                "--gym",
                str(self.gym.id),
                "--apply",
                stdout=out,
            )

            self.assertIn("Aplicados", out.getvalue())
            self.assertEqual(
                Member.objects.filter(gym=self.gym, phone="000-0000").count(), 1
            )


class Acc19BuildUniquePhoneTests(Acc23TestBase):
    """El sufijo respeta el max_length del campo y no pisa teléfonos usados."""

    def test_build_unique_phone_appends_id(self):
        self.assertEqual(
            build_unique_phone("000-0000", 884, set()), "000-0000-884"
        )

    def test_build_unique_phone_respects_max_length(self):
        long_phone = "1" * 30
        phone = build_unique_phone(long_phone, 12345, set())
        self.assertLessEqual(len(phone), PHONE_MAX_LENGTH)
        self.assertTrue(phone.endswith("-12345"))

    def test_build_unique_phone_avoids_taken_numbers(self):
        taken = {"000-0000-884"}
        self.assertEqual(
            build_unique_phone("000-0000", 884, taken), "000-0000-884-1"
        )
