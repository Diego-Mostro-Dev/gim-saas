from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal
import secrets
import random

from django.db import transaction
from django.utils import timezone

from members.models import Member
from payments.models import Payment
from plans.models import MembershipPlan
from subscriptions.models import Subscription
from subscriptions.services import get_last_day_of_month

from .data.member_names import FIRST_NAMES, LAST_NAMES
from .data.plans import DEMO_PLANS


class BaseSeeder:

    def __init__(self, gym, ref_date=None, force=False, preserve_plans=False):
        self.gym = gym
        self.force = force
        self.preserve_plans = preserve_plans
        self.ref_date = ref_date or timezone.localdate()
        self.ref_datetime = datetime(
            self.ref_date.year,
            self.ref_date.month,
            self.ref_date.day,
            12, 0, 0,
            tzinfo=timezone.get_current_timezone(),
        )
        self.stats = {}

    def needs_seeding(self):
        existing = Member.objects.filter(gym=self.gym).count()
        if existing > 0:
            return self.force
        return True

    def cleanup_phase1(self):
        Payment.objects.filter(gym=self.gym).delete()
        Subscription.objects.filter(gym=self.gym).delete()
        Member.objects.filter(gym=self.gym).delete()
        if not self.preserve_plans:
            MembershipPlan.objects.filter(gym=self.gym).delete()

    def _get_previous_month_range(self, ref_date=None):
        d = ref_date or self.ref_date
        first = date(d.year, d.month, 1) - timedelta(days=1)
        first = first.replace(day=1)
        last = get_last_day_of_month(first)
        return first, last

    def _get_two_months_ago_range(self, ref_date=None):
        d = ref_date or self.ref_date
        first = date(d.year, d.month, 1) - timedelta(days=1)
        first = first.replace(day=1) - timedelta(days=1)
        first = first.replace(day=1)
        last = get_last_day_of_month(first)
        return first, last

    def _generate_phone(self, index):
        return f"555-{self.gym.id:04d}-{index:04d}"

    def _generate_email(self, first_name, last_name, index):
        safe_first = first_name.lower().replace(" ", ".")
        safe_last = last_name.lower().replace(" ", ".")
        return f"{safe_first}.{safe_last}.{index}@example.com"

    def _pick_payment_method(self):
        return random.choices(["cash", "transfer", "card"], weights=[60, 25, 15])[0]

    def seed_phase1(self):
        with transaction.atomic():
            self._seed_plans()
            self._seed_members()
            self._seed_subscriptions()
            self._seed_payments()

    def _seed_plans(self):
        plans = []
        for pdef in DEMO_PLANS:
            plans.append(MembershipPlan(
                gym=self.gym,
                name=pdef["name"],
                description=pdef["description"],
                price=pdef["price"],
                duration_days=pdef["duration_days"],
                weekly_visits=pdef["weekly_visits"],
                active=pdef["active"],
            ))
        created = MembershipPlan.objects.bulk_create(plans)
        self.stats["plans"] = len(created)

    def _seed_members(self):
        random.seed(f"gym-demo-{self.gym.id}")

        members = []
        is_active_flags = [True] * 45 + [False] * 5
        random.shuffle(is_active_flags)

        for i in range(50):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)

            members.append(Member(
                gym=self.gym,
                first_name=first,
                last_name=last,
                phone=self._generate_phone(i),
                email=self._generate_email(first, last, i),
                active=is_active_flags[i],
                access_token=secrets.token_urlsafe(32),
                created_at=self.ref_datetime - timedelta(days=60),
            ))

        created = Member.objects.bulk_create(members)
        self.stats["members"] = len(created)
        self.stats["members_active"] = sum(1 for f in is_active_flags if f)
        self.stats["members_inactive"] = sum(1 for f in is_active_flags if not f)
        self._is_active_member = {m.id: is_active_flags[i] for i, m in enumerate(created)}

    def _seed_subscriptions(self):
        random.seed(f"gym-demo-subs-{self.gym.id}")

        plans = list(MembershipPlan.objects.filter(gym=self.gym).order_by("id"))
        members = list(Member.objects.filter(gym=self.gym).order_by("id"))
        plan_pool = (
            [plans[0]] * 15 +   # Básico
            [plans[1]] * 15 +   # Estándar
            [plans[2]] * 10 +   # Premium
            [plans[3]] * 5      # Estudiante
        )
        random.shuffle(plan_pool)

        subscriptions = []
        current_end = get_last_day_of_month(self.ref_date)
        prev_start, prev_end = self._get_previous_month_range()

        active_members = [m for m in members if self._is_active_member.get(m.id, False)]
        inactive_members = [m for m in members if not self._is_active_member.get(m.id, True)]
        old_start, old_end = self._get_two_months_ago_range()

        for idx, member in enumerate(active_members):
            plan = plan_pool[idx]

            # Current month subscription (paid)
            subscriptions.append(Subscription(
                gym=self.gym,
                member=member,
                plan=plan,
                start_date=self.ref_date,
                end_date=current_end,
                paid=True,
                auto_renew=True,
                created_at=self.ref_datetime,
            ))

            # Historical subscription (previous month) for 40 out of 45
            if idx < 40:
                subscriptions.append(Subscription(
                    gym=self.gym,
                    member=member,
                    plan=plan,
                    start_date=prev_start,
                    end_date=prev_end,
                    paid=True,
                    auto_renew=True,
                    created_at=self.ref_datetime - timedelta(days=35),
                ))

        # 5 inactive members: expired subscriptions from 2 months ago
        for member in inactive_members:
            subscriptions.append(Subscription(
                gym=self.gym,
                member=member,
                plan=plans[0],
                start_date=old_start,
                end_date=old_end,
                paid=True,
                auto_renew=False,
                created_at=self.ref_datetime - timedelta(days=70),
            ))

        created = Subscription.objects.bulk_create(subscriptions)
        self.stats["subscriptions"] = len(created)

    def _seed_payments(self):
        from collections import defaultdict

        subscriptions = list(
            Subscription.objects.filter(gym=self.gym)
            .select_related("member", "plan")
            .order_by("member_id", "-created_at")
        )

        subs_by_member = defaultdict(list)
        for sub in subscriptions:
            subs_by_member[sub.member_id].append(sub)

        payments = []

        # 45 current payments: one per active member for their latest subscription
        active_mids = sorted(
            mid for mid in subs_by_member
            if self._is_active_member.get(mid, False)
        )
        for mid in active_mids[:45]:
            latest_sub = subs_by_member[mid][0]
            payments.append(Payment(
                gym=self.gym,
                subscription=latest_sub,
                member=latest_sub.member,
                member_name=f"{latest_sub.member.first_name} {latest_sub.member.last_name}",
                plan_name=latest_sub.plan.name,
                amount=latest_sub.plan.price,
                payment_method=self._pick_payment_method(),
                paid_at=self.ref_datetime,
                subscription_end_date=latest_sub.end_date,
            ))

        # 40 historical payments: second subscription for first 40 active members
        for mid in active_mids[:40]:
            subs = subs_by_member[mid]
            if len(subs) >= 2:
                historical_sub = subs[1]
                payments.append(Payment(
                    gym=self.gym,
                    subscription=historical_sub,
                    member=historical_sub.member,
                    member_name=f"{historical_sub.member.first_name} {historical_sub.member.last_name}",
                    plan_name=historical_sub.plan.name,
                    amount=historical_sub.plan.price,
                    payment_method=self._pick_payment_method(),
                    paid_at=self.ref_datetime - timedelta(days=35),
                    subscription_end_date=historical_sub.end_date,
                ))

        created = Payment.objects.bulk_create(payments)
        self.stats["payments"] = len(created)

    def print_summary(self, stream):
        stream.write(f"\n=== Seed Summary for {self.gym.name} ===\n")
        if "plans" in self.stats:
            stream.write(f"  Plans:              {self.stats['plans']} ✓\n")
        if "members" in self.stats:
            stream.write(f"  Members:            {self.stats['members']} ✓")
            stream.write(f" ({self.stats['members_active']} active, {self.stats['members_inactive']} inactive)\n")
        if "subscriptions" in self.stats:
            stream.write(f"  Subscriptions:      {self.stats['subscriptions']} ✓\n")
        if "payments" in self.stats:
            stream.write(f"  Payments:           {self.stats['payments']} ✓\n")
