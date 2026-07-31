from datetime import date, time
from unittest.mock import patch

from django.test import TestCase

from gyms.models import Gym
from members.models import Member
from plans.models import MembershipPlan, Service
from subscriptions.models import PlanChangeRequest, PlannedSchedule, Subscription
from attendance.models import AttendanceSchedule, ScheduleSlot
from subscriptions.services import (
    get_first_day_of_next_month,
    get_last_day_of_month,
)


def _to_time(hour_str):
    return time(*map(int, hour_str.split(":")))


def _create_slot(gym, day, hour_str):
    return ScheduleSlot.objects.create(
        gym=gym, day=day, hour=_to_time(hour_str),
    )


class P04PlanChangeFlowTest(TestCase):
    def setUp(self):
        self.gym = Gym.objects.create(
            name="P04 Gym", slug="p04-gym", phone="123", email="p04@gym.com",
        )
        self.plan_old = MembershipPlan.objects.create(
            service=Service.get_default_for_gym(self.gym),
            gym=self.gym, name="Old", price=10, duration_days=30,
            weekly_visits=2, active=True,
        )
        self.plan_new = MembershipPlan.objects.create(
            service=Service.get_default_for_gym(self.gym),
            gym=self.gym, name="New", price=20, duration_days=30,
            weekly_visits=2, active=True,
        )
        self.member = Member.objects.create(
            gym=self.gym, first_name="P04", last_name="User", phone="001",
        )

        today = date.today()
        self.month_start = date(today.year, today.month, 1)
        self.month_end = get_last_day_of_month(self.month_start)
        self.effective = get_first_day_of_next_month(self.month_start)

        self.current_sub = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_old,
            start_date=self.month_start, end_date=self.month_end,
            paid=True, auto_renew=True,
        )

        for day, hour in (("monday", "10:00"), ("tuesday", "10:00")):
            slot = _create_slot(self.gym, day, hour)
            AttendanceSchedule.objects.create(
                gym=self.gym, member=self.member, slot=slot, active=True,
            )
        self.wednesday_slot = _create_slot(self.gym, "wednesday", "10:00")

        self.monday_slot = ScheduleSlot.objects.get(
            gym=self.gym, day="monday", hour=_to_time("10:00"),
        )

    def _target(self):
        return [
            {"day": "monday", "hour": "10:00"},
            {"day": "wednesday", "hour": "10:00"},
        ]

    def _create_approved_pcr(self, effective=None, target=None):
        pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            requested_plan=self.plan_new,
            status="approved",
            effective_date=effective or self.effective,
            current_schedules_snapshot=[
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
            target_schedules_snapshot=target or self._target(),
        )
        for s in (target or self._target()):
            slot = ScheduleSlot.objects.get(
                gym=self.gym, day=s["day"], hour=_to_time(s["hour"]),
            )
            PlannedSchedule.objects.create(
                gym=self.gym, member=self.member, plan_change=pcr,
                slot=slot, slot_name=str(slot), day=s["day"], hour=s["hour"],
            )
        return pcr

    def _run_auto_renew(self, today):
        with patch("subscriptions.services.timezone.localdate", return_value=today):
            from io import StringIO
            from django.core.management import call_command
            out = StringIO()
            call_command("auto_renew_subscriptions", stdout=out)
            return out.getvalue()

    def _run_apply_plan_changes(self, today):
        with patch(
            "subscriptions.management.commands.apply_plan_changes.now"
        ) as mock_now, patch(
            "subscriptions.services.timezone.localdate", return_value=today
        ):
            mock_now.return_value.date.return_value = today
            from io import StringIO
            from django.core.management import call_command
            out = StringIO()
            call_command("apply_plan_changes", stdout=out)
            return out.getvalue()

    def _active_days(self):
        return set(
            AttendanceSchedule.objects.filter(
                member=self.member, active=True,
            ).values_list("slot__day", flat=True)
        )

    # 1) Renovación completa el workflow (PCR executed, horarios, planned)
    def test_renewal_completes_workflow(self):
        pcr = self._create_approved_pcr()

        self._run_auto_renew(self.effective)

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")

        new_sub = Subscription.objects.filter(
            member=self.member, start_date=self.effective,
        ).first()
        self.assertIsNotNone(new_sub)
        self.assertEqual(new_sub.plan, self.plan_new)
        self.assertFalse(new_sub.paid)
        self.assertEqual(new_sub.origin, "auto_renewal")
        self.assertEqual(pcr.subscription_id, new_sub.id)

        self.current_sub.refresh_from_db()
        self.assertEqual(self.current_sub.plan, self.plan_old)

        self.assertTrue(
            all(ps.activated for ps in PlannedSchedule.objects.filter(plan_change=pcr))
        )
        self.assertEqual(self._active_days(), {"monday", "wednesday"})

        hanging = PlanChangeRequest.objects.filter(
            status="approved", effective_date__lte=self.effective,
        )
        self.assertFalse(hanging.exists())

    # 2) Ejecutar nuevamente no vuelve a aplicar el mismo cambio
    def test_running_twice_does_not_reapply(self):
        pcr = self._create_approved_pcr()
        self._run_auto_renew(self.effective)
        output = self._run_apply_plan_changes(self.effective)

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")
        self.assertIn("Applied 0", output)
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 2,
        )
        self.assertEqual(self._active_days(), {"monday", "wednesday"})

    # 3) Comando ejecuta cuando la renovación no corrió (orden inverso)
    def test_command_executes_without_renewal(self):
        pcr = self._create_approved_pcr()

        self._run_apply_plan_changes(self.effective)

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")

        new_sub = Subscription.objects.filter(
            member=self.member, start_date=self.effective,
        ).first()
        self.assertIsNotNone(new_sub)
        self.assertEqual(new_sub.plan, self.plan_new)
        self.assertEqual(new_sub.origin, "plan_change")
        self.assertEqual(pcr.subscription_id, new_sub.id)

        self._run_auto_renew(self.effective)
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 2,
        )

    # 4) Idempotencia del comando
    def test_command_idempotent(self):
        pcr = self._create_approved_pcr()
        self._run_apply_plan_changes(self.effective)
        self._run_apply_plan_changes(self.effective)

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 2,
        )

    # 5) Múltiples PCR approved antiguas: ninguna queda colgada
    def test_multiple_approved_pcrs_all_executed(self):
        pcr1 = self._create_approved_pcr()
        pcr2 = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            requested_plan=self.plan_new,
            status="approved",
            effective_date=self.effective,
            current_schedules_snapshot=[{"day": "monday", "hour": "10:00"}],
            target_schedules_snapshot=self._target(),
        )

        self._run_apply_plan_changes(self.effective)

        pcr1.refresh_from_db()
        pcr2.refresh_from_db()
        self.assertEqual(pcr1.status, "executed")
        self.assertEqual(pcr2.status, "executed")
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 2,
        )
        self.assertFalse(
            PlanChangeRequest.objects.filter(
                status="approved", effective_date__lte=self.effective,
            ).exists()
        )

    # 6) PCR futura no se ejecuta ni altera la renovación
    def test_future_pcr_not_executed(self):
        pcr = self._create_approved_pcr(effective=get_first_day_of_next_month(self.effective))

        self._run_auto_renew(self.effective)
        self._run_apply_plan_changes(self.effective)

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "approved")

        new_sub = Subscription.objects.filter(
            member=self.member, start_date=self.effective,
        ).first()
        self.assertEqual(new_sub.plan, self.plan_old)

    # 7) Flujo completo por API: solicitar + aprobar + renovar + ejecutar
    def test_api_full_flow(self):
        from django.contrib.auth.models import User
        from rest_framework.authtoken.models import Token
        from rest_framework.test import APIClient

        client = APIClient()
        user = User.objects.create_user(username="p04admin", password="pass1234")
        user.profile.gym = self.gym
        user.profile.save()
        client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=user).key}"
        )

        resp = client.post(
            "/api/plan-change-requests/",
            {
                "member": self.member.id,
                "requested_plan": self.plan_new.id,
                "target_schedules_snapshot": self._target(),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        pk = resp.data["id"]
        self.assertEqual(resp.data["status"], "pending")

        resp2 = client.post(f"/api/plan-change-requests/{pk}/approve/", format="json")
        self.assertEqual(resp2.status_code, 200, resp2.data)
        self.assertEqual(resp2.data["status"], "approved")
        self.assertEqual(resp2.data["effective_date"], self.effective.isoformat())

        planned = PlannedSchedule.objects.filter(plan_change_id=pk)
        self.assertEqual(planned.count(), 2)
        self.assertFalse(planned.filter(activated=True).exists())

        self._run_auto_renew(self.effective)

        pcr = PlanChangeRequest.objects.get(pk=pk)
        self.assertEqual(pcr.status, "executed")

        new_sub = Subscription.objects.filter(
            member=self.member, start_date=self.effective,
        ).first()
        self.assertIsNotNone(new_sub)
        self.assertEqual(new_sub.plan, self.plan_new)
        self.assertTrue(all(ps.activated for ps in planned))
        self.assertEqual(self._active_days(), {"monday", "wednesday"})
