from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import secrets
import random

from django.db import transaction
from django.utils import timezone

from members.models import Member
from payments.models import Payment
from plans.models import MembershipPlan, Service
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import get_last_day_of_month
from routines.models import Exercise, RoutineTemplate, RoutineExercise, RoutineAssignment
from attendance.models import Attendance, AttendanceSchedule, ScheduleSlot

from .data.member_names import FIRST_NAMES, LAST_NAMES
from .data.plans import DEMO_PLANS
from .data.exercises import EXERCISES
from .data.routines import ROUTINES


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
        if self.preserve_plans:
            existing = MembershipPlan.objects.filter(gym=self.gym)
            if existing.exists():
                self.stats["plans"] = existing.count()
                return

        service = Service.get_default_for_gym(self.gym)

        plans = []
        for pdef in DEMO_PLANS:
            plans.append(MembershipPlan(
                gym=self.gym,
                service=service,
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
        n = len(plans)
        base = 45 // n
        rem = 45 % n
        plan_pool = []
        for i in range(n):
            count = base + (1 if i < rem else 0)
            plan_pool.extend([plans[i]] * count)
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

        SubscriptionItem.objects.bulk_create([
            SubscriptionItem(
                subscription=sub,
                plan=sub.plan,
                status="active",
                price_snapshot=sub.plan.price,
                start_date=sub.start_date,
                end_date=sub.end_date,
            )
            for sub in created
        ])

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

    def cleanup_phase3(self):
        RoutineAssignment.objects.filter(gym=self.gym).delete()
        RoutineExercise.objects.filter(routine_template__gym=self.gym).delete()
        RoutineTemplate.objects.filter(gym=self.gym).delete()
        Exercise.objects.filter(gym=self.gym).delete()

    def cleanup_phase4(self):
        AttendanceSchedule.objects.filter(gym=self.gym).delete()
        ScheduleSlot.objects.filter(gym=self.gym).delete()

    def cleanup_phase5(self):
        Attendance.objects.filter(gym=self.gym).delete()

    def seed_phase4(self):
        with transaction.atomic():
            self._seed_slots()
            self._seed_schedules()

    def _seed_slots(self):
        DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        HOURS = [time(8, 0), time(10, 0), time(18, 0)]
        slots = [
            ScheduleSlot(gym=self.gym, day=day, hour=h, capacity=15)
            for day in DAYS
            for h in HOURS
        ]
        created = ScheduleSlot.objects.bulk_create(slots)
        self._all_slots = created
        self._slot_usage = {s.id: 0 for s in created}
        self.stats["slots"] = len(created)

    def _seed_schedules(self):
        random.seed(f"gym-demo-schedules-{self.gym.id}")

        active_members = list(
            Member.objects.filter(gym=self.gym, active=True).order_by("id")
        )
        random.shuffle(active_members)

        counts = [1] * 15 + [2] * 20 + [3] * 10
        random.shuffle(counts)

        schedules = []
        for member, n in zip(active_members, counts):
            usage_groups = {}
            for s in self._all_slots:
                usage_groups.setdefault(self._slot_usage[s.id], []).append(s)
            available = []
            for usage in sorted(usage_groups):
                group = usage_groups[usage][:]
                random.shuffle(group)
                available.extend(group)
            chosen = 0
            for slot in available:
                if chosen >= n:
                    break
                schedules.append(AttendanceSchedule(
                    gym=self.gym,
                    member=member,
                    slot=slot,
                    active=True,
                ))
                self._slot_usage[slot.id] += 1
                chosen += 1

        created = AttendanceSchedule.objects.bulk_create(schedules)
        self.stats["schedules"] = len(created)

    def seed_phase5(self):
        self._seed_attendance()

    def _seed_attendance(self):
        from django.db import connection

        random.seed(f"gym-demo-attendance-{self.gym.id}")

        today = self.ref_date
        business_days = []
        d = today - timedelta(days=1)
        while d > today - timedelta(days=90):
            if d.weekday() < 6:
                business_days.append(d)
            d -= timedelta(days=1)
        business_days.reverse()

        active_members = list(
            Member.objects.filter(gym=self.gym, active=True).order_by("id")
        )
        random.shuffle(active_members)

        tiers = [0.90] * 10 + [0.70] * 25 + [0.35] * 10

        schedules = (
            AttendanceSchedule.objects.filter(gym=self.gym, active=True)
            .select_related("slot")
        )
        member_schedules = {}
        for s in schedules:
            member_schedules.setdefault(s.member_id, []).append(s)

        day_map = {0: "monday", 1: "tuesday", 2: "wednesday",
                   3: "thursday", 4: "friday", 5: "saturday"}

        created_keys = set()
        rows = []
        now = timezone.now()
        members_with_attendance = set()

        for member, prob in zip(active_members, tiers):
            member_scheds = member_schedules.get(member.id, [])
            sched_by_weekday = {}
            for s in member_scheds:
                sched_by_weekday[s.slot.day] = s

            for day_date in business_days:
                day_name = day_map.get(day_date.weekday())
                if not day_name or day_name not in sched_by_weekday:
                    continue
                if random.random() >= prob:
                    continue
                sched = sched_by_weekday[day_name]
                key = (sched.id, day_date)
                if key in created_keys:
                    continue
                created_keys.add(key)
                row = (self.gym.id, member.id, sched.id, sched.slot_id, day_date, now)
                rows.append(row)
                members_with_attendance.add(member.id)

        if rows:
            with connection.cursor() as cursor:
                batch_size = 100
                for i in range(0, len(rows), batch_size):
                    batch = rows[i:i + batch_size]
                    placeholders = ",".join(
                        ["(%s,%s,%s,%s,%s,%s)"] * len(batch)
                    )
                    flat = [v for r in batch for v in r]
                    cursor.execute(
                        "INSERT INTO attendance_attendance "
                        "(gym_id, member_id, schedule_id, slot_id, date, created_at) "
                        "VALUES " + placeholders + " "
                        "ON CONFLICT (gym_id, schedule_id, date) DO NOTHING",
                        flat,
                    )

        actual_count = Attendance.objects.filter(
            gym=self.gym, member__in=active_members
        ).count()

        self.stats["attendance"] = actual_count
        self.stats["attendance_members"] = len(members_with_attendance)
        self.stats["attendance_without"] = len(active_members) - len(members_with_attendance)
        if members_with_attendance:
            self.stats["attendance_avg"] = actual_count / len(members_with_attendance)

    def print_slot_summary(self, stream):
        if "slots" not in self.stats:
            return
        stream.write(f"\n  Slot Occupancy:\n")
        total_occupancy = 0
        for slot in self._all_slots:
            count = AttendanceSchedule.objects.filter(gym=self.gym, slot=slot, active=True).count()
            cap = slot.capacity
            pct = (count / cap * 100) if cap else 0
            total_occupancy += pct
            day_es = {
                "monday": "Monday", "tuesday": "Tuesday", "wednesday": "Wednesday",
                "thursday": "Thursday", "friday": "Friday", "saturday": "Saturday",
            }
            stream.write(f"    {day_es[slot.day]} {slot.hour.strftime('%H:%M')} -> {count} / {cap} ({pct:.0f}%)\n")
        avg = total_occupancy / len(self._all_slots)
        stream.write(f"  Average occupancy: {avg:.1f}%\n")

    def seed_phase3(self):
        with transaction.atomic():
            self._seed_exercises()
            self._seed_templates()
            self._seed_routine_exercises()
            self._seed_assignments()

    def _seed_exercises(self):
        exercises = [
            Exercise(gym=self.gym, name=edef["name"], category=edef["category"], description=edef.get("description", ""))
            for edef in EXERCISES
        ]
        created = Exercise.objects.bulk_create(exercises)
        self._exercise_map = {e.name: e for e in created}
        self.stats["exercises"] = len(created)

    def _seed_templates(self):
        templates = [
            RoutineTemplate(gym=self.gym, name=rdef["name"])
            for rdef in ROUTINES
        ]
        created = RoutineTemplate.objects.bulk_create(templates)
        self._template_map = {t.name: t for t in created}
        self.stats["templates"] = len(created)

    def _seed_routine_exercises(self):
        routine_exercises = []
        for rdef in ROUTINES:
            template = self._template_map[rdef["name"]]
            for edef in rdef["exercises"]:
                exercise = self._exercise_map[edef["exercise_name"]]
                routine_exercises.append(RoutineExercise(
                    routine_template=template,
                    exercise=exercise,
                    order=edef["order"],
                    sets=edef.get("sets", 3),
                    reps=edef.get("reps", "10"),
                    rest_seconds=edef.get("rest_seconds", 60),
                    exercise_type=edef.get("exercise_type", "strength"),
                    notes=edef.get("notes", ""),
                    rest_mode="between_sets",
                ))
        created = RoutineExercise.objects.bulk_create(routine_exercises)
        self._routine_exercises = created
        self.stats["routine_exercises"] = len(created)

    def _seed_assignments(self):
        random.seed(f"gym-demo-routines-{self.gym.id}")

        template_names = ["Full Body Principiante", "Push Pull Legs", "Upper Lower", "Cardio + Core"]
        template_counts = [10, 10, 10, 5]

        active_members = list(
            Member.objects.filter(gym=self.gym, active=True).order_by("id")
        )
        random.shuffle(active_members)

        assignments = []
        assigned_id = 0
        for tname, count in zip(template_names, template_counts):
            template = self._template_map[tname]
            for _ in range(count):
                member = active_members[assigned_id]
                assigned_id += 1
                assignments.append(RoutineAssignment(
                    gym=self.gym,
                    member=member,
                    routine_template=template,
                    active=True,
                ))

        created = RoutineAssignment.objects.bulk_create(assignments)
        self.stats["assignments"] = len(created)

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
        if "exercises" in self.stats:
            stream.write(f"  Exercises:          {self.stats['exercises']} ✓\n")
            stream.write(f"  Templates:          {self.stats['templates']} ✓\n")
            stream.write(f"  Routine exercises:  {self.stats['routine_exercises']} ✓\n")
            stream.write(f"  Assignments:        {self.stats['assignments']} ✓\n")
        if "slots" in self.stats:
            stream.write(f"  Schedule slots:     {self.stats['slots']} ✓\n")
            stream.write(f"  Attendance schedules:{self.stats['schedules']} ✓\n")
        if "attendance" in self.stats:
            stream.write(f"  Attendance records: {self.stats['attendance']} ✓\n")
            stream.write(f"  Members with attendance: {self.stats['attendance_members']}\n")
            stream.write(f"  Members without:    {self.stats['attendance_without']}\n")
            stream.write(f"  Avg per active:     {self.stats['attendance_avg']:.1f}\n")
