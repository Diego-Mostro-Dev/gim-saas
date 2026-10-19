from attendance.models import AttendanceSchedule
from core.testing import BaseAPITest
from plans.models import MembershipPlan
from subscriptions.models import PlanChangeRequest, Subscription


class PlanChangeWeeklyVisitsTests(BaseAPITest):
    """CFG-12: aprobar un cambio de plan respeta el ``weekly_visits`` vigente.

    El validador de creación ya miraba el plan; el agujero estaba al ejecutar:
    si el plan cambiaba entre la solicitud y la aprobación, el socio quedaba
    con más horarios que visitas pagas. Ahora se valida antes de abrir el
    período y reescribir horarios.
    """

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.member = self.create_member(self.gym)
        self.target_plan = self.create_plan(
            self.gym, name="Plan B", weekly_visits=3
        )
        self.slot = self.create_today_slot(self.gym, hour="10:00")
        self.second = self.create_today_slot(self.gym, hour="12:00")
        AttendanceSchedule.objects.create(
            member=self.member, gym=self.gym, slot=self.slot, active=True
        )
        self.pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            requested_plan=self.target_plan,
            current_schedules_snapshot=[
                {"day": self.slot.day, "hour": "10:00"},
            ],
            target_schedules_snapshot=[
                {"day": self.slot.day, "hour": "10:00"},
                {"day": self.second.day, "hour": "12:00"},
            ],
        )

    def _approve(self):
        return self.client.post(
            f"/api/plan-change-requests/{self.pcr.id}/approve/"
        )

    def test_approval_rejects_target_over_the_plan_limit(self):
        MembershipPlan.objects.filter(pk=self.target_plan.pk).update(
            weekly_visits=1
        )

        resp = self._approve()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("visita", resp.data["detail"])
        self.pcr.refresh_from_db()
        self.assertEqual(self.pcr.status, "pending")
        self.assertEqual(
            AttendanceSchedule.objects.filter(
                member=self.member, active=True
            ).count(),
            1,
        )
        self.assertFalse(Subscription.objects.filter(member=self.member).exists())

    def test_approval_executes_when_target_fits_the_plan_limit(self):
        resp = self._approve()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.pcr.refresh_from_db()
        self.assertEqual(self.pcr.status, "executed")
        self.assertTrue(Subscription.objects.filter(member=self.member).exists())
        active = AttendanceSchedule.objects.filter(
            member=self.member, active=True
        )
        self.assertEqual(active.count(), 2)
