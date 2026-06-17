import json
import unittest

from decimal import Decimal

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
from subscriptions.services import calculate_effective_date, compute_projected_occupancy, get_last_day_of_month, get_first_day_of_next_month


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
        self.assertEqual(resp2.data["status"], "cancelled_by_staff")

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
        self.assertEqual(resp2.data["status"], "cancelled_by_staff")

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
                member=self.member, status="cancelled_by_staff"
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
        self.assertEqual(sub.plan, self.plan_old)

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
            paid=True,
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
        self.assertEqual(cancel_resp.data["status"], "cancelled_by_member")

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

    # C) Subscription dates calculated correctly (calendar month)
    def test_subscription_dates(self):
        resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        sub = Subscription.objects.get(member__phone="999888777")
        self.assertEqual(sub.start_date, date.today())
        self.assertEqual(
            sub.end_date,
            get_last_day_of_month(date.today()),
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

    # ── Prorated amount tests ──

    def test_registration_returns_prorated_amount(self):
        resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        self.assertIn("prorated_amount", resp.data)
        self.assertIn("plan_price", resp.data)

    def test_join_on_first_of_month_pays_full_price(self):
        from unittest.mock import patch
        with patch("members.public_views.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        prorated = Decimal(resp.data["prorated_amount"])
        self.assertEqual(prorated, Decimal("100.00"))

    def test_join_mid_month_returns_partial_prorated_amount(self):
        from unittest.mock import patch
        with patch("members.public_views.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 15)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        prorated = Decimal(resp.data["prorated_amount"])
        self.assertEqual(prorated, Decimal("53.33"))

    def test_join_on_last_day_of_month_pays_one_day(self):
        from unittest.mock import patch
        with patch("members.public_views.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 30)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            resp = self._register(plan_id=self.plan.id)
        self.assertEqual(resp.status_code, 201)
        prorated = Decimal(resp.data["prorated_amount"])
        self.assertEqual(prorated, Decimal("3.33"))


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
        self.assertEqual(resp2.data["status"], "cancelled_by_staff")

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
        self.assertEqual(resp2.data["status"], "cancelled_by_staff")

    def test_cannot_cancel_approved_executed(self):
        executed_member = Member.objects.create(
            gym=self.gym, first_name="Executed", last_name="Cancel", phone="889",
        )
        Subscription.objects.create(
            gym=self.gym, member=executed_member, plan=self.plan_current,
            start_date=date.today() - timedelta(days=60),
            end_date=date.today() - timedelta(days=30),
        )
        _create_schedules(executed_member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

        pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=executed_member,
            requested_plan=self.plan_target,
            status="executed",
            effective_date=date.today() - timedelta(days=1),
            target_schedules_snapshot=[{"day": "monday", "hour": "10:00"}, {"day": "tuesday", "hour": "10:00"}],
            current_schedules_snapshot=[],
        )

        resp2 = self.client.post(self._url(f"{pcr.id}/cancel"), format="json")
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
            paid=True,
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
        self.assertEqual(cancel_resp.data["status"], "cancelled_by_member")

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

        pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=expired_member,
            requested_plan=target_plan_b,
            status="executed",
            effective_date=date.today() - timedelta(days=1),
            target_schedules_snapshot=[{"day": "monday", "hour": "10:00"}, {"day": "tuesday", "hour": "10:00"}],
            current_schedules_snapshot=[],
        )

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
            paid=True,
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

        effective_date = calculate_effective_date(self.member)
        other_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=other_member,
            requested_plan=self.plan_target,
            status="approved",
            effective_date=effective_date,
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

        effective_date = calculate_effective_date(self.member)
        other_change = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=other_member,
            requested_plan=self.plan_target,
            status="approved",
            effective_date=effective_date,
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


class MonthlySubscriptionPhase2Test(TestCase):
    """Phase 2: Calendar-month periods for serializer, renew, and registration."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Phase2 Gym", slug="phase2-gym", phone="123", email="p2@gym.com",
        )
        self.user = User.objects.create_user(username="p2admin", password="pass1234")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Monthly", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )

        self.member = Member.objects.create(
            gym=self.gym, first_name="Phase2", last_name="Member", phone="111",
        )

        _create_slot(self.gym, "monday", "10:00")
        _create_slot(self.gym, "tuesday", "10:00")

    # ── SubscriptionSerializer.create() ──

    def test_serializer_create_sets_end_date_to_last_day_of_month(self):
        resp = self.client.post("/api/subscriptions/", {
            "member": self.member.id,
            "plan": self.plan.id,
            "start_date": date(2026, 6, 5).isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["end_date"], "2026-06-30")

    def test_serializer_create_january_end_date(self):
        resp = self.client.post("/api/subscriptions/", {
            "member": self.member.id,
            "plan": self.plan.id,
            "start_date": date(2026, 1, 15).isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["end_date"], "2026-01-31")

    def test_serializer_create_february_non_leap(self):
        resp = self.client.post("/api/subscriptions/", {
            "member": self.member.id,
            "plan": self.plan.id,
            "start_date": date(2026, 2, 1).isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["end_date"], "2026-02-28")

    # ── SubscriptionViewSet.renew() ──

    def test_renew_creates_next_month_subscription(self):
        sub = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 6, 1), end_date=date(2026, 6, 30),
            paid=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.views.now") as mock_now:
            mock_now.return_value.date.return_value = date(2026, 6, 15)
            resp = self.client.post(f"/api/subscriptions/{sub.id}/renew/", format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["start_date"], "2026-07-01")
        self.assertEqual(resp.data["end_date"], "2026-07-31")

    def test_renew_across_year_boundary(self):
        sub = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 12, 1), end_date=date(2026, 12, 31),
            paid=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.views.now") as mock_now:
            mock_now.return_value.date.return_value = date(2026, 12, 15)
            resp = self.client.post(f"/api/subscriptions/{sub.id}/renew/", format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["start_date"], "2027-01-01")
        self.assertEqual(resp.data["end_date"], "2027-01-31")

    def test_renew_leap_year_february(self):
        sub = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2028, 1, 1), end_date=date(2028, 1, 31),
            paid=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.views.now") as mock_now:
            mock_now.return_value.date.return_value = date(2028, 1, 31)
            resp = self.client.post(f"/api/subscriptions/{sub.id}/renew/", format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["start_date"], "2028-02-01")
        self.assertEqual(resp.data["end_date"], "2028-02-29")


class AutoRenewCommandTest(TestCase):
    """Tests for the auto_renew_subscriptions management command."""

    def setUp(self):
        self.gym = Gym.objects.create(
            name="Auto Gym", slug="auto-gym", phone="123", email="auto@gym.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Monthly", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )
        self.member = Member.objects.create(
            gym=self.gym, first_name="Auto", last_name="User", phone="001",
        )

    def _run_command(self):
        from io import StringIO
        from django.core.management import call_command
        out = StringIO()
        call_command("auto_renew_subscriptions", stdout=out)
        return out.getvalue()

    def _get_month_range(self, year, month):
        from calendar import monthrange
        last = monthrange(year, month)[1]
        return date(year, month, 1), date(year, month, last)

    # 1) Renews eligible members — creates NEXT month subscription
    def test_renews_eligible_member(self):
        start, end = self._get_month_range(2026, 5)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start, end_date=end, auto_renew=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.management.commands.auto_renew_subscriptions.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            output = self._run_command()

        self.assertIn("Created: 1", output)
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 2,
        )
        new_sub = Subscription.objects.filter(member=self.member).order_by("-id").first()
        self.assertEqual(new_sub.start_date, date(2026, 7, 1))
        self.assertEqual(new_sub.end_date, date(2026, 7, 31))
        self.assertFalse(new_sub.paid)

    # 2) Skips auto_renew=False
    def test_skips_auto_renew_false(self):
        start, end = self._get_month_range(2026, 5)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start, end_date=end, auto_renew=False,
        )
        from unittest.mock import patch
        with patch("subscriptions.management.commands.auto_renew_subscriptions.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            output = self._run_command()

        self.assertIn("Skipped auto_renew=False: 1", output)
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 1,
        )

    # 3) Skips members already renewed — duplicate on next month
    def test_skips_already_renewed(self):
        start, end = self._get_month_range(2026, 5)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start, end_date=end, auto_renew=True,
        )
        july_start, july_end = self._get_month_range(2026, 7)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=july_start, end_date=july_end, auto_renew=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.management.commands.auto_renew_subscriptions.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 15)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            output = self._run_command()

        self.assertIn("Created: 0", output)
        self.assertIn("Skipped already renewed: 1", output)

    # 4) Idempotency — running twice produces same result
    def test_idempotent(self):
        start, end = self._get_month_range(2026, 5)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start, end_date=end, auto_renew=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.management.commands.auto_renew_subscriptions.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            self._run_command()
            output2 = self._run_command()

        self.assertIn("Created: 0", output2)
        self.assertIn("Skipped already renewed: 1", output2)
        self.assertEqual(
            Subscription.objects.filter(member=self.member).count(), 2,
        )

    # 5) Year boundary (December → January)
    def test_year_boundary(self):
        start, end = self._get_month_range(2026, 12)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start, end_date=end, auto_renew=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.management.commands.auto_renew_subscriptions.date") as mock_date:
            mock_date.today.return_value = date(2027, 1, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            output = self._run_command()

        self.assertIn("Created: 1", output)
        new_sub = Subscription.objects.filter(member=self.member).order_by("-id").first()
        self.assertEqual(new_sub.start_date, date(2027, 2, 1))
        self.assertEqual(new_sub.end_date, date(2027, 2, 28))

    # 6) Leap year safety (February 29)
    def test_leap_year_safety(self):
        start, end = self._get_month_range(2028, 1)
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start, end_date=end, auto_renew=True,
        )
        from unittest.mock import patch
        with patch("subscriptions.management.commands.auto_renew_subscriptions.date") as mock_date:
            mock_date.today.return_value = date(2028, 1, 16)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            output = self._run_command()

        self.assertIn("Created: 1", output)
        new_sub = Subscription.objects.filter(member=self.member).order_by("-id").first()
        self.assertEqual(new_sub.start_date, date(2028, 2, 1))
        self.assertEqual(new_sub.end_date, date(2028, 2, 29))


class Phase3BTest(TestCase):
    """Phase 3B: Plan Change Execution on Monthly Renewals — immutability."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Phase3B Gym", slug="phase3b-gym", phone="123", email="p3b@gym.com",
        )
        self.user = User.objects.create_user(username="p3badmin", password="pass1234")
        self.user.profile.gym = self.gym
        self.user.profile.save()
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.plan_old = MembershipPlan.objects.create(
            gym=self.gym, name="Current", price=10, duration_days=30, weekly_visits=2,
        )
        self.plan_new = MembershipPlan.objects.create(
            gym=self.gym, name="Premium", price=20, duration_days=30, weekly_visits=2,
        )

        self.member = Member.objects.create(
            gym=self.gym, first_name="P3B", last_name="User", phone="555",
        )
        self.june_sub = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_old,
            start_date=date(2026, 6, 1), end_date=date(2026, 6, 30),
            auto_renew=True,
        )

        _create_slot(self.gym, "monday", "10:00")
        _create_slot(self.gym, "tuesday", "10:00")
        _create_schedules(self.member, self.gym, [
            ("monday", "10:00"), ("tuesday", "10:00"),
        ])

    def _create_approved_pcr(self, effective_date):
        slot = ScheduleSlot.objects.get(gym=self.gym, day="monday", hour=_to_time("10:00"))
        pcr = PlanChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            requested_plan=self.plan_new,
            status="approved",
            effective_date=effective_date,
            target_schedules_snapshot=[
                {"day": "monday", "hour": "10:00"},
            ],
            current_schedules_snapshot=[
                {"day": "monday", "hour": "10:00"},
                {"day": "tuesday", "hour": "10:00"},
            ],
        )
        PlannedSchedule.objects.create(
            gym=self.gym,
            member=self.member,
            plan_change=pcr,
            slot=slot,
            slot_name="monday 10:00",
            day="monday",
            hour="10:00",
        )
        return pcr

    def _run_auto_renew(self, today):
        from io import StringIO
        from django.core.management import call_command
        with unittest.mock.patch(
            "subscriptions.management.commands.auto_renew_subscriptions.date"
        ) as mock_date:
            mock_date.today.return_value = today
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            out = StringIO()
            call_command("auto_renew_subscriptions", stdout=out)
            return out.getvalue()

    def _run_apply_plan_changes(self, today):
        from io import StringIO
        from django.core.management import call_command
        with unittest.mock.patch(
            "subscriptions.management.commands.apply_plan_changes.now"
        ) as mock_now:
            mock_now.return_value.date.return_value = today
            out = StringIO()
            call_command("apply_plan_changes", stdout=out)
            return out.getvalue()

    def test_approved_pcr_causes_new_subscription_to_use_new_plan(self):
        """approved PCR causes July subscription to use new plan"""
        self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))

        july_sub = Subscription.objects.get(
            member=self.member, start_date=date(2026, 7, 1),
        )
        self.assertEqual(july_sub.plan, self.plan_new)

    def test_old_subscription_remains_unchanged(self):
        """old June subscription remains unchanged"""
        self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))
        self.june_sub.refresh_from_db()
        self.assertEqual(self.june_sub.plan, self.plan_old)

    def test_apply_plan_change_does_not_mutate_any_subscription(self):
        """apply_plan_change does not mutate any subscription plan"""
        self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))
        self._run_apply_plan_changes(date(2026, 7, 1))

        self.june_sub.refresh_from_db()
        self.assertEqual(self.june_sub.plan, self.plan_old)

        july_sub = Subscription.objects.get(
            member=self.member, start_date=date(2026, 7, 1),
        )
        self.assertEqual(july_sub.plan, self.plan_new)

    def test_schedule_activation_still_works(self):
        """schedule activation still works after apply_plan_change"""
        self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))
        self._run_apply_plan_changes(date(2026, 7, 1))

        active_schedules = AttendanceSchedule.objects.filter(
            member=self.member, active=True,
        )
        self.assertEqual(active_schedules.count(), 1)
        self.assertEqual(active_schedules.first().slot.day, "monday")

    def test_pcr_becomes_executed(self):
        """PCR becomes executed"""
        pcr = self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))
        self._run_apply_plan_changes(date(2026, 7, 1))

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")

    def test_planned_schedule_activated(self):
        """PlannedSchedule records are activated"""
        pcr = self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))
        self._run_apply_plan_changes(date(2026, 7, 1))

        ps = PlannedSchedule.objects.get(plan_change=pcr)
        self.assertTrue(ps.activated)

    def test_full_lifecycle(self):
        """Complete lifecycle: auto_renew then apply_plan_change"""
        pcr = self._create_approved_pcr(date(2026, 7, 1))
        self._run_auto_renew(date(2026, 6, 16))
        self._run_apply_plan_changes(date(2026, 7, 1))

        pcr.refresh_from_db()
        self.assertEqual(pcr.status, "executed")

        july_sub = Subscription.objects.get(
            member=self.member, start_date=date(2026, 7, 1),
        )
        self.assertEqual(july_sub.plan, self.plan_new)
        self.assertFalse(july_sub.paid)

        self.june_sub.refresh_from_db()
        self.assertEqual(self.june_sub.plan, self.plan_old)
        self.assertEqual(self.june_sub.start_date, date(2026, 6, 1))
        self.assertEqual(self.june_sub.end_date, date(2026, 6, 30))

    def test_auto_renew_skips_member_without_pcr(self):
        """auto_renew uses old plan when no approved PCR exists"""
        self._run_auto_renew(date(2026, 6, 16))

        july_sub = Subscription.objects.get(
            member=self.member, start_date=date(2026, 7, 1),
        )
        self.assertEqual(july_sub.plan, self.plan_old)

    def test_auto_renew_honours_pcr_with_effective_date_in_past(self):
        """approved PCR with effective_date <= renewal month start is respected"""
        self._create_approved_pcr(date(2026, 6, 30))

        self._run_auto_renew(date(2026, 6, 16))

        july_sub = Subscription.objects.get(
            member=self.member, start_date=date(2026, 7, 1),
        )
        self.assertEqual(july_sub.plan, self.plan_new)

    def test_june_run_creates_july_subscription(self):
        """regression: today=2026-06-16 creates July (not June) subscription"""
        self._run_auto_renew(date(2026, 6, 16))

        july_sub = Subscription.objects.get(
            member=self.member, start_date=date(2026, 7, 1),
        )
        self.assertEqual(july_sub.end_date, date(2026, 7, 31))
        self.assertFalse(july_sub.paid)

        no_june_sub = Subscription.objects.filter(
            member=self.member, start_date=date(2026, 6, 1),
        ).exclude(id=self.june_sub.id)
        self.assertEqual(no_june_sub.count(), 0)

    def test_december_run_creates_january_subscription(self):
        """regression: year boundary — Dec run creates January next year"""
        self.dec_sub = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan_old,
            start_date=date(2026, 12, 1), end_date=date(2026, 12, 31),
            auto_renew=True,
        )

        self._run_auto_renew(date(2026, 12, 16))

        jan_sub = Subscription.objects.get(
            member=self.member, start_date=date(2027, 1, 1),
        )
        self.assertEqual(jan_sub.end_date, date(2027, 1, 31))
        self.assertEqual(jan_sub.plan, self.plan_old)
        self.assertFalse(jan_sub.paid)


class AutoRenewalCancelTest(TestCase):
    """Tests for cancel/enable auto-renewal endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.gym = Gym.objects.create(
            name="Cancel Gym", slug="cancel-gym", phone="123", email="cancel@gym.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Monthly", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )
        self.member = Member.objects.create(
            gym=self.gym, first_name="Cancel", last_name="Test", phone="001",
        )
        self.subscription = Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date.today() - timedelta(days=10),
            end_date=date.today() + timedelta(days=20),
            paid=True,
            auto_renew=True,
        )

    def _cancel_url(self, token):
        return f"/api/subscriptions/public/cancel-renewal/{token}/"

    def _enable_url(self, token):
        return f"/api/subscriptions/public/enable-renewal/{token}/"

    def test_cancel_renewal_sets_auto_renew_false(self):
        resp = self.client.post(self._cancel_url(self.member.access_token))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("cancelada", resp.data["message"].lower())
        self.subscription.refresh_from_db()
        self.assertFalse(self.subscription.auto_renew)

    def test_enable_renewal_sets_auto_renew_true(self):
        self.subscription.auto_renew = False
        self.subscription.save(update_fields=["auto_renew"])
        resp = self.client.post(self._enable_url(self.member.access_token))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("reactivada", resp.data["message"].lower())
        self.subscription.refresh_from_db()
        self.assertTrue(self.subscription.auto_renew)

    def test_auto_renew_command_skips_cancelled_subscriptions(self):
        self.subscription.auto_renew = False
        self.subscription.save(update_fields=["auto_renew"])
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command("auto_renew_subscriptions", stdout=out)
        self.assertIn("Skipped auto_renew=False: 1", out.getvalue())

    def test_cancel_twice_returns_success(self):
        self.subscription.auto_renew = False
        self.subscription.save(update_fields=["auto_renew"])
        resp = self.client.post(self._cancel_url(self.member.access_token))
        self.assertEqual(resp.status_code, 200)

    def test_enable_twice_returns_success(self):
        resp = self.client.post(self._enable_url(self.member.access_token))
        self.assertEqual(resp.status_code, 200)
        self.assertIn("activa", resp.data["message"].lower())

    def test_inactive_member_no_subscription(self):
        member_no_sub = Member.objects.create(
            gym=self.gym, first_name="NoSub", last_name="User", phone="999",
        )
        resp = self.client.post(self._cancel_url(member_no_sub.access_token))
        self.assertEqual(resp.status_code, 404)

    def test_portal_exposes_auto_renew_state(self):
        from routines.models import RoutineAssignment, RoutineTemplate
        template = RoutineTemplate.objects.create(
            gym=self.gym, name="Test Routine",
        )
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member,
            routine_template=template, active=True,
        )
        resp = self.client.get(f"/api/routines/public/{self.member.access_token}/")
        self.assertEqual(resp.status_code, 200)
        sub_data = resp.data.get("subscription")
        self.assertIsNotNone(sub_data)
        self.assertIn("auto_renew", sub_data)
        self.assertTrue(sub_data["auto_renew"])


class RenewalReminderTest(TestCase):
    """Targeted tests for renewal reminder in the member dashboard."""

    def setUp(self):
        self.gym = Gym.objects.create(
            name="Reminder Gym", slug="reminder-gym", phone="123", email="reminder@gym.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Monthly", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )
        self.member = Member.objects.create(
            gym=self.gym, first_name="Reminder", last_name="Test", phone="001",
        )
        from routines.models import RoutineAssignment, RoutineTemplate
        template = RoutineTemplate.objects.create(
            gym=self.gym, name="Test Routine",
        )
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member,
            routine_template=template, active=True,
        )

    def _get_dashboard(self):
        return self.client.get(
            f"/api/routines/public/{self.member.access_token}/",
        )

    def _set_today(self, target_date):
        from unittest.mock import patch
        from django.utils import timezone
        self.enterContext(
            patch.object(timezone, "localdate", return_value=target_date)
        )

    def test_reminder_true_within_7_days_auto_renew(self):
        """renewal_reminder True when end_date within 7 days and auto_renew=True"""
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 30),
            auto_renew=True,
        )
        with self._subtest_today(date(2026, 6, 23)):
            resp = self._get_dashboard()
            sub = resp.data["subscription"]
            self.assertTrue(sub["renewal_reminder"])
            self.assertEqual(sub["renewal_date"], "2026-07-01")

    def test_reminder_true_on_last_day(self):
        """renewal_reminder True on end_date itself"""
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 30),
            auto_renew=True,
        )
        with self._subtest_today(date(2026, 6, 30)):
            resp = self._get_dashboard()
            sub = resp.data["subscription"]
            self.assertTrue(sub["renewal_reminder"])
            self.assertEqual(sub["renewal_date"], "2026-07-01")

    def test_reminder_false_outside_7_days(self):
        """renewal_reminder False when end_date > 7 days away"""
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 30),
            auto_renew=True,
        )
        with self._subtest_today(date(2026, 6, 22)):
            resp = self._get_dashboard()
            sub = resp.data["subscription"]
            self.assertFalse(sub["renewal_reminder"])
            self.assertIsNone(sub["renewal_date"])

    def test_reminder_false_auto_renew_disabled(self):
        """renewal_reminder False when auto_renew=False even within 7 days"""
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 30),
            auto_renew=False,
        )
        with self._subtest_today(date(2026, 6, 23)):
            resp = self._get_dashboard()
            sub = resp.data["subscription"]
            self.assertFalse(sub["renewal_reminder"])
            self.assertIsNone(sub["renewal_date"])

    def test_reminder_false_no_subscription(self):
        """renewal_reminder absent when no subscription exists"""
        with self._subtest_today(date(2026, 6, 23)):
            resp = self._get_dashboard()
            self.assertIsNone(resp.data["subscription"])

    def test_reminder_false_expired_subscription_no_reminder(self):
        """renewal_reminder False for already expired subscription"""
        Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=date(2026, 5, 1),
            end_date=date(2026, 5, 31),
            auto_renew=True,
        )
        with self._subtest_today(date(2026, 6, 23)):
            resp = self._get_dashboard()
            sub = resp.data["subscription"]
            self.assertFalse(sub["renewal_reminder"])
            self.assertIsNone(sub["renewal_date"])

    def _subtest_today(self, target_date):
        from unittest.mock import patch
        from django.utils import timezone
        return patch.object(timezone, "localdate", return_value=target_date)


class PaymentStatusTest(TestCase):
    """Targeted tests for payment status detection."""

    def setUp(self):
        self.gym = Gym.objects.create(
            name="Pay Gym", slug="pay-gym", phone="123", email="pay@gym.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Monthly", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )
        self.member = Member.objects.create(
            gym=self.gym, first_name="Pay", last_name="Test", phone="001",
        )
        from routines.models import RoutineAssignment, RoutineTemplate
        template = RoutineTemplate.objects.create(
            gym=self.gym, name="Test Routine",
        )
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member,
            routine_template=template, active=True,
        )

    def _create_sub(self, paid=True, start_date=None, end_date=None):
        if start_date is None:
            start_date = date(2026, 6, 1)
        if end_date is None:
            end_date = date(2026, 6, 30)
        return Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start_date, end_date=end_date,
            paid=paid, auto_renew=True,
        )

    def _get_dashboard(self):
        return self.client.get(
            f"/api/routines/public/{self.member.access_token}/",
        )

    def _mock_today(self, target_date):
        from unittest.mock import patch
        from django.utils import timezone
        return patch.object(timezone, "localdate", return_value=target_date)

    def test_status_paid(self):
        self._create_sub(paid=True)
        with self._mock_today(date(2026, 6, 5)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "paid")

    def test_status_pending_before_day_10(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 5)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "pending")

    def test_status_overdue_after_day_10(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 15)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "overdue")

    def test_status_overdue_on_day_11(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 11)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "overdue")

    def test_status_pending_on_day_10(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 10)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "pending")

    def test_status_overdue_on_day_15(self):
        """day 15 is the last day of grace period → overdue"""
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 15)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "overdue")

    def test_status_blocked_on_day_16(self):
        """day 16 → blocked"""
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 16)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "blocked")

    def test_status_blocked_later_in_month(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 25)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "blocked")

    def test_paid_overrides_all_statuses(self):
        """paid subscription always shows 'paid' regardless of day"""
        self._create_sub(paid=True)
        with self._mock_today(date(2026, 6, 25)):
            resp = self._get_dashboard()
            self.assertEqual(resp.data["subscription"]["payment_status"], "paid")

    def test_helper_paid(self):
        from subscriptions.services import get_subscription_payment_status
        sub = self._create_sub(paid=True)
        self.assertEqual(get_subscription_payment_status(sub), "paid")

    def test_helper_pending(self):
        from subscriptions.services import get_subscription_payment_status
        sub = self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 5)):
            self.assertEqual(get_subscription_payment_status(sub), "pending")

    def test_helper_overdue(self):
        from subscriptions.services import get_subscription_payment_status
        sub = self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 15)):
            self.assertEqual(get_subscription_payment_status(sub), "overdue")

    def test_helper_blocked(self):
        from subscriptions.services import get_subscription_payment_status
        sub = self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 20)):
            self.assertEqual(get_subscription_payment_status(sub), "blocked")


class BlockedMemberAccessTest(TestCase):
    """Focused tests for blocked member access restrictions."""

    def setUp(self):
        self.gym = Gym.objects.create(
            name="Block Gym", slug="block-gym", phone="123", email="block@gym.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym, name="Monthly", price=100, duration_days=30,
            weekly_visits=None, active=True,
        )
        self.member = Member.objects.create(
            gym=self.gym, first_name="Block", last_name="Test", phone="001",
        )
        from routines.models import RoutineAssignment, RoutineTemplate
        template = RoutineTemplate.objects.create(
            gym=self.gym, name="Test Routine",
        )
        RoutineAssignment.objects.create(
            gym=self.gym, member=self.member,
            routine_template=template, active=True,
        )

    def _create_sub(self, paid=True, start_date=None, end_date=None):
        if start_date is None:
            start_date = date(2026, 6, 1)
        if end_date is None:
            end_date = date(2026, 6, 30)
        return Subscription.objects.create(
            gym=self.gym, member=self.member, plan=self.plan,
            start_date=start_date, end_date=end_date,
            paid=paid, auto_renew=True,
        )

    def _mock_today(self, target_date):
        from unittest.mock import patch
        from django.utils import timezone
        return patch.object(timezone, "localdate", return_value=target_date)

    # --- can_member_operate helper ---

    def test_helper_blocked_returns_false(self):
        from subscriptions.services import can_member_operate
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 20)):
            self.assertFalse(can_member_operate(self.member))

    def test_helper_overdue_returns_true(self):
        from subscriptions.services import can_member_operate
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 12)):
            self.assertTrue(can_member_operate(self.member))

    def test_helper_paid_returns_true(self):
        from subscriptions.services import can_member_operate
        self._create_sub(paid=True)
        self.assertTrue(can_member_operate(self.member))

    def test_helper_pending_returns_true(self):
        from subscriptions.services import can_member_operate
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 5)):
            self.assertTrue(can_member_operate(self.member))

    def test_helper_no_subscription_returns_true(self):
        from subscriptions.services import can_member_operate
        self.assertTrue(can_member_operate(self.member))

    # --- blocked member receives 403 on write endpoints ---

    def test_blocked_plan_change_create_returns_403(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 20)):
            resp = self.client.post(
                f"/api/subscriptions/public/plan-change-requests/{self.member.access_token}/",
                {"requested_plan": self.plan.id, "target_schedules_snapshot": []},
                format="json",
            )
        self.assertEqual(resp.status_code, 403)
        self.assertIn("suspendido", resp.data["detail"])

    def test_blocked_cancel_renewal_returns_403(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 20)):
            resp = self.client.post(
                f"/api/subscriptions/public/cancel-renewal/{self.member.access_token}/",
            )
        self.assertEqual(resp.status_code, 403)

    def test_blocked_enable_renewal_returns_403(self):
        self._create_sub(paid=False, end_date=date(2026, 7, 31))
        with self._mock_today(date(2026, 7, 20)):
            resp = self.client.post(
                f"/api/subscriptions/public/enable-renewal/{self.member.access_token}/",
            )
        self.assertEqual(resp.status_code, 403)

    # --- non-blocked member allowed ---

    def test_overdue_plan_change_create_allowed(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 12)):
            resp = self.client.post(
                f"/api/subscriptions/public/plan-change-requests/{self.member.access_token}/",
                {"requested_plan": self.plan.id, "target_schedules_snapshot": []},
                format="json",
            )
        self.assertNotEqual(resp.status_code, 403)

    def test_paid_plan_change_create_allowed(self):
        self._create_sub(paid=True)
        resp = self.client.post(
            f"/api/subscriptions/public/plan-change-requests/{self.member.access_token}/",
            {"requested_plan": self.plan.id, "target_schedules_snapshot": []},
            format="json",
        )
        self.assertNotEqual(resp.status_code, 403)

    def test_pending_plan_change_create_allowed(self):
        self._create_sub(paid=False)
        with self._mock_today(date(2026, 6, 5)):
            resp = self.client.post(
                f"/api/subscriptions/public/plan-change-requests/{self.member.access_token}/",
                {"requested_plan": self.plan.id, "target_schedules_snapshot": []},
                format="json",
            )
        self.assertNotEqual(resp.status_code, 403)
