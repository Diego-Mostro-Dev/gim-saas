from core.testing import BaseAPITest

from .models import MembershipPlan, Service


PLAN_PAYLOAD = {
    "name": "Plan Basico",
    "description": "",
    "price": "15000",
    "duration_days": "30",
    "weekly_visits": None,
    "active": True,
}


class MembershipPlanServiceTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.default_service = Service.get_default_for_gym(self.gym)
        self.client.force_authenticate(user=self.user)

    def test_create_plan_without_service_defaults_to_gym_service(self):
        resp = self.client.post("/api/plans/", PLAN_PAYLOAD, format="json")

        self.assertEqual(resp.status_code, 201, resp.data)

        plan = MembershipPlan.objects.get(name="Plan Basico")
        self.assertEqual(plan.gym, self.gym)
        self.assertEqual(plan.service, self.default_service)

    def test_create_plan_with_own_service(self):
        resp = self.client.post(
            "/api/plans/",
            {**PLAN_PAYLOAD, "service": self.default_service.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(MembershipPlan.objects.get(name="Plan Basico").service, self.default_service)

    def test_create_plan_with_foreign_service_rejected(self):
        other_gym = self.create_gym(name="Other Gym")
        foreign_service = Service.get_default_for_gym(other_gym)

        resp = self.client.post(
            "/api/plans/",
            {**PLAN_PAYLOAD, "service": foreign_service.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("service", resp.data)
        self.assertEqual(MembershipPlan.objects.count(), 0)

    def test_update_plan_without_service_keeps_service(self):
        plan = self.create_plan(self.gym)
        original_service = plan.service

        resp = self.client.put(
            f"/api/plans/{plan.id}/",
            {
                "name": "Plan Renombrado",
                "description": "x",
                "price": "20000",
                "duration_days": "30",
                "weekly_visits": None,
                "active": True,
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)

        plan.refresh_from_db()
        self.assertEqual(plan.name, "Plan Renombrado")
        self.assertEqual(plan.service, original_service)
