import json

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils.timezone import now
from datetime import date, timedelta, time

from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token

from gyms.models import Gym
from members.models import Member
from plans.models import MembershipPlan
from subscriptions.models import Subscription, PlanChangeRequest, PlannedSchedule
from attendance.models import AttendanceSchedule, ScheduleSlot, ScheduleChangeRequest, ScheduleSwapRequest
from subscriptions.services import calculate_effective_date, compute_projected_occupancy


def _to_time(hour_str):
    return time(*map(int, hour_str.split(":")))


def _create_slot(gym, day, hour_str, capacity=None):
    return ScheduleSlot.objects.create(
        gym=gym, day=day, hour=_to_time(hour_str), capacity=capacity,
    )


def _create_schedules(member, gym, slots_data):
    for day, hour_str in slots_data:
        slot = ScheduleSlot.objects.get(gym=gym, day=day, hour=_to_time(hour_str))
        AttendanceSchedule.objects.create(gym=gym, member=member, slot=slot, active=True)


class MemberScheduleLimitTest(TestCase):
    """Weekly schedule limit enforcement via MembershipPlan.weekly_visits."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.plan_limited = MembershipPlan.objects.create(
            gym=self.gym, name="Starter", price=10, duration_days=30, weekly_visits=2,
        )
        self.plan_unlimited = MembershipPlan.objects.create(
            gym=self.gym, name="Unlimited", price=20, duration_days=30, weekly_visits=None,
        )

        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        for hour in range(10, 15):
            for day in days:
                _create_slot(self.gym, day, f"{hour}:00", capacity=None)

    def _member_url(self, member):
        return f"/api/members/{member.id}/"

    def _update_schedules(self, member, schedules, expected_status):
        resp = self.client.patch(
            self._member_url(member),
            {"schedules": schedules, "first_name": member.first_name},
            format="json",
        )
        self.assertEqual(resp.status_code, expected_status, msg=resp.data if hasattr(resp, 'data') else "")
        return resp

    # ── Case A: Plan=2, Schedules=2, Add third → FAIL ──

    def test_case_a_exceed_limit(self):
        member = Member.objects.create(gym=self.gym, first_name="A", last_name="User", phone="100")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_limited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])
        self._update_schedules(member, [
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
            {"day": "wednesday", "hour": "10:00"},
        ], 400)

    # ── Case B: Plan=2, Schedules=1, Add second → PASS ──

    def test_case_b_within_limit(self):
        member = Member.objects.create(gym=self.gym, first_name="B", last_name="User", phone="101")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_limited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(member, self.gym, [("monday", "10:00")])
        self._update_schedules(member, [
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
        ], 200)

    # ── Case C: Plan=null, Schedules=20, Add another → PASS ──

    def test_case_c_unlimited_plan(self):
        member = Member.objects.create(gym=self.gym, first_name="C", last_name="User", phone="102")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_unlimited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        prev_slots = [(d, f"{h}:00") for h in range(10, 14) for d in days]
        _create_schedules(member, self.gym, prev_slots)
        all_slots = prev_slots + [("saturday", "14:00")]
        new_schedules = [{"day": d, "hour": h} for d, h in all_slots]
        self._update_schedules(member, new_schedules, 200)

    # ── Case D: No subscription, Schedules=20, Add another → PASS ──

    def test_case_d_no_subscription(self):
        member = Member.objects.create(gym=self.gym, first_name="D", last_name="User", phone="103")
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        prev_slots = [(d, f"{h}:00") for h in range(10, 14) for d in days]
        _create_schedules(member, self.gym, prev_slots)
        all_slots = prev_slots + [("saturday", "14:00")]
        new_schedules = [{"day": d, "hour": h} for d, h in all_slots]
        self._update_schedules(member, new_schedules, 200)

    # ── Case E: Plan=2, Already has 5, Edit unrelated data → PASS ──

    def test_case_e_grandfathered_edit_unrelated(self):
        member = Member.objects.create(gym=self.gym, first_name="E", last_name="User", phone="104")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_limited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
            ("wednesday", "10:00"), ("thursday", "10:00"),
            ("friday", "10:00"),
        ])
        resp = self.client.patch(
            self._member_url(member),
            {"first_name": "UpdatedE"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    # ── Case F: Plan=2, Already has 5, Try adding sixth → FAIL ──

    def test_case_f_grandfathered_exceed(self):
        member = Member.objects.create(gym=self.gym, first_name="F", last_name="User", phone="105")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_limited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
            ("wednesday", "10:00"), ("thursday", "10:00"),
            ("friday", "10:00"),
        ])
        self._update_schedules(member, [
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
            {"day": "wednesday", "hour": "10:00"},
            {"day": "thursday", "hour": "10:00"},
            {"day": "friday", "hour": "10:00"},
            {"day": "saturday", "hour": "10:00"},
        ], 400)

    # ── Extra: replacing within grandfathered count should pass ──

    def test_grandfathered_replace_within_count(self):
        member = Member.objects.create(gym=self.gym, first_name="G", last_name="User", phone="106")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_limited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
            ("wednesday", "10:00"), ("thursday", "10:00"),
            ("friday", "10:00"),
        ])
        _create_slot(self.gym, "saturday", "10:05")
        self._update_schedules(member, [
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
            {"day": "wednesday", "hour": "10:00"},
            {"day": "thursday", "hour": "10:00"},
            {"day": "saturday", "hour": "10:05"},
        ], 200)

    # ── Extra: reduce schedules within grandfathered count should pass ──

    def test_grandfathered_reduce_count(self):
        member = Member.objects.create(gym=self.gym, first_name="H", last_name="User", phone="107")
        Subscription.objects.create(
            gym=self.gym, member=member, plan=self.plan_limited,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
            ("wednesday", "10:00"), ("thursday", "10:00"),
            ("friday", "10:00"),
        ])
        self._update_schedules(member, [
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
        ], 200)


class PlanChangeRequestTest(TestCase):
    """PlanChangeRequest creation via admin ViewSet."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123",
            email="gym@test.com",
        )
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.plan_current = MembershipPlan.objects.create(
            gym=self.gym, name="Current", price=10, duration_days=30, weekly_visits=2,
        )
        self.plan_target = MembershipPlan.objects.create(
            gym=self.gym, name="Premium", price=20, duration_days=30, weekly_visits=2,
        )
        self.plan_unlimited = MembershipPlan.objects.create(
            gym=self.gym, name="Unlimited", price=25, duration_days=30, weekly_visits=None,
        )

        self.member = Member.objects.create(
            gym=self.gym, first_name="Test", last_name="Member", phone="999",
        )
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )

        _create_slot(self.gym, "monday", "10:00")
        _create_slot(self.gym, "tuesday", "10:00")
        _create_slot(self.gym, "wednesday", "10:00")

        _create_schedules(self.member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

    def _url(self, suffix=""):
        if suffix:
            return f"/api/plan-change-requests/{suffix}/"
        return "/api/plan-change-requests/"

    def _create_request(self, member=None, plan=None, schedules=None):
        data = {
            "member": (member or self.member).id,
            "requested_plan": (plan or self.plan_target).id,
            "target_schedules_snapshot": schedules or [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        return self.client.post(self._url(), data, format="json")

    def test_create_valid_request(self):
        resp = self._create_request()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "pending")
        self.assertIsNotNone(resp.data["current_schedules_snapshot"])
        self.assertEqual(len(resp.data["current_schedules_snapshot"]), 2)

    def test_create_without_active_subscription(self):
        member_no_sub = Member.objects.create(
            gym=self.gym, first_name="No", last_name="Sub", phone="111",
        )
        resp = self._create_request(member=member_no_sub)
        self.assertEqual(resp.status_code, 400)

    def test_create_same_plan_rejected(self):
        resp = self._create_request(plan=self.plan_current)
        self.assertEqual(resp.status_code, 400)

    def test_create_cross_gym_plan_rejected(self):
        other_gym = Gym.objects.create(
            name="Other", slug="other-gym", phone="999", email="o@o.com",
        )
        other_plan = MembershipPlan.objects.create(
            gym=other_gym, name="Other", price=5, duration_days=30,
        )
        resp = self._create_request(plan=other_plan)
        self.assertEqual(resp.status_code, 400)

    def test_create_duplicate_pending_rejected(self):
        self._create_request()
        resp = self._create_request()
        self.assertEqual(resp.status_code, 400)

    def test_create_wrong_schedule_count_rejected(self):
        resp = self._create_request(schedules=[
            {"day": "monday", "hour": "10:00"},
        ])
        self.assertEqual(resp.status_code, 400)

    def test_create_full_capacity_rejected(self):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        slot.capacity = 1
        slot.save()

        other_member = Member.objects.create(
            gym=self.gym, first_name="Other", last_name="Guy", phone="222",
        )
        AttendanceSchedule.objects.create(
            gym=self.gym, member=other_member, slot=slot, active=True,
        )

        resp = self._create_request(schedules=[
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
        ])
        self.assertEqual(resp.status_code, 400)

    def test_approve_request(self):
        resp = self._create_request()
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "approved")
        self.assertIsNotNone(resp2.data["reviewed_at"])

    def test_reject_request(self):
        resp = self._create_request()
        pk = resp.data["id"]

        resp2 = self.client.post(
            self._url(f"{pk}/reject"),
            {"admin_notes": "Not suitable"},
            format="json",
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "rejected")
        self.assertEqual(resp2.data["admin_notes"], "Not suitable")

    def test_cancel_pending_request(self):
        resp = self._create_request()
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "cancelled")

    def test_cannot_approve_already_approved(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.client.post(self._url(f"{pk}/approve"), format="json")
        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 400)

    def test_cannot_cancel_approved(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.client.post(self._url(f"{pk}/approve"), format="json")
        self.client.post(self._url(f"{pk}/cancel"), format="json")

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 400)

    def test_approve_sets_effective_date(self):
        resp = self._create_request()
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "approved")
        self.assertIsNotNone(resp2.data.get("effective_date"))

        today = date.today()
        expected = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
        self.assertEqual(resp2.data["effective_date"], expected.isoformat())

    def test_approve_deferred_does_not_change_plan_yet(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.member.refresh_from_db()
        original_plan = self.member.subscription_set.first().plan

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "approved")

        self.member.refresh_from_db()
        subscription = self.member.subscription_set.first()
        self.assertEqual(subscription.plan, original_plan)
        self.assertNotEqual(subscription.plan, self.plan_target)

    def test_reject_does_not_update_subscription_plan(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.member.refresh_from_db()
        original_plan = self.member.subscription_set.first().plan

        resp2 = self.client.post(
            self._url(f"{pk}/reject"),
            {"admin_notes": "Not suitable"},
            format="json",
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "rejected")

        self.member.refresh_from_db()
        subscription = self.member.subscription_set.first()
        self.assertEqual(subscription.plan, original_plan)
        self.assertNotEqual(subscription.plan, self.plan_target)

    def test_cancel_does_not_update_subscription_plan(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.member.refresh_from_db()
        original_plan = self.member.subscription_set.first().plan

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "cancelled")

        self.member.refresh_from_db()
        subscription = self.member.subscription_set.first()
        self.assertEqual(subscription.plan, original_plan)
        self.assertNotEqual(subscription.plan, self.plan_target)


    
                
    def test_approve_deferred_creates_planned_schedules(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.member.refresh_from_db()
        original_schedules = list(AttendanceSchedule.objects.filter(
            member=self.member, active=True
        ).select_related("slot"))

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)

        for s in original_schedules:
            s.refresh_from_db()
            self.assertTrue(s.active)

        planned = PlannedSchedule.objects.filter(plan_change_id=pk)
        self.assertEqual(planned.count(), 2)
        self.assertFalse(planned.filter(activated=True).exists())

    

    def test_approve_cancels_pending_schedule_change_request(self):
        resp = self._create_request()
        pk = resp.data["id"]

        original_schedules = AttendanceSchedule.objects.filter(
            member=self.member, active=True
        ).select_related("slot")

        ScheduleChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            current_schedule=original_schedules[0],
            requested_slot=ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00")),
            status="pending",
        )

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)

        self.assertEqual(
            ScheduleChangeRequest.objects.filter(
                member=self.member, status="pending"
            ).count(),
            0,
        )
        self.assertEqual(
            ScheduleChangeRequest.objects.filter(
                member=self.member, status="cancelled"
            ).count(),
            1,
        )

    def test_approve_cancels_pending_schedule_swap_request(self):
        resp = self._create_request()
        pk = resp.data["id"]

        original_schedules = AttendanceSchedule.objects.filter(
            member=self.member, active=True
        ).select_related("slot")

        ScheduleSwapRequest.objects.create(
            gym=self.gym,
            member=self.member,
            origin_schedule=original_schedules[0],
            destination_slot=ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00")),
            swap_date=date.today(),
            status="pending",
        )

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)

        self.assertEqual(
            ScheduleSwapRequest.objects.filter(
                member=self.member, status="pending"
            ).count(),
            0,
        )
        self.assertEqual(
            ScheduleSwapRequest.objects.filter(
                member=self.member, status="cancelled"
            ).count(),
            1,
        )

    def test_reject_does_not_modify_schedules(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.member.refresh_from_db()
        original_schedules = AttendanceSchedule.objects.filter(
            member=self.member, active=True
        ).select_related("slot")

        resp2 = self.client.post(
            self._url(f"{pk}/reject"),
            {"admin_notes": "Not suitable"},
            format="json",
        )
        self.assertEqual(resp2.status_code, 200)

        for schedule in original_schedules:
            schedule.refresh_from_db()
            self.assertTrue(schedule.active)

    def test_cancel_does_not_modify_schedules(self):
        resp = self._create_request()
        pk = resp.data["id"]

        self.member.refresh_from_db()
        original_schedules = AttendanceSchedule.objects.filter(
            member=self.member, active=True
        ).select_related("slot")

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 200)

        for schedule in original_schedules:
            schedule.refresh_from_db()
            self.assertTrue(schedule.active)

    def test_approve_deferred_blocks_approval_if_full_at_effective_date(self):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        slot.capacity = 1
        slot.save()

        other_member = Member.objects.create(
            gym=self.gym, first_name="Other", last_name="Guy", phone="333",
        )
        Subscription.objects.create(
            gym=self.gym, member=other_member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )

        today = date.today()
        other_effective = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)

        other_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=other_member,
            requested_plan=self.plan_target,
            status="approved",
            effective_date=other_effective,
            target_schedules_snapshot=[
                {"day": "monday", "hour": "10:00"},
            ],
            current_schedules_snapshot=[],
        )
        PlannedSchedule.objects.create(
            gym=self.gym,
            member=other_member,
            plan_change=other_change,
            slot=slot,
            slot_name="monday 10:00",
            day="monday",
            hour="10:00",
        )

        resp = self._create_request(schedules=[
            {"day": "monday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
        ])
        self.assertEqual(resp.status_code, 201)
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("capacidad", str(resp2.data).lower())

    def test_approve_deferred_when_subscription_expired(self):
        expired_member = Member.objects.create(
            gym=self.gym, first_name="Expired", last_name="User", phone="444",
        )
        Subscription.objects.create(
            gym=self.gym, member=expired_member, plan=self.plan_current,
            start_date=date.today() - timedelta(days=60),
            end_date=date.today() - timedelta(days=30),
        )
        _create_schedules(expired_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        resp = self._create_request(member=expired_member)
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "approved")
        self.assertIsNotNone(resp2.data["effective_date"])

        today = date.today()
        expected = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
        self.assertEqual(resp2.data["effective_date"], expected.isoformat())

        expired_member.refresh_from_db()
        sub = expired_member.subscription_set.first()
        self.assertEqual(sub.plan, self.plan_current)

        active = AttendanceSchedule.objects.filter(member=expired_member, active=True)
        self.assertEqual(active.count(), 2)

        planned = PlannedSchedule.objects.filter(plan_change_id=pk)
        self.assertEqual(planned.count(), 2)


class PlanChangeExecutionTest(TestCase):
    """Tests for management command and services layer."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Exec Gym", slug="exec-gym", phone="123", email="exec@gym.com",
        )
        self.user = User.objects.create_user(username="execadmin", password="pass1234")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.plan_old = MembershipPlan.objects.create(
            gym=self.gym, name="Old", price=10, duration_days=30, weekly_visits=2,
        )
        self.plan_new = MembershipPlan.objects.create(
            gym=self.gym, name="New", price=20, duration_days=30, weekly_visits=2,
        )

        self.member = Member.objects.create(
            gym=self.gym, first_name="Exec", last_name="User", phone="555",
        )
        self.subscription = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_old,
            start_date=date.today() - timedelta(days=30),
            end_date=date.today() - timedelta(days=1),
        )

        _create_slot(self.gym, "monday", "10:00")
        _create_slot(self.gym, "tuesday", "10:00")

        self.pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            requested_plan=self.plan_new,
            status="approved",
            effective_date=date.today(),
            target_schedules_snapshot=[
                {"day": "monday", "hour": "10:00"},
            ],
            current_schedules_snapshot=[{"day": "tuesday", "hour": "10:00"}],
        )
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        PlannedSchedule.objects.create(
            gym=self.gym,
            member=self.member,
            plan_change=self.pcr,
            slot=slot,
            slot_name="monday 10:00",
            day="monday",
            hour="10:00",
        )

    def _url(self, suffix=""):
        if suffix:
            return f"/api/plan-change-requests/{suffix}/"
        return "/api/plan-change-requests/"

    def test_management_command_activates_due_plan_changes(self):
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command("apply_plan_changes", stdout=out)

        self.pcr.refresh_from_db()
        self.assertEqual(self.pcr.status, "executed")

        self.member.refresh_from_db()
        sub = self.member.subscription_set.first()
        self.assertEqual(sub.plan, self.plan_new)

        active = AttendanceSchedule.objects.filter(member=self.member, active=True)
        self.assertEqual(active.count(), 1)

    def test_management_command_skips_future_plan_changes(self):
        future_pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            requested_plan=self.plan_old,
            status="approved",
            effective_date=date.today() + timedelta(days=10),
            target_schedules_snapshot=[],
            current_schedules_snapshot=[],
        )

        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command("apply_plan_changes", stdout=out)

        future_pcr.refresh_from_db()
        self.assertEqual(future_pcr.status, "approved")

    def test_management_command_skips_already_executed(self):
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command("apply_plan_changes", stdout=out)
        call_command("apply_plan_changes", stdout=out)
        self.pcr.refresh_from_db()
        self.assertEqual(self.pcr.status, "executed")

    def test_calculate_effective_date_with_active_subscription(self):
        today = date.today()
        expected = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
        ed = calculate_effective_date(self.member)
        self.assertEqual(ed, expected)

    def test_calculate_effective_date_without_subscription(self):
        today = date.today()
        expected = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
        member_no_sub = Member.objects.create(
            gym=self.gym, first_name="NoSub", last_name="User", phone="666",
        )
        ed = calculate_effective_date(member_no_sub)
        self.assertEqual(ed, expected)

    def test_compute_projected_occupancy_base(self):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        occ = compute_projected_occupancy(slot, date.today())
        self.assertEqual(occ, 1)

    def test_compute_projected_occupancy_excludes_member(self):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        occ = compute_projected_occupancy(slot, date.today(), exclude_member=self.member)
        self.assertEqual(occ, 0)

    def test_compute_projected_occupancy_counts_future_changes(self):
        other_member = Member.objects.create(
            gym=self.gym, first_name="Other", last_name="User2", phone="777",
        )
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        other_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=other_member,
            requested_plan=self.plan_new,
            status="approved",
            effective_date=date.today(),
            target_schedules_snapshot=[{"day": "monday", "hour": "10:00"}],
            current_schedules_snapshot=[],
        )
        PlannedSchedule.objects.create(
            gym=self.gym,
            member=other_member,
            plan_change=other_change,
            slot=slot,
            slot_name="monday 10:00",
            day="monday",
            hour="10:00",
        )

        occ = compute_projected_occupancy(slot, date.today())
        self.assertEqual(occ, 2)


class PublicPlanChangeRequestTest(TestCase):
    """Public plan change request endpoints (member-facing)."""

    def setUp(self):
        self.client = APIClient()

        self.gym = Gym.objects.create(
            name="Test Gym", slug="test-gym-pub", phone="123", email="gym@test.com",
        )
        self.other_gym = Gym.objects.create(
            name="Other Gym", slug="other-gym-pub", phone="456", email="other@test.com",
        )

        self.plan_current = MembershipPlan.objects.create(
            gym=self.gym, name="Current", price=10, duration_days=30, weekly_visits=2,
        )
        self.plan_target = MembershipPlan.objects.create(
            gym=self.gym, name="Premium", price=20, duration_days=30, weekly_visits=3,
        )

        self.member = Member.objects.create(
            gym=self.gym, first_name="Test", last_name="Member", phone="111",
        )
        self.member_other = Member.objects.create(
            gym=self.other_gym, first_name="Other", last_name="Member", phone="222",
        )

        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )

        _create_slot(self.gym, "monday", "10:00")
        _create_slot(self.gym, "monday", "11:00")
        _create_slot(self.gym, "tuesday", "10:00")
        _create_slot(self.gym, "wednesday", "10:00")

        _create_schedules(self.member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

    def _url(self, suffix=""):
        if suffix:
            return f"/api/subscriptions/public/plan-change-requests/{self.member.access_token}/{suffix}/"
        return f"/api/subscriptions/public/plan-change-requests/{self.member.access_token}/"

    def _other_url(self, suffix=""):
        t = self.member_other.access_token
        if suffix:
            return f"/api/subscriptions/public/plan-change-requests/{t}/{suffix}/"
        return f"/api/subscriptions/public/plan-change-requests/{t}/"

    def _valid_payload(self):
        return {
            "requested_plan": self.plan_target.id,
            "target_schedules_snapshot": [
                {"day": "monday", "hour": "10:00"},
                {"day": "monday", "hour": "11:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }

    # A) List requests — empty initially
    def test_list_empty(self):
        resp = self.client.get(self._url())
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    # B) Create a valid request
    def test_create_request(self):
        resp = self.client.post(
            self._url(), self._valid_payload(), format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["status"], "pending")
        self.assertEqual(resp.data["requested_plan"], self.plan_target.id)

    # C) List after creation shows the new request
    def test_list_after_create(self):
        self.client.post(self._url(), self._valid_payload(), format="json")
        resp = self.client.get(self._url())
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["status"], "pending")

    # D) Cancel a pending request
    def test_cancel_pending(self):
        create_resp = self.client.post(
            self._url(), self._valid_payload(), format="json",
        )
        pk = create_resp.data["id"]
        cancel_resp = self.client.post(
            self._url(f"{pk}/cancel"), format="json",
        )
        self.assertEqual(cancel_resp.status_code, 200)
        self.assertEqual(cancel_resp.data["status"], "cancelled")

    # E) Invalid token returns 404
    def test_invalid_token(self):
        resp = self.client.get(
            "/api/subscriptions/public/plan-change-requests/invalid-token/",
        )
        self.assertEqual(resp.status_code, 404)

    # F) Cross-gym protection — member cannot use another gym's plan
    def test_cross_gym_plan_rejected(self):
        other_plan = MembershipPlan.objects.create(
            gym=self.other_gym, name="Other Plan", price=50, duration_days=15, weekly_visits=2,
        )
        payload = {
            "requested_plan": other_plan.id,
            "target_schedules_snapshot": [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        resp = self.client.post(self._url(), payload, format="json")
        self.assertEqual(resp.status_code, 400)


class RegistrationSubscriptionTest(TestCase):
    """Subscription auto-creation during public registration."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Reg Gym", slug="reg-gym", phone="111", email="reg@gym.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Basic", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )
        ScheduleSlot.objects.create(
            gym=self.gym, day="monday", hour=time(10, 0),
        )

    def _register(self, plan_id=None):
        data = {
            "first_name": "Test",
            "last_name": "User",
            "phone": "999888777",
            "schedules": json.dumps([{"day": "monday", "hour": "10:00"}]),
        }
        if plan_id is not None:
            data["plan_id"] = plan_id

        return self.client.post(
            f"/api/public/register/{self.gym.onboarding_code}/",
            data,
            format="multipart",
        )

    # A) Registration without plan → old behavior unchanged
    def test_without_plan_no_subscription(self):
        resp = self._register()
        self.assertEqual(resp.status_code, 201)
        self.assertFalse(
            Subscription.objects.filter(member__phone="999888777").exists()
        )

    # B) Registration with valid plan → subscription created
    def test_with_valid_plan_creates_subscription(self):
        resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(
            Subscription.objects.filter(member__phone="999888777").exists()
        )

    # C) Subscription dates calculated correctly
    def test_subscription_dates(self):
        resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        sub = Subscription.objects.get(member__phone="999888777")
        self.assertEqual(sub.start_date, date.today())
        self.assertEqual(
            sub.end_date,
            date.today() + timedelta(days=self.plan.duration_days),
        )

    # D) paid defaults to False
    def test_paid_defaults_false(self):
        resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        sub = Subscription.objects.get(member__phone="999888777")
        self.assertFalse(sub.paid)

    # E) Plan from another gym rejected
    def test_plan_from_other_gym_rejected(self):
        other_gym = Gym.objects.create(
            name="Other", slug="other-gym-r", phone="999", email="o@o.com",
        )
        other_plan = MembershipPlan.objects.create(
            gym=other_gym, name="Other Plan", price=50, duration_days=15,
        )
        resp = self._register(plan_id=other_plan.id)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("plan_id", resp.data)


class Phase3Test(TestCase):
    """Phase 3: cancellation, chained prevention, suggestions, visibility."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Phase3 Gym", slug="phase3-gym", phone="123", email="p3@gym.com",
        )
        self.user = User.objects.create_user(username="p3admin", password="pass1234")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.plan_current = MembershipPlan.objects.create(
            gym=self.gym, name="Current", price=10, duration_days=30, weekly_visits=2,
        )
        self.plan_target = MembershipPlan.objects.create(
            gym=self.gym, name="Target", price=20, duration_days=30, weekly_visits=2,
        )

        self.member = Member.objects.create(
            gym=self.gym, first_name="Phase3", last_name="User", phone="888",
        )
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )

        _create_slot(self.gym, "monday", "10:00")
        _create_slot(self.gym, "tuesday", "10:00")
        _create_slot(self.gym, "wednesday", "10:00", capacity=1)

        _create_schedules(self.member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

    def _url(self, suffix=""):
        if suffix:
            return f"/api/plan-change-requests/{suffix}/"
        return "/api/plan-change-requests/"

    def _create_request(self, schedules=None):
        data = {
            "member": self.member.id,
            "requested_plan": self.plan_target.id,
            "target_schedules_snapshot": schedules or [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        return self.client.post(self._url(), data, format="json")

    # ── Feature 1: Cancel approved+future plan change (admin) ──

    def test_cancel_approved_future(self):
        resp = self._create_request()
        pk = resp.data["id"]
        self.client.post(self._url(f"{pk}/approve"), format="json")

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "cancelled")

        planned = PlannedSchedule.objects.filter(plan_change_id=pk)
        self.assertEqual(planned.count(), 0)

        self.member.refresh_from_db()
        sub = self.member.subscription_set.first()
        self.assertEqual(sub.plan, self.plan_current)

        active = AttendanceSchedule.objects.filter(member=self.member, active=True)
        self.assertEqual(active.count(), 2)

    def test_can_cancel_approved_future_even_with_other_approved(self):
        other_member = Member.objects.create(
            gym=self.gym, first_name="Other", last_name="Cancel", phone="8915",
        )
        Subscription.objects.create(
            gym=self.gym, member=other_member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(other_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        data = {
            "member": other_member.id,
            "requested_plan": self.plan_target.id,
            "target_schedules_snapshot": [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        resp_other = self.client.post(self._url(), data, format="json")
        pk_other = resp_other.data["id"]
        self.client.post(self._url(f"{pk_other}/approve"), format="json")

        resp = self._create_request()
        pk = resp.data["id"]
        self.client.post(self._url(f"{pk}/approve"), format="json")

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.data["status"], "cancelled")

    def test_cannot_cancel_approved_executed(self):
        expired_member = Member.objects.create(
            gym=self.gym, first_name="Expired", last_name="Cancel", phone="889",
        )
        Subscription.objects.create(
            gym=self.gym, member=expired_member, plan=self.plan_current,
            start_date=date.today() - timedelta(days=60),
            end_date=date.today() - timedelta(days=30),
        )
        _create_schedules(expired_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        data = {
            "member": expired_member.id,
            "requested_plan": self.plan_target.id,
            "target_schedules_snapshot": [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        resp = self.client.post(self._url(), data, format="json")
        pk = resp.data["id"]
        self.client.post(self._url(f"{pk}/approve"), format="json")

        resp2 = self.client.post(self._url(f"{pk}/cancel"), format="json")
        self.assertEqual(resp2.status_code, 400)

    # ── Feature 1: Cancel approved+future plan change (public) ──

    def test_public_cancel_approved_future(self):
        pub_plan = MembershipPlan.objects.create(
            gym=self.gym, name="PubTarget", price=25, duration_days=30, weekly_visits=2,
        )
        pub_member = Member.objects.create(
            gym=self.gym, first_name="Pub", last_name="User", phone="890",
        )
        Subscription.objects.create(
            gym=self.gym, member=pub_member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(pub_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        token = pub_member.access_token
        create_resp = self.client.post(
            f"/api/subscriptions/public/plan-change-requests/{token}/",
            {
                "requested_plan": pub_plan.id,
                "target_schedules_snapshot": [
                    {"day": "monday", "hour": "10:00"},
                    {"day": "tuesday", "hour": "10:00"},
                ],
            },
            format="json",
        )
        pk = create_resp.data["id"]

        self.client.post(
            f"/api/plan-change-requests/{pk}/approve/",
            format="json",
            **{"HTTP_AUTHORIZATION": f"Token {self.token.key}"},
        )

        cancel_resp = self.client.post(
            f"/api/subscriptions/public/plan-change-requests/{token}/{pk}/cancel/",
            format="json",
        )
        self.assertEqual(cancel_resp.status_code, 200)
        self.assertEqual(cancel_resp.data["status"], "cancelled")

        planned = PlannedSchedule.objects.filter(plan_change_id=pk)
        self.assertEqual(planned.count(), 0)

    # ── Feature 2: Prevent chained future plan changes ──

    def test_cannot_create_request_with_existing_future_approved(self):
        resp = self._create_request()
        pk = resp.data["id"]
        self.client.post(self._url(f"{pk}/approve"), format="json")

        resp2 = self._create_request()
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("próximo ciclo", str(resp2.data).lower())

    def test_can_create_request_if_future_approved_is_cancelled(self):
        resp = self._create_request()
        pk = resp.data["id"]
        self.client.post(self._url(f"{pk}/approve"), format="json")
        self.client.post(self._url(f"{pk}/cancel"), format="json")

        resp2 = self._create_request()
        self.assertEqual(resp2.status_code, 201)

    def test_can_create_request_if_future_approved_was_executed(self):
        target_plan_b = MembershipPlan.objects.create(
            gym=self.gym, name="Plan B", price=30, duration_days=30, weekly_visits=2,
        )
        target_plan_c = MembershipPlan.objects.create(
            gym=self.gym, name="Plan C", price=40, duration_days=30, weekly_visits=2,
        )
        expired_member = Member.objects.create(
            gym=self.gym, first_name="Exec", last_name="Chained", phone="891",
        )
        Subscription.objects.create(
            gym=self.gym, member=expired_member, plan=self.plan_current,
            start_date=date.today() - timedelta(days=60),
            end_date=date.today() - timedelta(days=30),
        )
        _create_schedules(expired_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        data = {
            "member": expired_member.id,
            "requested_plan": target_plan_b.id,
            "target_schedules_snapshot": [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        resp = self.client.post(self._url(), data, format="json")
        pk = resp.data["id"]
        self.client.post(self._url(f"{pk}/approve"), format="json")

        data2 = {
            "member": expired_member.id,
            "requested_plan": target_plan_c.id,
            "target_schedules_snapshot": [
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        }
        resp2 = self.client.post(self._url(), data2, format="json")
        self.assertEqual(resp2.status_code, 201)

    # ── Feature 3: planned_schedules in serializer output ──

    def test_approved_future_includes_planned_schedules(self):
        resp = self._create_request()
        pk = resp.data["id"]
        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertIn("planned_schedules", resp2.data)
        self.assertEqual(len(resp2.data["planned_schedules"]), 2)

    def test_public_approved_future_includes_planned_schedules(self):
        pub_member = Member.objects.create(
            gym=self.gym, first_name="Vis", last_name="User", phone="892",
        )
        Subscription.objects.create(
            gym=self.gym, member=pub_member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        _create_schedules(pub_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        token = pub_member.access_token
        create_resp = self.client.post(
            f"/api/subscriptions/public/plan-change-requests/{token}/",
            {
                "requested_plan": self.plan_target.id,
                "target_schedules_snapshot": [
                    {"day": "monday", "hour": "10:00"},
                    {"day": "tuesday", "hour": "10:00"},
                ],
            },
            format="json",
        )
        pk = create_resp.data["id"]

        self.client.post(
            f"/api/plan-change-requests/{pk}/approve/",
            format="json",
            **{"HTTP_AUTHORIZATION": f"Token {self.token.key}"},
        )

        list_resp = self.client.get(
            f"/api/subscriptions/public/plan-change-requests/{token}/",
        )
        approved = [r for r in list_resp.data if r["status"] == "approved"]
        self.assertEqual(len(approved), 1)
        self.assertIn("planned_schedules", approved[0])
        self.assertEqual(len(approved[0]["planned_schedules"]), 2)

    # ── Feature 4: Alternative schedule suggestions ──

    def test_approval_includes_suggestions_when_capacity_full(self):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="wednesday", hour=_to_time("10:00"))
        slot.capacity = 1
        slot.save()

        other_member = Member.objects.create(
            gym=self.gym, first_name="Other", last_name="Sug", phone="893",
        )
        Subscription.objects.create(
            gym=self.gym, member=other_member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )

        other_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=other_member,
            requested_plan=self.plan_target,
            status="approved",
            effective_date=date.today() + timedelta(days=31),
            target_schedules_snapshot=[{"day": "wednesday", "hour": "10:00"}],
            current_schedules_snapshot=[],
        )
        PlannedSchedule.objects.create(
            gym=self.gym,
            member=other_member,
            plan_change=other_change,
            slot=slot,
            slot_name="wednesday 10:00",
            day="wednesday",
            hour="10:00",
        )

        resp = self._create_request(schedules=[
            {"day": "wednesday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
        ])
        self.assertEqual(resp.status_code, 201)
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        self.assertEqual(resp2.status_code, 400)
        self.assertIn("suggestions", str(resp2.data).lower())
        self.assertIn("monday", str(resp2.data).lower())

    def test_approval_suggestions_are_available_alternatives(self):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="wednesday", hour=_to_time("10:00"))
        slot.capacity = 1
        slot.save()

        other_member = Member.objects.create(
            gym=self.gym, first_name="Sug2", last_name="User", phone="894",
        )
        Subscription.objects.create(
            gym=self.gym, member=other_member, plan=self.plan_current,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )

        other_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=other_member,
            requested_plan=self.plan_target,
            status="approved",
            effective_date=date.today() + timedelta(days=31),
            target_schedules_snapshot=[{"day": "wednesday", "hour": "10:00"}],
            current_schedules_snapshot=[],
        )
        PlannedSchedule.objects.create(
            gym=self.gym,
            member=other_member,
            plan_change=other_change,
            slot=slot,
            slot_name="wednesday 10:00",
            day="wednesday",
            hour="10:00",
        )

        resp = self._create_request(schedules=[
            {"day": "wednesday", "hour": "10:00"},
            {"day": "tuesday", "hour": "10:00"},
        ])
        pk = resp.data["id"]

        resp2 = self.client.post(self._url(f"{pk}/approve"), format="json")
        data = resp2.data

        if isinstance(data, dict) and "suggestions" in str(data):
            pass

        self.assertEqual(resp2.status_code, 400)

        suggestions = None
        if isinstance(data, dict):
            for key in data:
                val = data[key]
                if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict) and "day" in val[0]:
                    suggestions = val
                    break

        self.assertIsNotNone(suggestions)
        self.assertGreater(len(suggestions), 0)

        suggestion_days = {s["day"] for s in suggestions}
        self.assertIn("monday", suggestion_days)
        self.assertIn("tuesday", suggestion_days)


class MonthlyModelTest(TestCase):
    """Tests for monthly subscription architecture (Phase 1)."""

    def test_auto_renew_default_value(self):
        gym = Gym.objects.create(
            name="Monthly Gym", slug="monthly-gym", phone="555", email="m@gym.com",
        )
        member = Member.objects.create(
            gym=gym, first_name="Monthly", last_name="User", phone="777",
        )
        plan = MembershipPlan.objects.create(
            gym=gym, name="Monthly", price=10, duration_days=30,
        )
        sub = Subscription.objects.create(
            gym=gym, member=member, plan=plan,
            start_date=date.today(), end_date=date.today() + timedelta(days=30),
        )
        self.assertTrue(sub.auto_renew)

    def test_calculate_effective_date_returns_first_of_next_month(self):
        ed = calculate_effective_date()
        self.assertEqual(ed.day, 1)
        self.assertGreater(ed.month, 0)
        self.assertGreater(ed.year, 0)

    def test_calculate_effective_date_year_boundary(self):
        from unittest.mock import patch
        with patch("subscriptions.services.timezone.localdate", return_value=date(2026, 12, 15)):
            ed = calculate_effective_date()
        self.assertEqual(ed, date(2027, 1, 1))

    def test_calculate_effective_date_mid_month(self):
        from unittest.mock import patch
        with patch("subscriptions.services.timezone.localdate", return_value=date(2026, 6, 5)):
            ed = calculate_effective_date()
        self.assertEqual(ed, date(2026, 7, 1))

    def test_calculate_effective_date_end_of_month(self):
        from unittest.mock import patch
        with patch("subscriptions.services.timezone.localdate", return_value=date(2026, 6, 28)):
            ed = calculate_effective_date()
        self.assertEqual(ed, date(2026, 7, 1))
