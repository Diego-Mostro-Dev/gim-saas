from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from datetime import date, timedelta
import inspect

from rest_framework.test import APIClient, APIRequestFactory

from gyms.models import Gym
from members.models import Member
from subscriptions.models import Subscription
from plans.models import MembershipPlan
from payments.models import Payment
from payments.serializers import PaymentSerializer


BASE_REST_FW = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class PaymentMemberFKTest(TestCase):
    """Payment model has a member FK, serializer sets it correctly."""

    def test_payment_has_member_fk(self):
        field = Payment._meta.get_field("member")
        self.assertIsNotNone(field)
        self.assertTrue(field.null)

    def test_payment_serializer_sets_member(self):
        gym = Gym.objects.create(name="PGym", slug="p-gym", phone="1", email="p@g.com")
        user = User.objects.create_user(username="puser", password="Ppass1!")
        user.profile.gym = gym
        user.profile.save()
        member = Member.objects.create(gym=gym, first_name="PM", last_name="Ember",
                                        phone="1", email="p@m.com")
        plan = MembershipPlan.objects.create(gym=gym, name="PBasic", price=10, duration_days=30)
        sub = Subscription.objects.create(gym=gym, member=member, plan=plan,
                                           start_date=date.today(),
                                           end_date=date.today() + timedelta(days=30),
                                           paid=False)

        factory = APIRequestFactory()
        request = factory.post("/api/payments/")
        request.user = user
        request.user.profile = user.profile

        ser = PaymentSerializer(
            data={"subscription": sub.id, "amount": 50, "payment_method": "cash"},
            context={"request": request},
        )
        self.assertTrue(ser.is_valid(), f"Errors: {ser.errors}")
        payment = ser.save(gym=gym)

        self.assertEqual(payment.member.id, member.id)
        self.assertEqual(payment.member_name, f"{member.first_name} {member.last_name}")
        sub.refresh_from_db()
        self.assertTrue(sub.paid)

    def test_fk_query_replaces_string_match(self):
        gym = Gym.objects.create(name="FGym", slug="f-gym", phone="1", email="f@g.com")
        user = User.objects.create_user(username="fuser", password="Fpass1!")
        user.profile.gym = gym
        user.profile.save()
        member = Member.objects.create(gym=gym, first_name="F", last_name="Member",
                                        phone="1", email="f@m.com")
        plan = MembershipPlan.objects.create(gym=gym, name="FBasic", price=10, duration_days=30)
        sub = Subscription.objects.create(gym=gym, member=member, plan=plan,
                                           start_date=date.today(),
                                           end_date=date.today() + timedelta(days=30),
                                           paid=False)
        Payment.objects.create(gym=gym, subscription=sub, member=member,
                                member_name="F Member", plan_name="FBasic",
                                amount=50, payment_method="cash")
        Payment.objects.create(gym=gym, subscription=sub, member=member,
                                member_name="F Member", plan_name="FBasic",
                                amount=25, payment_method="cash")

        self.assertEqual(Payment.objects.filter(member=member).count(), 2)


@override_settings(REST_FRAMEWORK=BASE_REST_FW)
class ConcurrencyProtectionTest(TestCase):
    """Payment create/destroy use select_for_update + transaction.atomic."""

    def test_serializer_uses_select_for_update(self):
        source = inspect.getsource(PaymentSerializer.create)
        self.assertIn("select_for_update()", source)
        self.assertIn("transaction.atomic()", source)

    def test_view_uses_select_for_update(self):
        from payments.views import PaymentViewSet
        source = inspect.getsource(PaymentViewSet.perform_destroy)
        self.assertIn("select_for_update()", source)
        self.assertIn("transaction.atomic()", source)

    def test_payment_marks_subscription_paid(self):
        gym = Gym.objects.create(name="CGym", slug="c-gym", phone="1", email="c@g.com")
        user = User.objects.create_user(username="cuser", password="Cpass1!")
        user.profile.gym = gym
        user.profile.save()
        member = Member.objects.create(gym=gym, first_name="C", last_name="Member",
                                        phone="1", email="c@m.com")
        plan = MembershipPlan.objects.create(gym=gym, name="CBasic", price=10, duration_days=30)
        sub = Subscription.objects.create(gym=gym, member=member, plan=plan,
                                           start_date=date.today(),
                                           end_date=date.today() + timedelta(days=30),
                                           paid=False)

        factory = APIRequestFactory()
        request = factory.post("/api/payments/")
        request.user = user
        request.user.profile = user.profile
        ser = PaymentSerializer(
            data={"subscription": sub.id, "amount": 50, "payment_method": "cash"},
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(gym=gym)
        sub.refresh_from_db()
        self.assertTrue(sub.paid)
