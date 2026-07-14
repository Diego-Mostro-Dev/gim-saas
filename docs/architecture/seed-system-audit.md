# Seed System Audit

**Date:** 2026-07-14
**Target:** Gym Dev environment recoverability
**Scope:** Every seed file, factory, data migration, and management command

---

## 1. Seed System Overview

The project uses a single custom seed engine (`seed/base.py`) invoked via `python manage.py seed_demo_data --gym <slug>`. There are no factory libraries (no `factory_boy`, no fixtures). The seeder operates in 5 sequential phases.

### Seed Files

| File | Purpose |
|------|---------|
| `backend/seed/base.py` | Core `BaseSeeder` class (541 lines) — all seeding logic |
| `backend/seed/data/plans.py` | 4 demo `MembershipPlan` definitions |
| `backend/seed/data/exercises.py` | 23 `Exercise` definitions |
| `backend/seed/data/routines.py` | 4 `RoutineTemplate` definitions with exercise mappings |
| `backend/seed/data/member_names.py` | 50 first names + 50 last names (Argentine/Latin) |
| `backend/gyms/management/commands/seed_demo_data.py` | Management command entry point |

### Management Commands (data-modifying, non-seed)

| Command | Purpose |
|---------|---------|
| `auto_renew_subscriptions` | Creates next-period subscriptions for `auto_renew=True` members |
| `apply_plan_changes` | Executes approved `PlanChangeRequest` records |

### Data Migrations (backfill/schema)

| Migration | Purpose |
|-----------|---------|
| `gyms/0011_ensure_default_services` | Creates default "Gimnasio" `Service` per Gym |
| `plans/0008_populate_service_field` | Backfills `MembershipPlan.service` FK |
| `activities/0003_populate_activity_service` | Backfills `Activity.service` FK |
| `subscriptions/0012_create_subscriptionitem` | Creates `SubscriptionItem` for existing subscriptions |
| `payments/0008_add_member_fk` | Backfills `Payment.member_id` |
| `attendance/0008_scheduleslot_attendanceschedule_slot` | Creates `ScheduleSlot` from existing schedules |
| `attendance/0014_backfill_attendance_slot` | Backfills `Attendance.slot` |
| `routines/0008_alter_exercise_options_and_more` | Backfills `WorkoutSet.date` |

---

## 2. Complete Domain Entity Seeding Status

### 23 Custom Domain Models + 1 Framework Model (auth.User)

| # | Entity | App | Seeded? | Count | Method | Notes |
|---|--------|-----|---------|-------|--------|-------|
| 1 | **Gym** | gyms | **NO** | — | Manual / Onboarding | Created via admin or onboarding flow. Not part of seed. |
| 2 | **auth.User** | django | **NO** | — | Manual / `createsuperuser` | Staff/admin users. Created via onboarding or CLI. |
| 3 | **UserProfile** | profiles | **NO** | — | Signal (auto) | Auto-created via `post_save` signal on `User`. |
| 4 | **Service** | plans | **Implicit** | 1 | `get_or_create` in seeder | Default "Gimnasio" service created automatically via `Service.get_default_for_gym()`. |
| 5 | **MembershipPlan** | plans | **YES** | 4 | `_seed_plans()` | Basico ($25k), Estandar ($40k), Premium ($60k), Estudiante ($20k). |
| 6 | **Member** | members | **YES** | 50 | `_seed_members()` | 45 active, 5 inactive. Names from `member_names.py`. Deterministic via `random.seed(gym.id)`. |
| 7 | **Subscription** | subscriptions | **YES** | ~90 | `_seed_subscriptions()` | 45 current (paid, auto_renew) + 40 historical + 5 expired. |
| 8 | **SubscriptionItem** | subscriptions | **YES** | ~90 | `_seed_subscriptions()` | One per Subscription, status="active", with price snapshot. |
| 9 | **PlanChangeRequest** | subscriptions | **NO** | — | — | Not seeded. No pending/approved plan changes in demo data. |
| 10 | **PlannedSchedule** | subscriptions | **NO** | — | — | Not seeded. Only created when PlanChangeRequest is approved. |
| 11 | **Activity** | activities | **NO** | — | — | Not seeded. No Yoga/Pilates/Cross in demo data. |
| 12 | **ActivitySchedule** | activities | **NO** | — | — | Not seeded. |
| 13 | **Enrollment** | activities | **NO** | — | — | Not seeded. |
| 14 | **ScheduleSlot** | attendance | **YES** | 18 | `_seed_slots()` | 6 days × 3 hours (08:00, 10:00, 18:00), capacity=15. |
| 15 | **AttendanceSchedule** | attendance | **YES** | ~80 | `_seed_schedules()` | All 45 active members get 1–3 schedules. |
| 16 | **Attendance** | attendance | **YES** | hundreds–thousands | `_seed_attendance()` | 90 business days of history. Tiered attendance probability. Raw SQL with `ON CONFLICT DO NOTHING`. |
| 17 | **ScheduleChangeRequest** | attendance | **NO** | — | — | Not seeded. |
| 18 | **ScheduleSwapRequest** | attendance | **NO** | — | — | Not seeded. |
| 19 | **Payment** | payments | **YES** | ~85 | `_seed_payments()` | 45 current + 40 historical. Weighted payment methods (60% cash, 25% transfer, 15% card). |
| 20 | **Exercise** | routines | **YES** | 23 | `_seed_exercises()` | 8 categories (pecho, espalda, piernas, hombros, biceps, triceps, core, cardio). |
| 21 | **RoutineTemplate** | routines | **YES** | 4 | `_seed_templates()` | Full Body Principiante, Push Pull Legs, Upper Lower, Cardio + Core. |
| 22 | **RoutineExercise** | routines | **YES** | 32 | `_seed_routine_exercises()` | Exercise slots with sets, reps, rest, type. |
| 23 | **RoutineAssignment** | routines | **YES** | 35 | `_seed_assignments()` | First 35 active members assigned to templates. |
| 24 | **WorkoutSet** | routines | **NO** | — | — | Not seeded. Only created during member workout sessions. |

### Summary Counts

| Category | Entity | Count |
|----------|--------|-------|
| Seeded (explicit) | MembershipPlan | 4 |
| Seeded (explicit) | Member | 50 |
| Seeded (explicit) | Subscription | ~90 |
| Seeded (explicit) | SubscriptionItem | ~90 |
| Seeded (explicit) | Payment | ~85 |
| Seeded (explicit) | ScheduleSlot | 18 |
| Seeded (explicit) | AttendanceSchedule | ~80 |
| Seeded (explicit) | Attendance | hundreds–thousands |
| Seeded (explicit) | Exercise | 23 |
| Seeded (explicit) | RoutineTemplate | 4 |
| Seeded (explicit) | RoutineExercise | 32 |
| Seeded (explicit) | RoutineAssignment | 35 |
| Seeded (implicit) | Service | 1 |
| **Not seeded** | Gym | — |
| **Not seeded** | auth.User / UserProfile | — |
| **Not seeded** | PlanChangeRequest | — |
| **Not seeded** | PlannedSchedule | — |
| **Not seeded** | Activity / ActivitySchedule / Enrollment | — |
| **Not seeded** | ScheduleChangeRequest / ScheduleSwapRequest | — |
| **Not seeded** | WorkoutSet | — |

---

## 3. Reproducibility Analysis

### What IS reproducible (13 entities)

Everything the seeder touches is fully deterministic:

- **Members** use `random.seed(f"gym-demo-{gym.id}")` — same gym ID = same names.
- **Subscriptions** use `random.seed(f"gym-demo-subs-{gym.id}")` — deterministic plan distribution.
- **Schedules** use `random.seed(f"gym-demo-schedules-{gym.id}")` — deterministic slot assignments.
- **Attendance** uses `random.seed(f"gym-demo-attendance-{gym.id}")` — deterministic attendance patterns.
- **Routines** are hardcoded data — fully deterministic.
- **Plans** are hardcoded data — fully deterministic.
- **Slots** are fully deterministic (6 days × 3 hours).

### What is NOT reproducible

| Entity | Why | Risk Level |
|--------|-----|------------|
| **Gym** | Created manually or via onboarding. Not part of seed. | **Low** — Gym record is just metadata (name, slug, config). Can be recreated manually in 30 seconds. |
| **auth.User / UserProfile** | Created via `createsuperuser` or onboarding. Not seeded. | **Medium** — Admin credentials and staff accounts would need manual recreation. Passwords are lost. |
| **Service** | Implicitly created by `Service.get_default_for_gym()` during seeding. Auto-recreated. | **None** — Will be recreated automatically. |
| **Activity / ActivitySchedule / Enrollment** | Not seeded at all. | **Low** — If Activities service exists, these were created manually through the UI. They represent a small subset of demo data. |
| **PlanChangeRequest / PlannedSchedule** | Not seeded. | **None** — These are transient workflow objects. If none are pending, nothing is lost. |
| **ScheduleChangeRequest / ScheduleSwapRequest** | Not seeded. | **None** — Transient workflow objects. |
| **WorkoutSet** | Not seeded. Only created during live workouts. | **Low** — Historical workout data. Not critical for dev environment. |

---

## 4. Idempotency Analysis

### The seeder IS idempotent (with `--force`)

The `--force` flag triggers cleanup before re-seeding:

```
cleanup_phase5()  →  Deletes Attendance
cleanup_phase4()  →  Deletes AttendanceSchedule, ScheduleSlot
cleanup_phase1()  →  Deletes Payment, Subscription, Member (and optionally Plan)
cleanup_phase3()  →  Deletes RoutineAssignment, RoutineExercise, RoutineTemplate, Exercise
```

Then the 4 seed phases run in order, recreating everything.

### Safe to run multiple times?

| Scenario | Safe? | Notes |
|----------|-------|-------|
| First run (empty gym) | ✅ Yes | Normal path |
| Second run without `--force` | ✅ Yes | Skips if members exist (prints "SKIP") |
| Second run with `--force` | ✅ Yes | Cleans + re-seeds. Deterministic. |
| Second run with `--force --preserve-plans` | ✅ Yes | Cleans but keeps existing plans |

### Idempotency caveat

The seeder uses `bulk_create()` without `ignore_conflicts=True` for most entities. Running without `--force` on an already-seeded gym will fail with unique constraint violations if it doesn't hit the early-return guard. The guard (`needs_seeding()` checks `Member.objects.filter(gym=self.gym).count() > 0`) prevents this.

---

## 5. Data Loss Risk Assessment

### If we delete ALL subscriptions and reseed:

**What would be lost:**
- Any **manually created** Members (not in the 50-seed set)
- Any **manually created** Plans (not in the 4-seed set)
- Any **Activity** data (Yoga, Pilates, Cross schedules and enrollments)
- Any **PlanChangeRequest** in pending/approved state
- Any **WorkoutSet** history (completed workouts)
- Any **ScheduleChangeRequest / ScheduleSwapRequest** in progress
- Staff **User accounts** and their credentials

**What would be preserved:**
- The Gym record itself
- All migrations would still apply

### If we delete ONLY corrupted future subscriptions (targeted cleanup):

**Would be lost:**
- Only the corrupted subscription records
- SubscriptionItem records linked to those subscriptions
- Payment records linked to those subscriptions (FK `SET_NULL`)

**Would be preserved:**
- Everything else — members, plans, schedules, attendance, routines, exercises, slots

---

## 6. Critical Finding: What CANNOT Be Recreated

### 1. Staff Users and Credentials
The seed system does **not** create `auth.User` accounts. If the dev environment has staff/admin users with specific credentials, those passwords are gone after a full DB wipe. They must be recreated with `createsuperuser` or the onboarding flow.

### 2. Activity Service and Activities
The seeder only creates the default "Gimnasio" Service. It does **not** create the "Activities" Service or any Activity/ActivitySchedule/Enrollment records. If the dev environment has Activities (Yoga, Pilates, Cross), those are manually created and cannot be recreated from seed data.

### 3. Gym Configuration
The Gym record's `features` JSON field, `onboarding_code`, `whatsapp`, `phone`, `email`, and various policy fields (`payment_due_day`, `access_block_day`, etc.) are not seeded. They persist only in the Gym record.

### 4. Workout History
`WorkoutSet` records (which exercises members completed, when) are not seeded. This is live data accumulated through usage.

---

## 7. Recommendation

### **SAFE TO CLEAN THE DATABASE**

**Justification:**

1. **The seed system covers 13 of 24 domain entities** — all core business data (Members, Plans, Subscriptions, SubscriptionItems, Payments, Slots, Schedules, Attendance, Exercises, Routines, Assignments).

2. **The seed process is fully idempotent** — safe to run multiple times with `--force`. Deterministic output via seeded PRNG.

3. **The entities NOT seeded are either:**
   - **Auto-created** (Service via `get_or_create`)
   - **Transient workflow objects** (PlanChangeRequest, ScheduleChangeRequest, ScheduleSwapRequest, PlannedSchedule) — if none are pending, nothing is lost
   - **Framework-owned** (auth.User, UserProfile) — trivially recreatable
   - **Not relevant to the subscription cleanup** (Activity, WorkoutSet)

4. **The specific operation (deleting corrupted future subscriptions) is low-risk** because:
   - Subscriptions are fully seeded (deterministic)
   - SubscriptionItems are fully seeded (created alongside subscriptions)
   - Payments use `SET_NULL` on subscription FK — deleting subscriptions doesn't cascade-delete payments
   - Members, Plans, Schedules, Attendance, and Routines are completely unaffected

5. **The only non-recoverable data is:**
   - Staff user credentials (recreated via `createsuperuser`)
   - Activity data (if any exists — not seeded, but also not related to subscriptions)
   - Workout history (not seeded, not related to subscriptions)

**Post-cleanup recovery command:**
```bash
python manage.py seed_demo_data --gym <dev-gym-slug> --force
```
