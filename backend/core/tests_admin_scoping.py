"""Fase J — REF-08: el admin de Django no debe filtrar filas entre gimnasios.

Cada ``ModelAdmin`` que cuelga del gimnasio hereda de ``GymScopedAdminMixin``,
que acota el queryset al gimnasio del usuario; el superusuario (operador
central) ve todo. El test verifica que un dueño de gimnasio sólo vea sus
filas en cada admin registrado con ese recorte.
"""

from django.contrib import admin as django_admin
from django.test import RequestFactory

from attendance.admin import (
    AttendanceAdmin,
    AttendanceScheduleAdmin,
    ScheduleSlotAdmin,
)
from attendance.models import Attendance, AttendanceSchedule, ScheduleSlot
from community.admin import CommunityBusinessAdmin
from community.models import CommunityBusiness
from core.testing import BaseAPITest
from gyms.admin import DiscountAdmin, GymAdmin
from gyms.models import Discount, Gym
from plans.admin import MembershipPlanAdmin, ServiceAdmin
from plans.models import MembershipPlan, Service
from profiles.admin import UserProfileAdmin
from profiles.models import UserProfile
from routines.admin import (
    ExerciseAdmin,
    RoutineAssignmentAdmin,
    RoutineExerciseAdmin,
    RoutineTemplateAdmin,
    WorkoutSetAdmin,
)
from routines.models import (
    Exercise,
    RoutineAssignment,
    RoutineExercise,
    RoutineTemplate,
    WorkoutSet,
)
from subscriptions.admin import (
    PlanChangeRequestAdmin,
    SubscriptionAdmin,
    SubscriptionItemAdmin,
)
from subscriptions.models import PlanChangeRequest, Subscription, SubscriptionItem


class AdminGymScopingTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.gym_a = self.create_gym(name="Gym A")
        self.gym_b = self.create_gym(name="Gym B")

        self.owner_a = self.create_user(self.gym_a, username="owner-a")
        self.superuser = self.create_user(self.gym_a, username="root")
        self.superuser.is_superuser = True
        self.superuser.is_staff = True
        self.superuser.save(update_fields=["is_superuser", "is_staff"])

        self.factory = RequestFactory()

    def _request(self, user):
        request = self.factory.get("/admin/")
        request.user = user
        return request

    def _model_admin(self, cls, model):
        return cls(model, django_admin.site)

    def _assert_own_gym_only(self, cls, model, lookup="gym", user=None):
        model_admin = self._model_admin(cls, model)
        qs = model_admin.get_queryset(self._request(user or self.owner_a))
        self.assertFalse(
            qs.exclude(**{lookup: self.gym_a}).exists(),
            f"{cls.__name__} muestra filas de otro gimnasio",
        )

    def test_superuser_sees_all_gyms(self):
        Discount.objects.create(gym=self.gym_a, name="A", discount_percent=10)
        Discount.objects.create(gym=self.gym_b, name="B", discount_percent=20)

        model_admin = self._model_admin(DiscountAdmin, Discount)
        everything = model_admin.get_queryset(self._request(self.superuser))

        self.assertEqual(
            sorted(everything.values_list("name", flat=True)), ["A", "B"]
        )

    def test_owner_sees_only_own_discounts(self):
        Discount.objects.create(gym=self.gym_a, name="A", discount_percent=10)
        Discount.objects.create(gym=self.gym_b, name="B", discount_percent=20)

        model_admin = self._model_admin(DiscountAdmin, Discount)
        own = model_admin.get_queryset(self._request(self.owner_a))

        self.assertEqual(list(own.values_list("name", flat=True)), ["A"])

    def test_gym_admin_only_shows_own_gym(self):
        model_admin = self._model_admin(GymAdmin, Gym)

        own = model_admin.get_queryset(self._request(self.owner_a))
        self.assertEqual(list(own.values_list("name", flat=True)), ["Gym A"])

    def test_community_admin_scopes_to_own_gym(self):
        CommunityBusiness.objects.create(
            gym=self.gym_a, name="Cafe A", discount="10%"
        )
        CommunityBusiness.objects.create(
            gym=self.gym_b, name="Cafe B", discount="10%"
        )

        model_admin = self._model_admin(
            CommunityBusinessAdmin, CommunityBusiness
        )
        own = model_admin.get_queryset(self._request(self.owner_a))

        self.assertEqual(list(own.values_list("name", flat=True)), ["Cafe A"])

    def test_service_admin_scopes_to_own_gym(self):
        Service.objects.create(gym=self.gym_a, name="Srv A", slug="srv-a")
        Service.objects.create(gym=self.gym_b, name="Srv B", slug="srv-b")

        self._assert_own_gym_only(ServiceAdmin, Service)

    def test_plan_admin_scopes_to_own_gym(self):
        self.create_plan(self.gym_a, name="Plan A")
        self.create_plan(self.gym_b, name="Plan B")

        self._assert_own_gym_only(MembershipPlanAdmin, MembershipPlan)

    def test_subscription_admins_scope_to_own_gym(self):
        member_a = self.create_member(self.gym_a, first_name="Ana")
        member_b = self.create_member(self.gym_b, first_name="Bob")
        plan_a = self.create_plan(self.gym_a)
        plan_b = self.create_plan(self.gym_b)

        Subscription.objects.create(
            gym=self.gym_a, member=member_a, plan=plan_a,
            start_date="2026-01-01", end_date="2026-01-31",
        )
        Subscription.objects.create(
            gym=self.gym_b, member=member_b, plan=plan_b,
            start_date="2026-01-01", end_date="2026-01-31",
        )

        self._assert_own_gym_only(SubscriptionAdmin, Subscription)
        self._assert_own_gym_only(
            SubscriptionItemAdmin, SubscriptionItem, "subscription__gym"
        )
        self._assert_own_gym_only(PlanChangeRequestAdmin, PlanChangeRequest)

    def test_attendance_admins_scope_to_own_gym(self):
        self._assert_own_gym_only(ScheduleSlotAdmin, ScheduleSlot)
        self._assert_own_gym_only(
            AttendanceScheduleAdmin, AttendanceSchedule
        )
        self._assert_own_gym_only(AttendanceAdmin, Attendance)

    def test_routine_admins_scope_to_own_gym(self):
        self._assert_own_gym_only(ExerciseAdmin, Exercise)
        self._assert_own_gym_only(RoutineTemplateAdmin, RoutineTemplate)
        self._assert_own_gym_only(
            RoutineExerciseAdmin, RoutineExercise, "routine_template__gym"
        )
        self._assert_own_gym_only(RoutineAssignmentAdmin, RoutineAssignment)
        self._assert_own_gym_only(
            WorkoutSetAdmin, WorkoutSet, "routine_assignment__gym"
        )

    def test_profile_admin_scopes_to_own_gym(self):
        self._assert_own_gym_only(UserProfileAdmin, UserProfile)

    def test_user_without_gym_sees_nothing(self):
        Discount.objects.create(gym=self.gym_a, name="A", discount_percent=10)
        orphan = self.create_user(self.gym_a, username="orphan")
        orphan.profile.gym = None
        orphan.profile.save(update_fields=["gym"])

        model_admin = self._model_admin(DiscountAdmin, Discount)
        qs = model_admin.get_queryset(self._request(orphan))

        self.assertFalse(qs.exists())
