from core.testing import BaseAPITest

from payments.models import Payment
from subscriptions.models import Subscription

from members.models import Member


class MemberSoftDeleteTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym, phone="11-k6-0001")
        self.subscription = self.open_month_subscription(self.member, self.plan)

    def _deactivate(self):
        return self.client.post(f"/api/members/{self.member.id}/deactivate/")

    def _reactivate(self):
        return self.client.post(f"/api/members/{self.member.id}/reactivate/")

    def test_delete_returns_405_and_keeps_member(self):
        resp = self.client.delete(
            f"/api/members/{self.member.id}/",
            HTTP_ACCEPT="application/json",
        )

        self.assertEqual(resp.status_code, 405)
        stored = Member.all_objects.get(pk=self.member.pk)
        self.assertIsNone(stored.deleted_at)

    def test_deactivate_marks_deleted_and_inactive(self):
        resp = self._deactivate()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.deleted_at)
        self.assertFalse(self.member.active)
        self.assertFalse(Member.objects.filter(pk=self.member.pk).exists())
        self.assertTrue(Member.all_objects.filter(pk=self.member.pk).exists())

    def test_deactivate_turns_off_auto_renew(self):
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.auto_renew)

        resp = self._deactivate()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.auto_renew)

    def test_deactivated_member_leaves_operational_queries(self):
        self.assertEqual(self._deactivate().status_code, 200)

        listing = self.client.get("/api/members/")
        self.assertEqual(listing.status_code, 200)
        self.assertNotIn(
            self.member.id,
            [row["id"] for row in listing.data],
        )

        detail = self.client.get(f"/api/members/{self.member.id}/")
        self.assertEqual(detail.status_code, 404)

        payments = self.client.get(f"/api/members/{self.member.id}/payments/")
        self.assertEqual(payments.status_code, 404)

        portal = self.client.get(
            f"/api/public/{self.member.access_token}/data/"
        )
        self.assertEqual(portal.status_code, 404)

    def test_deleted_list_shows_only_deleted_members(self):
        alive = self.create_member(self.gym, phone="11-k6-0002")
        self.assertEqual(self._deactivate().status_code, 200)

        resp = self.client.get("/api/members/", {"deleted": "1"})

        self.assertEqual(resp.status_code, 200, resp.data)
        ids = [row["id"] for row in resp.data]
        self.assertEqual(ids, [self.member.id])
        self.assertNotIn(alive.id, ids)

    def test_reactivate_restores_member(self):
        self.assertEqual(self._deactivate().status_code, 200)

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.deleted_at)
        self.assertTrue(self.member.active)
        self.assertTrue(Member.objects.filter(pk=self.member.pk).exists())

        listing = self.client.get("/api/members/")
        self.assertIn(self.member.id, [row["id"] for row in listing.data])

    def test_reactivate_alive_member_returns_400(self):
        resp = self._reactivate()

        self.assertEqual(resp.status_code, 400, resp.data)

    def test_reactivate_keeps_auto_renew_off(self):
        self.assertEqual(self._deactivate().status_code, 200)
        self.assertEqual(self._reactivate().status_code, 200)

        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.auto_renew)

    def test_phone_can_be_reused_after_deactivation(self):
        self.assertEqual(self._deactivate().status_code, 200)

        replacement = self.create_member(self.gym, phone=self.member.phone)

        self.assertEqual(replacement.phone, self.member.phone)
        self.assertTrue(Member.objects.filter(pk=replacement.pk).exists())

    def test_reactivate_with_reused_phone_returns_400(self):
        self.assertEqual(self._deactivate().status_code, 200)
        self.create_member(self.gym, phone=self.member.phone)

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("phone", resp.data)
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.deleted_at)

    def test_history_is_preserved(self):
        self.settle_subscription(self.subscription)
        subscription_count = Subscription.objects.filter(
            member=self.member
        ).count()
        payment_count = Payment.objects.filter(member=self.member).count()
        self.assertGreater(payment_count, 0)

        self.assertEqual(self._deactivate().status_code, 200)

        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(),
            subscription_count,
        )
        self.assertEqual(
            Payment.objects.filter(member=self.member).count(),
            payment_count,
        )
        self.assertTrue(
            Payment.objects.filter(member=self.member).exists()
        )

    def test_deactivated_member_is_not_counted_in_dashboard(self):
        before = self.client.get("/api/dashboard/")
        self.assertEqual(before.status_code, 200)
        self.assertEqual(before.data["activeMembers"], 1)

        self.assertEqual(self._deactivate().status_code, 200)

        after = self.client.get("/api/dashboard/")
        self.assertEqual(after.status_code, 200)
        self.assertEqual(after.data["activeMembers"], 0)

    def test_deactivate_from_another_gym_returns_404(self):
        other_gym = self.create_gym(name="Otro Gym")
        other_user = self.create_user(
            other_gym,
            username="other",
        )
        self.client.force_authenticate(user=other_user)

        resp = self.client.post(
            f"/api/members/{self.member.id}/deactivate/"
        )

        self.assertEqual(resp.status_code, 404)

    def test_reactivate_from_another_gym_returns_404(self):
        self.assertEqual(self._deactivate().status_code, 200)
        other_gym = self.create_gym(name="Otro Gym")
        other_user = self.create_user(
            other_gym,
            username="other",
        )
        self.client.force_authenticate(user=other_user)

        resp = self.client.post(
            f"/api/members/{self.member.id}/reactivate/"
        )

        self.assertEqual(resp.status_code, 404)

    def test_reactivate_can_reuse_released_phone(self):
        phone = self.member.phone
        self.assertEqual(self._deactivate().status_code, 200)
        self.create_member(self.gym, phone="11-k6-0003")

        replacement = self.create_member(self.gym, phone=phone)
        replacement.soft_delete()

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 200, resp.data)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.deleted_at)


class MemberOperationalVisibilityTests(BaseAPITest):
    """La baja lógica sale de las vistas operativas, no del historial."""

    def setUp(self):
        from datetime import time
        from decimal import Decimal

        from activities.models import Activity, ActivitySchedule, Enrollment
        from attendance.models import AttendanceSchedule, ScheduleSlot
        from outings.models import Outing, OutingEnrollment, OutingSchedule
        from personal_training.models import (
            PersonalTrainingAssignment,
            PersonalTrainingService,
        )
        from plans.models import Service
        from routines.models import RoutineAssignment, RoutineTemplate

        from members.models import MemberAttachment

        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.gym.features = {
            "activities": True,
            "personal_training": True,
            "salidas": True,
        }
        self.gym.save(update_fields=["features"])

        self.plan = self.create_plan(self.gym)
        self.deleted = self.create_member(
            self.gym,
            first_name="Baja",
            last_name="K6",
            phone="11-k6-1001",
        )
        self.alive = self.create_member(
            self.gym,
            first_name="Alta",
            last_name="K6",
            phone="11-k6-1002",
        )
        for member in (self.deleted, self.alive):
            self.open_month_subscription(member, self.plan)

        self.slot = ScheduleSlot.objects.create(
            gym=self.gym,
            day="monday",
            hour=time(10, 0),
            capacity=5,
        )
        for member in (self.deleted, self.alive):
            AttendanceSchedule.objects.create(
                gym=self.gym,
                member=member,
                slot=self.slot,
            )

        service = Service.get_default_for_gym(self.gym)
        self.activity = Activity.objects.create(
            service=service,
            name="K6 funcional",
            billing_mode="sessions",
        )
        self.activity_schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(11, 0),
            end_time=time(12, 0),
            capacity=5,
        )
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=service,
            name="K6 PT",
            billing_mode="sessions",
        )
        self.trainer = self.create_user(
            self.gym,
            username="k6-trainer",
            role="trainer",
        )
        self.outing = Outing.objects.create(
            gym=self.gym,
            service=service,
            name="K6 running",
            billing_mode="sessions",
        )
        self.outing_schedule = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(13, 0),
            end_time=time(14, 0),
            capacity=5,
        )

        self.activity_enrollments = {}
        self.pt_assignments = {}
        self.outing_enrollments = {}
        for index, member in enumerate((self.deleted, self.alive)):
            self.activity_enrollments[member.id] = Enrollment.objects.create(
                gym=self.gym,
                member=member,
                schedule=self.activity_schedule,
                modality="package",
                package_total_sessions=10,
                session_price=Decimal("100.00"),
                amount_paid=Decimal("0.00"),
            )
            self.pt_assignments[member.id] = (
                PersonalTrainingAssignment.objects.create(
                    gym=self.gym,
                    member=member,
                    trainer=self.trainer,
                    service=self.pt_service,
                    day="monday",
                    start_time=time(15 + index, 0),
                    end_time=time(16 + index, 0),
                    modality="package",
                    package_total_sessions=10,
                    session_price=Decimal("100.00"),
                    amount_paid=Decimal("0.00"),
                )
            )
            self.outing_enrollments[member.id] = OutingEnrollment.objects.create(
                gym=self.gym,
                member=member,
                schedule=self.outing_schedule,
                modality="package",
                package_total_sessions=10,
                session_price=Decimal("100.00"),
                amount_paid=Decimal("0.00"),
            )

        template = RoutineTemplate.objects.create(
            gym=self.gym,
            name="K6 rutina",
        )
        self.routine_assignments = {}
        for member in (self.deleted, self.alive):
            self.routine_assignments[member.id] = (
                RoutineAssignment.objects.create(
                    gym=self.gym,
                    member=member,
                    routine_template=template,
                )
            )

        self.attachments = {}
        for member in (self.deleted, self.alive):
            self.attachments[member.id] = MemberAttachment.objects.create(
                gym=self.gym,
                member=member,
                category="other",
                note=f"Adjunto {member.first_name}",
            )

        resp = self.client.post(f"/api/members/{self.deleted.id}/deactivate/")
        self.assertEqual(resp.status_code, 200, resp.data)

    def _results(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        if isinstance(data, dict):
            return data.get("results", [])
        return data

    def test_subscriptions_and_debtors_hide_deleted_members(self):
        subscriptions = self._results(self.client.get("/api/subscriptions/"))
        member_ids = [row["member"] for row in subscriptions]
        self.assertIn(self.alive.id, member_ids)
        self.assertNotIn(self.deleted.id, member_ids)

        outstanding = self._results(
            self.client.get("/api/subscriptions/outstanding/")
        )
        debtor_ids = [row["member_id"] for row in outstanding]
        self.assertIn(self.alive.id, debtor_ids)
        self.assertNotIn(self.deleted.id, debtor_ids)

    def test_financial_history_stays_visible(self):
        payment = Payment.objects.create(
            gym=self.gym,
            member=self.deleted,
            amount="1500.00",
            payment_method="cash",
            member_name="Baja K6",
            plan_name="Plan Premium",
        )

        rows = self._results(self.client.get("/api/payments/"))

        self.assertIn(payment.id, [row["id"] for row in rows])

    def test_attendance_views_hide_deleted_members(self):
        weekly = self.client.get("/api/attendance/weekly/")
        self.assertEqual(weekly.status_code, 200, weekly.data)
        weekly_items = [
            item
            for day, items in weekly.data.items()
            if day not in ("open_days", "closed_dates")
            for item in items
        ]
        self.assertIn(self.alive.id, [item["member"] for item in weekly_items])
        self.assertNotIn(
            self.deleted.id,
            [item["member"] for item in weekly_items],
        )

        params = {"day": "monday", "hour": "10:00"}
        by_schedule = self._results(
            self.client.get("/api/attendance/members-by-schedule/", params)
        )
        self.assertIn(self.alive.id, [row["member_id"] for row in by_schedule])
        self.assertNotIn(
            self.deleted.id,
            [row["member_id"] for row in by_schedule],
        )

        status_rows = self._results(
            self.client.get("/api/attendance/status/", params)
        )
        self.assertIn(self.alive.id, [row["member_id"] for row in status_rows])
        self.assertNotIn(
            self.deleted.id,
            [row["member_id"] for row in status_rows],
        )

    def test_activities_hide_deleted_members(self):
        activities = self._results(
            self.client.get("/api/activities/activities/", {"active": "true"})
        )
        row = next(item for item in activities if item["id"] == self.activity.id)
        self.assertEqual(row["enrolled_count"], 1)

        enrollments = self._results(
            self.client.get(
                f"/api/activities/schedules/{self.activity_schedule.id}/enrollments/"
            )
        )
        enrolled_ids = [item["member"]["id"] for item in enrollments]
        self.assertIn(self.alive.id, enrolled_ids)
        self.assertNotIn(self.deleted.id, enrolled_ids)

    def test_outings_hide_deleted_members(self):
        outings = self._results(
            self.client.get("/api/outings/outings/", {"active": "true"})
        )
        row = next(item for item in outings if item["id"] == self.outing.id)
        self.assertEqual(row["enrolled_count"], 1)

        enrollments = self._results(
            self.client.get(
                f"/api/outings/schedules/{self.outing_schedule.id}/enrollments/"
            )
        )
        enrolled_ids = [item["member"]["id"] for item in enrollments]
        self.assertIn(self.alive.id, enrolled_ids)
        self.assertNotIn(self.deleted.id, enrolled_ids)

    def test_personal_training_routines_and_attachments_hide_deleted_members(self):
        assignments = self._results(
            self.client.get("/api/personal-training/assignments/")
        )
        assignment_phones = [item["member"]["phone"] for item in assignments]
        self.assertIn(self.alive.phone, assignment_phones)
        self.assertNotIn(self.deleted.phone, assignment_phones)

        routines = self._results(self.client.get("/api/routines/assignments/"))
        routine_member_ids = [item["member"] for item in routines]
        self.assertIn(self.alive.id, routine_member_ids)
        self.assertNotIn(self.deleted.id, routine_member_ids)

        routine = self.client.get(f"/api/routines/member/{self.deleted.id}/")
        self.assertEqual(routine.status_code, 404)

        attachments = self._results(self.client.get("/api/members/attachments/"))
        attachment_member_ids = [item["member_id"] for item in attachments]
        self.assertIn(self.alive.id, attachment_member_ids)
        self.assertNotIn(self.deleted.id, attachment_member_ids)

    def test_dashboard_hides_deleted_operational_events(self):
        dashboard = self.client.get("/api/dashboard/")

        self.assertEqual(dashboard.status_code, 200, dashboard.data)
        self.assertEqual(dashboard.data["activeMembers"], 1)

        descriptions = [
            item["description"] for item in dashboard.data["recentActivity"]
        ]
        self.assertFalse(any("Baja K6" in text for text in descriptions))

        pending_member_ids = [
            item["member_id"] for item in dashboard.data["pendingPayments"]
        ]
        self.assertNotIn(self.deleted.id, pending_member_ids)


class MemberReactivationCapacityTests(BaseAPITest):
    def setUp(self):
        from datetime import time

        from attendance.models import ScheduleSlot

        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(
            self.gym,
            first_name="Vuelve",
            last_name="K6",
            phone="11-k6-2001",
        )
        self.subscription = self.open_month_subscription(
            self.member,
            self.plan,
        )
        self.member.soft_delete()

        self.other = self.create_member(
            self.gym,
            first_name="Ocupa",
            last_name="K6",
            phone="11-k6-2002",
        )
        self.slot = ScheduleSlot.objects.create(
            gym=self.gym,
            day="monday",
            hour=time(10, 0),
            capacity=1,
        )

    def _reactivate(self):
        return self.client.post(f"/api/members/{self.member.id}/reactivate/")

    def test_reactivation_fails_when_gym_slot_is_full(self):
        from attendance.models import AttendanceSchedule

        AttendanceSchedule.objects.create(
            gym=self.gym,
            member=self.member,
            slot=self.slot,
        )
        AttendanceSchedule.objects.create(
            gym=self.gym,
            member=self.other,
            slot=self.slot,
        )

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("conflicts", resp.data)
        self.assertTrue(any("Horario" in item for item in resp.data["conflicts"]))
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.deleted_at)

    def test_reactivation_fails_when_activity_is_full(self):
        from datetime import time

        from activities.models import Activity, ActivitySchedule, Enrollment
        from plans.models import Service

        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="K6 capacidad",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=time(11, 0),
            end_time=time(12, 0),
            capacity=1,
        )
        Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=schedule,
        )
        Enrollment.objects.create(
            gym=self.gym,
            member=self.other,
            schedule=schedule,
        )

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertTrue(
            any("Actividad" in item for item in resp.data["conflicts"])
        )
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.deleted_at)

    def test_reactivation_fails_when_outing_is_full(self):
        from datetime import time

        from outings.models import Outing, OutingEnrollment, OutingSchedule
        from plans.models import Service

        outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="K6 salida",
        )
        schedule = OutingSchedule.objects.create(
            outing=outing,
            day="monday",
            start_time=time(13, 0),
            end_time=time(14, 0),
            capacity=1,
        )
        OutingEnrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=schedule,
        )
        OutingEnrollment.objects.create(
            gym=self.gym,
            member=self.other,
            schedule=schedule,
        )

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertTrue(any("Salida" in item for item in resp.data["conflicts"]))
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.deleted_at)

    def test_reactivation_fails_when_trainer_is_booked(self):
        from datetime import time

        from personal_training.models import (
            PersonalTrainingAssignment,
            PersonalTrainingService,
        )
        from plans.models import Service

        trainer = self.create_user(
            self.gym,
            username="k6-capacity-trainer",
            role="trainer",
        )
        service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="K6 PT capacidad",
        )
        PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            trainer=trainer,
            service=service,
            day="monday",
            start_time=time(15, 0),
            end_time=time(16, 0),
        )
        PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.other,
            trainer=trainer,
            service=service,
            day="monday",
            start_time=time(15, 0),
            end_time=time(16, 0),
        )

        resp = self._reactivate()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertTrue(
            any("Entrenamiento personal" in item for item in resp.data["conflicts"])
        )
        self.member.refresh_from_db()
        self.assertIsNotNone(self.member.deleted_at)
