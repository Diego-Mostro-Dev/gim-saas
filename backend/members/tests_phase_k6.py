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
