"""Fase K4 — ACC-16: el cambio de plan cancela pedidos de horario en silencio.

Al aprobar (o rechazar) un cambio de plan, el backend cancelaba todos los
pedidos de cambio de horario y de intercambio pendientes del socio, con
una nota en inglés y sin avisar. Peor: al **rechazar** el cambio de plan
también los cancelaba, aunque no había motivo para eso (el socio sigue con
su plan y su pedido de horario sigue siendo válido).

- `backend/subscriptions/views.py:394` llama `_cancel_pending_schedule_requests`
  para cualquier estado.
- `backend/subscriptions/views.py:464-471` cancela con la nota en inglés
  "Cancelled due to plan change approval".
"""

from datetime import date, time

from attendance.models import (
    AttendanceSchedule,
    ScheduleChangeRequest,
    ScheduleSlot,
    ScheduleSwapRequest,
)
from core.testing import BaseAPITest
from subscriptions.models import PlanChangeRequest


class Acc16PlanChangeCancelsRequestsTests(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.plan = self.create_plan(self.gym)
        self.new_plan = self.create_plan(self.gym, name="Plan Nuevo")
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)

        self.slot = ScheduleSlot.objects.create(
            gym=self.gym, day="monday", hour=time(10, 0),
        )
        self.other_slot = ScheduleSlot.objects.create(
            gym=self.gym, day="wednesday", hour=time(18, 0),
        )
        self.schedule = self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub,
        )

        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

        self.plan_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            subscription=self.sub,
            requested_plan=self.new_plan,
            current_schedules_snapshot=[],
            target_schedules_snapshot=[],
            status="pending",
        )

        self.change_request = ScheduleChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            current_schedule=self.schedule,
            requested_slot=self.other_slot,
            status="pending",
        )
        self.swap_request = ScheduleSwapRequest.objects.create(
            gym=self.gym,
            member=self.member,
            origin_schedule=self.schedule,
            destination_slot=self.other_slot,
            swap_date=date(2030, 1, 7),
            status="pending",
        )

    def reject_plan_change(self):
        return self.client.post(
            f"/api/plan-change-requests/{self.plan_change.pk}/reject/",
            {"admin_notes": "No corresponde"},
            format="json",
        )

    def approve_plan_change(self):
        return self.client.post(
            f"/api/plan-change-requests/{self.plan_change.pk}/approve/",
            {},
            format="json",
        )

    def test_rejecting_the_plan_change_keeps_the_pending_requests(self):
        resp = self.reject_plan_change()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.change_request.refresh_from_db()
        self.swap_request.refresh_from_db()
        self.assertEqual(self.change_request.status, "pending")
        self.assertEqual(self.swap_request.status, "pending")

    def test_approving_the_plan_change_cancels_with_a_spanish_note(self):
        resp = self.approve_plan_change()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.change_request.refresh_from_db()
        self.swap_request.refresh_from_db()
        self.assertEqual(self.change_request.status, "cancelled_by_staff")
        self.assertEqual(self.swap_request.status, "cancelled")
        # La nota es lo único que ve el socio en el portal: tiene que estar
        # en español y decir qué pasó.
        self.assertNotIn("Cancelled", self.change_request.admin_notes)
        self.assertIn("cambio de plan", self.change_request.admin_notes.lower())
        self.assertNotIn("Cancelled", self.swap_request.admin_notes)
        self.assertIn("cambio de plan", self.swap_request.admin_notes.lower())
