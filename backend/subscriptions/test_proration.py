"""Tests del prorrateo de primer mes (Fase 2, PLAN-dinero).

Regla bajo test: un alta (``origin="onboarding"``) posterior al día de
vencimiento del gimnasio factura sólo los días que quedan del mes
(``días restantes / días del mes``, half-up a centavos). Los demás orígenes
—renovación, recuperación, cambio de plan— siguen facturando el mes entero.

El período de referencia es 20/03/2026 → 31/03/2026 sobre un gimnasio con
``payment_due_day=10``: 12 de 31 días. Para que los add-ons (actividad,
PT mensual y salida mensual) se escriban contra un período **vigente**, el
"hoy" de todo el archivo queda congelado en 2026-03-20 vía
``mock.patch("django.utils.timezone.localdate")``, el mismo truco que ya usan
``test_money_bugs.py``: sin eso ``get_current_subscription`` devuelve ``None``
y los writers de add-ons no crean ítem.

Se ejecutan contra Postgres real. El gate es ``.github/workflows/backend-tests.yml``
(postgres:16 del runner); localmente hace falta un Postgres con ``CREATEDB``.
"""

from datetime import date, time as _time
from decimal import Decimal, ROUND_HALF_UP
from unittest import mock

from django.utils import timezone

from activities.enrollment_service import EnrollmentService
from activities.models import Activity, ActivitySchedule
from core.testing import BaseAPITest
from gyms.features import (
    FEATURE_ACTIVITIES,
    FEATURE_OUTINGS,
    FEATURE_PERSONAL_TRAINING,
)
from gyms.models import Discount
from members.services import RegistrationService
from outings.enrollment_service import OutingEnrollmentService
from outings.models import Outing, OutingSchedule
from payments.models import Payment
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import Subscription
from subscriptions.services import (
    calculate_subscription_total,
    create_next_subscription,
    get_subscription_payment_status,
    prorated_price_for,
    subscription_original_total,
    subscription_remaining_balance,
)


TODAY = date(2026, 3, 20)
MONTH_DAYS = 31
BILLABLE = MONTH_DAYS - TODAY.day + 1  # 12 días restantes de marzo
DUE_DAY = 10

PLAN_PRICE = Decimal("5000.00")
ACTIVITY_PRICE = Decimal("3000.00")
PT_PRICE = Decimal("22000.00")
OUTING_PRICE = Decimal("1500.00")


def expected_prorated(amount):
    """El importe proporcional de la regla, calculado sin usar ``_prorate``."""
    return (Decimal(amount) * BILLABLE / MONTH_DAYS).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


class _ProrationBase(BaseAPITest):
    """Gimnasio con features de add-ons prendidas y "hoy" congelado."""

    def setUp(self):
        super().setUp()

        patcher = mock.patch(
            "django.utils.timezone.localdate", return_value=TODAY
        )
        patcher.start()
        self.addCleanup(patcher.stop)

        self.gym = self.create_gym()
        self.gym.payment_due_day = DUE_DAY
        self.gym.features = {
            FEATURE_ACTIVITIES: True,
            FEATURE_PERSONAL_TRAINING: True,
            FEATURE_OUTINGS: True,
        }
        self.gym.save(update_fields=["payment_due_day", "features"])
        self.plan = self.create_plan(self.gym, price=PLAN_PRICE)
        self.staff = self.create_user(self.gym)

    @staticmethod
    def plan_snapshot(subscription):
        return subscription.items.get(
            item_type="plan", status="active"
        ).price_snapshot

    def snapshot(self, subscription, item_type):
        return subscription.items.get(
            item_type=item_type, status="active"
        ).price_snapshot

    def open_alta(self, member, **kwargs):
        """Alta por defecto: hoy (20/03, posterior al vencimiento)."""
        return self.open_month_subscription(
            member,
            self.plan,
            start_date=kwargs.pop("start_date", TODAY),
            end_date=kwargs.pop("end_date", date(2026, 3, 31)),
            **kwargs,
        )

    def monthly_pt_assignment(self, member, price=PT_PRICE):
        service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name=f"PT {price}",
            monthly_price=price,
            billing_mode="monthly",
        )
        return PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=member,
            trainer=self.create_user(self.gym, username=f"trainer-{price}"),
            service=service,
            day="monday",
            start_time=_time(10, 0),
            end_time=_time(11, 0),
            modality="monthly",
            active=True,
        )

    def enroll_monthly_activity(self, member, price=ACTIVITY_PRICE):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name=f"Actividad {price}",
            billing_mode="monthly",
            monthly_price=price,
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="tuesday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return EnrollmentService.enroll_member(
            member, schedule, skip_eligibility_check=True
        )

    def enroll_monthly_outing(self, member, price=OUTING_PRICE):
        outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name=f"Salida {price}",
        )
        schedule = OutingSchedule.objects.create(
            outing=outing,
            day="wednesday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return OutingEnrollmentService.enroll_member(
            member, schedule, skip_eligibility_check=True
        )


class ProratedAltaTests(_ProrationBase):

    def test_alta_after_due_day_bills_only_the_remaining_days(self):
        member = self.create_member(self.gym)

        sub = self.open_alta(member)

        self.assertTrue(sub.prorated)
        self.assertEqual(self.plan_snapshot(sub), expected_prorated(PLAN_PRICE))
        self.assertEqual(self.plan_snapshot(sub), Decimal("1935.48"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("1935.48"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"],
            Decimal("1935.48"),
        )

    def test_alta_on_the_due_day_bills_the_whole_month(self):
        member = self.create_member(self.gym)

        sub = self.open_alta(member, start_date=date(2026, 3, 10))

        self.assertFalse(sub.prorated)
        self.assertEqual(self.plan_snapshot(sub), PLAN_PRICE)
        self.assertEqual(calculate_subscription_total(sub), PLAN_PRICE)

    def test_alta_before_the_due_day_bills_the_whole_month(self):
        member = self.create_member(self.gym)

        sub = self.open_alta(member, start_date=date(2026, 3, 1))

        self.assertFalse(sub.prorated)
        self.assertEqual(self.plan_snapshot(sub), PLAN_PRICE)
        self.assertEqual(calculate_subscription_total(sub), PLAN_PRICE)

    def test_non_prorated_period_returns_the_list_price_untouched(self):
        member = self.create_member(self.gym)
        sub = self.open_alta(member, start_date=date(2026, 3, 10))

        self.assertEqual(prorated_price_for(sub, PLAN_PRICE), PLAN_PRICE)

    def test_comp_member_pays_zero_even_when_the_alta_is_prorated(self):
        member = self.create_member(self.gym)
        member.is_comp = True
        member.save(update_fields=["is_comp"])

        sub = self.open_alta(member)

        self.assertTrue(sub.prorated)
        self.assertEqual(self.plan_snapshot(sub), Decimal("0"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("0"))
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )


class ProratedAddOnsTests(_ProrationBase):

    def test_plan_activity_pt_and_outing_are_all_prorated(self):
        member = self.create_member(self.gym)
        # La asignación de PT vive antes del alta: el ítem de cuota nace
        # dentro de open_subscription, con el mismo flag de prorrateo.
        self.monthly_pt_assignment(member)

        sub = self.open_alta(member)

        self.enroll_monthly_activity(member)
        self.enroll_monthly_outing(member)

        self.assertEqual(self.snapshot(sub, "plan"), expected_prorated(PLAN_PRICE))
        self.assertEqual(
            self.snapshot(sub, "activity"), expected_prorated(ACTIVITY_PRICE)
        )
        self.assertEqual(
            self.snapshot(sub, "personal_training"),
            expected_prorated(PT_PRICE),
        )
        self.assertEqual(
            self.snapshot(sub, "outing"), expected_prorated(OUTING_PRICE)
        )

        expected_total = (
            expected_prorated(PLAN_PRICE)
            + expected_prorated(ACTIVITY_PRICE)
            + expected_prorated(PT_PRICE)
            + expected_prorated(OUTING_PRICE)
        )
        self.assertEqual(calculate_subscription_total(sub), expected_total)
        self.assertEqual(expected_total, Decimal("12193.55"))

    def test_add_ons_of_a_full_month_alta_stay_whole(self):
        member = self.create_member(self.gym)
        self.monthly_pt_assignment(member)

        sub = self.open_alta(member, start_date=date(2026, 3, 10))

        self.enroll_monthly_activity(member)
        self.enroll_monthly_outing(member)

        self.assertEqual(self.snapshot(sub, "plan"), PLAN_PRICE)
        self.assertEqual(self.snapshot(sub, "activity"), ACTIVITY_PRICE)
        self.assertEqual(
            self.snapshot(sub, "personal_training"), PT_PRICE
        )
        self.assertEqual(self.snapshot(sub, "outing"), OUTING_PRICE)
        self.assertEqual(
            calculate_subscription_total(sub),
            PLAN_PRICE + ACTIVITY_PRICE + PT_PRICE + OUTING_PRICE,
        )


class ProrationRenewalTests(_ProrationBase):

    def test_second_month_is_billed_whole_with_full_snapshots(self):
        member = self.create_member(self.gym)
        self.monthly_pt_assignment(member)
        sub = self.open_alta(member)
        self.enroll_monthly_activity(member)
        self.enroll_monthly_outing(member)
        self.assertTrue(sub.prorated)

        next_sub = create_next_subscription(sub)

        self.assertEqual(next_sub.start_date, date(2026, 4, 1))
        self.assertEqual(next_sub.end_date, date(2026, 4, 30))
        self.assertFalse(next_sub.prorated)
        self.assertEqual(self.snapshot(next_sub, "plan"), PLAN_PRICE)
        self.assertEqual(self.snapshot(next_sub, "activity"), ACTIVITY_PRICE)
        self.assertEqual(
            self.snapshot(next_sub, "personal_training"), PT_PRICE
        )
        self.assertEqual(self.snapshot(next_sub, "outing"), OUTING_PRICE)
        self.assertEqual(
            calculate_subscription_total(next_sub),
            PLAN_PRICE + ACTIVITY_PRICE + PT_PRICE + OUTING_PRICE,
        )


class ProratedDiscountTests(_ProrationBase):

    def test_discount_applies_to_the_prorated_total(self):
        discount = Discount.objects.create(
            gym=self.gym, name="Oro", discount_percent=20, active=True
        )
        member = self.create_member(self.gym)
        member.discount = discount
        member.save(update_fields=["discount"])

        sub = self.open_alta(member)

        self.assertTrue(sub.prorated)
        self.assertEqual(sub.discount_percent_snapshot, 20)
        # El descuento cae sobre el total ya prorrateado: 1935.48 * 0.8.
        self.assertEqual(
            subscription_original_total(sub), Decimal("1935.48")
        )
        self.assertEqual(calculate_subscription_total(sub), Decimal("1548.38"))


class ProrationRoundingTests(_ProrationBase):

    def test_half_up_tie_rounds_up(self):
        # 1.01 * 1/2 = 0.505: half-up da 0.51, half-even daria 0.50.
        self.assertEqual(
            SubscriptionDomain._prorate(Decimal("1.01"), 1, 2),
            Decimal("0.51"),
        )
        self.assertEqual(
            SubscriptionDomain._prorate(Decimal("1.00"), 1, 2),
            Decimal("0.50"),
        )

    def test_period_prices_are_always_two_decimals(self):
        for price in ("5000.00", "12345.67", "9999.99", "777.01"):
            with self.subTest(price=price):
                member = self.create_member(self.gym, phone=f"11-{price}")
                plan = self.create_plan(
                    self.gym, name=f"Plan {price}", price=Decimal(price)
                )
                sub = self.open_month_subscription(
                    member,
                    plan,
                    start_date=TODAY,
                    end_date=date(2026, 3, 31),
                )
                snapshot = self.plan_snapshot(sub)
                self.assertEqual(snapshot, expected_prorated(price))
                self.assertEqual(
                    snapshot, snapshot.quantize(Decimal("0.01"))
                )


class ProrationSettlementTests(_ProrationBase):

    def test_paying_the_prorated_total_settles_the_period(self):
        member = self.create_member(self.gym)
        sub = self.open_alta(member)
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"],
            Decimal("1935.48"),
        )
        total = calculate_subscription_total(sub)

        self.settle_subscription(sub)

        payment = Payment.objects.get(subscription=sub)
        self.assertEqual(payment.amount, total)
        self.assertEqual(
            subscription_remaining_balance(sub)["remaining"], Decimal("0")
        )
        self.assertEqual(get_subscription_payment_status(sub), "paid")
        sub.refresh_from_db()
        self.assertTrue(sub.paid)


class NonOnboardingOriginTests(_ProrationBase):

    def test_other_origins_never_prorate_on_the_same_day(self):
        for origin in ("recovery", "auto_renewal", "plan_change"):
            with self.subTest(origin=origin):
                member = self.create_member(
                    self.gym, first_name="Ana", phone=f"11-{origin}"
                )
                sub = self.open_alta(member, origin=origin)

                self.assertFalse(sub.prorated, origin)
                self.assertEqual(self.plan_snapshot(sub), PLAN_PRICE, origin)
                self.assertEqual(
                    calculate_subscription_total(sub), PLAN_PRICE, origin
                )


class RegistrationProrationTests(_ProrationBase):

    def register_member(self):
        return RegistrationService.register(
            gym=self.gym,
            validated_member_data={
                "first_name": "Ana",
                "last_name": "Gomez",
                "phone": "11-ana",
            },
            plan_id=self.plan.id,
            has_gym=False,
            has_activities=False,
        )

    def test_registration_after_due_day_opens_a_prorated_period(self):
        member = self.register_member()

        sub = Subscription.objects.get(member=member)

        self.assertEqual(sub.origin, "onboarding")
        self.assertTrue(sub.prorated)
        self.assertEqual(self.plan_snapshot(sub), Decimal("1935.48"))
        self.assertEqual(calculate_subscription_total(sub), Decimal("1935.48"))

    def test_registration_on_or_before_due_day_opens_a_full_period(self):
        # Vencimiento el mismo día del alta: el ``>`` no dispara.
        self.gym.payment_due_day = TODAY.day
        self.gym.access_block_day = TODAY.day + 5
        self.gym.save(update_fields=["payment_due_day", "access_block_day"])

        member = self.register_member()

        sub = Subscription.objects.get(member=member)

        self.assertEqual(sub.origin, "onboarding")
        self.assertFalse(sub.prorated)
        self.assertEqual(self.plan_snapshot(sub), PLAN_PRICE)
        self.assertEqual(calculate_subscription_total(sub), PLAN_PRICE)
