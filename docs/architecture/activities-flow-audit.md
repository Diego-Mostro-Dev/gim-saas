# Activities Flow Audit

Generated: 2026-07-15
Scope: Complete functional audit of the Activities integration flow

---

## Flow Summary

```
Member → Activity → ActivitySchedule → Enrollment → SubscriptionItem → Member Portal → Gym Dashboard
```

---

## 1. Activity.monthly_price

| Aspect | Detail |
|--------|--------|
| **Model** | `Activity.monthly_price` — `DecimalField(max_digits=10, decimal_places=2, default=0)` |
| **File** | `backend/activities/models.py:28-34` |
| **Backend exposure** | `ActivitySerializer` includes `monthly_price` field (`serializers.py:30`) |
| **Admin UI** | `ActivityCard.jsx:56-59` — displays `${activity.monthly_price}/mes` |
| **Admin form** | `ActivityForm.jsx:68-70` — editable field |
| **Member portal** | **NOT EXPOSED** — `PublicAvailableActivitiesView` and `PublicEnrollmentSerializer` do not include `monthly_price` |
| **Status** | **IMPLEMENTED BUT NOT EXPOSED IN THE UI (member-facing)** |

---

## 2. Activity → Service relationship

| Aspect | Detail |
|--------|--------|
| **Model** | `Activity.service` — `ForeignKey(Service, on_delete=PROTECT)` |
| **File** | `backend/activities/models.py:20-25` |
| **Constraint** | `unique_together = ("service", "name")` — same service cannot have duplicate activity names |
| **Admin creation** | `ActivitySerializer.create()` defaults to `Service.get_default_activities_service(gym)` if no service provided (`serializers.py:73-76`) |
| **Enrollment check** | `EnrollmentService.enroll_member()` validates `member_has_active_subscription_for_service(member, schedule.activity.service)` |
| **Status** | **COMPLETE** |

---

## 3. Enrollment creation

| Aspect | Detail |
|--------|--------|
| **Model** | `Enrollment` — FKs to Gym, Member, ActivitySchedule |
| **File** | `backend/activities/models.py:100-138` |
| **Service** | `EnrollmentService.enroll_member(member, schedule)` — `enrollment_service.py:26-65` |
| **Business rules** | 1. `can_member_operate(member)` — payment status check |
| | 2. `member_has_active_subscription_for_service(member, service)` — subscription validation |
| | 3. Capacity check — `active_count >= schedule.capacity` |
| | 4. Duplicate check — already enrolled in same schedule |
| | 5. Overlap check — `validate_enrollment(member, schedule)` — gym schedule + activity overlap |
| **Transaction** | Atomic — creates `Enrollment` + `_ensure_activity_item()` (SubscriptionItem) |
| **Admin API** | `ScheduleEnrollmentViewSet.enroll()` — `views.py:149-170` |
| **Member API** | `PublicMemberEnrollView.post()` — `public_views.py:174-206` |
| **Status** | **COMPLETE** |

---

## 4. ActivitySchedule selection

| Aspect | Detail |
|--------|--------|
| **Model** | `ActivitySchedule` — FK to Activity, fields: day, start_time, end_time, capacity, active |
| **File** | `backend/activities/models.py:66-97` |
| **Constraint** | `unique_together = ("activity", "day", "start_time")` — per-activity uniqueness |
| **Overlap validation** | `ActivityScheduleSerializer._validate_no_overlap()` — checks same activity+day overlaps |
| **Admin CRUD** | `ActivityScheduleViewSet` — nested under activity_id (`views.py:108-147`) |
| **Admin UI** | `ActivitySchedules.jsx` — full CRUD with ScheduleCard + ScheduleForm |
| **Member selection** | `MemberActivities.jsx:58-73` — schedule picker fetches `getAvailableActivities(token, {activity_id})` |
| **Public API** | `PublicAvailableActivitiesView` — returns activities with available schedules |
| **Status** | **COMPLETE** |

---

## 5. SubscriptionItem creation

| Aspect | Detail |
|--------|--------|
| **Model** | `SubscriptionItem` — FKs to Subscription, plan (nullable), activity (nullable) |
| **File** | `backend/subscriptions/models.py:160-243` |
| **Item types** | `"plan"` or `"activity"` — `item_type` field |
| **Unique constraints** | `unique_active_plan_item_per_subscription` + `unique_active_activity_item_per_subscription` |
| **Creation trigger** | `_ensure_activity_item(member, activity)` in `enrollment_service.py:90-115` |
| **Created on** | `EnrollmentService.enroll_member()` — atomic transaction after Enrollment creation |
| **Cancellation** | `_cancel_activity_item(member, activity)` — `enrollment_service.py:118-128` |
| **Bulk ensure** | `ensure_subscription_items(subscription)` in `subscriptions/services.py` — creates plan + activity items on subscription creation |
| **Status** | **COMPLETE** |

---

## 6. price_snapshot generation

| Aspect | Detail |
|--------|--------|
| **Field** | `SubscriptionItem.price_snapshot` — `DecimalField(max_digits=10, decimal_places=2)` |
| **File** | `backend/subscriptions/models.py:206-210` |
| **On enrollment** | `_ensure_activity_item()` sets `price_snapshot=activity.monthly_price` (`enrollment_service.py:111`) |
| **On subscription creation** | `ensure_subscription_items()` in `subscriptions/services.py:58` — `"price_snapshot": activity.monthly_price` |
| **On public enrollment** | `PublicMemberEnrollView` → `EnrollmentService.enroll_member()` → `_ensure_activity_item()` — same path |
| **Snapshot semantics** | Price is captured at enrollment time, not updated when activity price changes |
| **Status** | **COMPLETE** |

---

## 7. Member portal

### 7a. ActivityDashboard (`frontend/src/pages/member/ActivityDashboard.jsx`)

| Feature | Status |
|---------|--------|
| Lists enrolled activities with name, day, time | **COMPLETE** |
| Shows upcoming activities with relative day labels | **COMPLETE** |
| Shows subscription plan name | **COMPLETE** |
| Shows subscription total (plan + activities) when total > plan_price | **COMPLETE** |
| Shows last payment info | **COMPLETE** |
| Shows per-activity pricing in the activity list | **NOT EXPOSED** |
| Shows activity pricing in the "Mis actividades" section | **NOT EXPOSED** |

### 7b. MemberActivities (`frontend/src/pages/MemberActivities.jsx`)

| Feature | Status |
|---------|--------|
| Lists active enrollments with name, day, time | **COMPLETE** |
| Cancel enrollment with confirmation modal | **COMPLETE** |
| Orphaned enrollments (schedule deactivated) — pick new schedule or activity | **COMPLETE** |
| Deactivated enrollments (activity deactivated) — shows notice | **COMPLETE** |
| Schedule picker — choose different schedule for same activity | **COMPLETE** |
| Activity picker — choose different activity at same time | **COMPLETE** |
| Shows per-activity price when browsing available activities | **NOT EXPOSED** |
| Shows per-activity price in the enrollment list | **NOT EXPOSED** |

### 7c. GymDashboard (`frontend/src/pages/member/GymDashboard.jsx`)

| Feature | Status |
|---------|--------|
| Shows subscription plan name | **COMPLETE** |
| Shows plan price labeled "Precio del plan" | **COMPLETE** |
| Shows activity items with individual prices | **COMPLETE** |
| Shows "Total mensual" when total > plan_price | **COMPLETE** |
| Shows payment status, days remaining | **COMPLETE** |
| Shows visit limit vs attendance count | **COMPLETE** |

### 7d. CurrentPlanCard (`frontend/src/components/plans/CurrentPlanCard.jsx`)

| Feature | Status |
|---------|--------|
| Shows plan name, price, duration, visits | **COMPLETE** |
| Shows activity items with individual prices | **COMPLETE** |
| Shows total (plan + activities) when activities exist | **COMPLETE** |
| Shows subscription status (Activo/Vence hoy/Vencido) | **COMPLETE** |

### 7e. PlanChangeModal (`frontend/src/components/plans/PlanChangeModal.jsx`)

| Feature | Status |
|---------|--------|
| Shows current plan with activities list | **COMPLETE** |
| Shows "Las actividades actuales se mantendrán sin cambios" note | **COMPLETE** |
| Plan selection with pricing | **COMPLETE** |

---

## 8. Gym dashboard (admin)

### 8a. SubscriptionCard (`frontend/src/components/subscriptions/SubscriptionCard.jsx`)

| Feature | Status |
|---------|--------|
| Shows member name, plan name | **COMPLETE** |
| Shows plan price | **COMPLETE** |
| Shows activity items with individual prices | **COMPLETE** |
| Shows total (plan + activities) | **COMPLETE** |
| Shows start/end dates, status, paid/pending | **COMPLETE** |
| Edit, delete, renew actions | **COMPLETE** |

### 8b. PendingPayments (`frontend/src/components/dashboard/PendingPayments.jsx`)

| Feature | Status |
|---------|--------|
| Shows pending payment amount | **COMPLETE** — backend computes total = plan.price + activity sum, stores in `plan_price` field |
| Shows member name, plan name, end date | **COMPLETE** |
| Click navigates to payment form with prefill | **COMPLETE** |

### 8c. Admin Dashboard (`backend/config/api/dashboard.py`)

| Feature | Status |
|---------|--------|
| `pending_payments_data` computes total with activity items | **COMPLETE** (lines 162-179) |
| `plan_price` field in response = total (plan + activities) | **COMPLETE** |

---

## 9. Subscription summary

### 9a. `_build_sub_data()` in `routines/views.py:449-502`

Returns to member portal:
- `plan`, `plan_price` (plan component only)
- `items` — array of active activity SubscriptionItems with `id`, `item_type`, `name`, `price`, `activity_id`
- `total` — plan.price + sum(activity item prices)

**Status**: **COMPLETE**

### 9b. `SubscriptionSerializer` in `subscriptions/serializers.py`

Returns to admin:
- `plan_name`, `plan_price` (plan component only)
- `items` — nested `SubscriptionItemSerializer` with `activity_name`, `price_snapshot`
- `total` — computed field: plan.price + sum(active activity items)

**Status**: **COMPLETE**

---

## 10. APIs that already expose the information

| API | Endpoint | monthly_price | items | total | Status |
|-----|----------|---------------|-------|-------|--------|
| Admin Activity CRUD | `/api/activities/activities/` | YES (via serializer) | N/A | N/A | **COMPLETE** |
| Admin Schedule CRUD | `/api/activities/{id}/schedules/` | N/A | N/A | N/A | **COMPLETE** |
| Admin Enrollment | `/api/activities/schedules/{id}/enroll/` | N/A | N/A | N/A | **COMPLETE** |
| Admin Subscription | `/api/subscriptions/subscriptions/` | N/A | YES (nested) | YES (computed) | **COMPLETE** |
| Admin Dashboard | `/api/dashboard/` pending_payments | N/A | N/A | YES (in plan_price) | **COMPLETE** |
| Member Routine | `/api/routine/public/{token}/` | N/A | YES (items array) | YES (total) | **COMPLETE** |
| Member Enrollments | `/api/activities/public/{token}/` | **NO** | N/A | N/A | **MISSING** |
| Member Available Activities | `/api/activities/public/{token}/available/` | **NO** | N/A | N/A | **MISSING** |
| Member Public Gym Activities | `/api/activities/public/gym/{code}/` | **NO** | N/A | N/A | **MISSING** |

---

## 11. Frontend that actually consumes it

| Component | Data source | monthly_price shown? | items shown? | total shown? |
|-----------|------------|---------------------|-------------|-------------|
| ActivityCard (admin) | ActivitySerializer | YES | N/A | N/A |
| ActivityForm (admin) | ActivitySerializer | YES (editable) | N/A | N/A |
| SubscriptionCard (admin) | SubscriptionSerializer | N/A | YES | YES |
| PendingPayments (admin) | dashboard.py | N/A | N/A | YES (as plan_price) |
| CurrentPlanCard (member) | _build_sub_data | N/A | YES | YES |
| GymDashboard (member) | _build_sub_data | N/A | YES | YES |
| ActivityDashboard (member) | _build_sub_data | N/A | NO | YES (conditional) |
| MemberActivities (member) | PublicEnrollmentSerializer | **NO** | N/A | N/A |
| PlanChangeModal (member) | subscription data | N/A | YES | N/A |
| PlanChangeRequests (admin) | PlanChangeRequestSerializer | N/A | N/A | N/A |

---

## Inconsistencies between backend and frontend

### 1. Member cannot see activity price before enrolling

- **Backend**: `PublicAvailableActivitiesView` (`public_views.py:156-161`) returns `id`, `name`, `description`, `schedules` — no `monthly_price`
- **Backend**: `PublicGymActivitiesView` (`public_views.py:103-108`) returns same — no `monthly_price`
- **Frontend**: `MemberActivities.jsx` shows activity name and schedule — no price
- **Impact**: Members cannot see what they'll be charged before enrolling

### 2. Member cannot see per-activity price on their enrollment list

- **Backend**: `PublicEnrollmentSerializer` (`serializers.py:137-160`) — no price field
- **Frontend**: `MemberActivities.jsx:194-201` — shows `activity_name`, `day`, `start_time`, `end_time` — no price
- **Impact**: Members cannot see individual activity costs

### 3. ActivityDashboard shows subscription total but not per-activity breakdown

- **Backend**: `_build_sub_data()` returns `items` array with per-activity prices
- **Frontend**: `ActivityDashboard.jsx:180-196` — shows subscription plan name and conditional total, but does NOT display the `items` array
- **Impact**: Members see "Total mensual" but cannot see which activities contribute to it

### 4. PlanChangeRequest snapshots do not include activity enrollments

- **Model**: `PlanChangeRequest.current_schedules_snapshot` / `target_schedules_snapshot` — gym-level schedule data only
- **Model**: `PlannedSchedule` — FK to `ScheduleSlot` (gym-level), no Activity FK
- **Impact**: Activity enrollments are not migrated or referenced during plan changes. The UI note "Las actividades actuales se mantendrán sin cambios" is accurate but the backend has no mechanism to enforce this during auto-renewal or plan change execution.

### 5. ScheduleChangeRequest / ScheduleSwapRequest cannot handle activities

- **Model**: `ScheduleChangeRequest.current_schedule` — FK to `AttendanceSchedule` (gym-level only)
- **Model**: `ScheduleSwapRequest.origin_schedule` — FK to `AttendanceSchedule` (gym-level only)
- **Impact**: Members cannot request schedule changes or swaps for activity enrollments through the existing request system

### 6. Attendance check-in has no activity context

- **Model**: `AttendanceSchedule` — links Member ↔ ScheduleSlot (gym-level), no Activity FK
- **Model**: `Attendance` — links to `AttendanceSchedule`, no Activity FK
- **Impact**: When a member checks in, the system cannot record which activity they attended

---

## Classification summary

| Feature | Status |
|---------|--------|
| Activity CRUD (admin) | **COMPLETE** |
| ActivitySchedule CRUD (admin) | **COMPLETE** |
| Activity pricing (admin) | **COMPLETE** |
| Enrollment via admin | **COMPLETE** |
| Enrollment via member portal | **COMPLETE** |
| SubscriptionItem creation on enrollment | **COMPLETE** |
| price_snapshot generation | **COMPLETE** |
| Overlap validation (gym + activity) | **COMPLETE** |
| Capacity validation | **COMPLETE** |
| Subscription total computation | **COMPLETE** |
| Member portal subscription display | **COMPLETE** |
| Admin subscription display with activities | **COMPLETE** |
| Admin pending payments with activity totals | **COMPLETE** |
| Member activity browsing with price | **NOT EXPOSED** |
| Member enrollment list with price | **NOT EXPOSED** |
| ActivityDashboard per-activity breakdown | **NOT EXPOSED** |
| Activity schedule change requests | **NOT IMPLEMENTED** |
| Activity schedule swap requests | **NOT IMPLEMENTED** |
| Activity attendance tracking | **NOT IMPLEMENTED** |
| Plan change activity migration | **NOT IMPLEMENTED** |

---

## Estimated completion

- **Backend models + services**: 100%
- **Backend APIs**: 85% (member-facing endpoints missing `monthly_price`)
- **Admin frontend**: 100%
- **Member portal frontend**: 75% (activity pricing not shown to members)
- **Overall**: **~85%**

---

## What is already complete

1. Activity CRUD with pricing (admin)
2. ActivitySchedule CRUD with overlap validation (admin)
3. Enrollment with all business rules (subscription check, capacity, overlap, duplicate)
4. SubscriptionItem creation/cancellation on enrollment/unenrollment
5. price_snapshot captured at enrollment time
6. Subscription total = plan.price + activity items
7. Member portal: activity list, schedule picker, activity picker, cancel/enroll flows
8. Member portal: subscription summary with plan + activities + total
9. Admin: subscription cards with activity breakdown
10. Admin: pending payments with activity-adjusted totals
11. Plan change modal shows activities and preservation note

---

## What is still missing

1. `PublicAvailableActivitiesView` — add `monthly_price` to response
2. `PublicGymActivitiesView` — add `monthly_price` to response
3. `PublicEnrollmentSerializer` — add per-activity price field
4. `ActivityDashboard.jsx` — display `items` array as per-activity price breakdown
5. `MemberActivities.jsx` — show price next to each enrollment and in activity browser

---

## What should be the next PR

**PR: Expose activity pricing to members**

Files to modify:
- `backend/activities/public_views.py` — add `monthly_price` to `PublicAvailableActivitiesView` and `PublicGymActivitiesView` responses
- `backend/activities/serializers.py` — add `monthly_price` field to `PublicEnrollmentSerializer`
- `frontend/src/pages/member/ActivityDashboard.jsx` — display per-activity price breakdown from `items` array
- `frontend/src/pages/MemberActivities.jsx` — show price next to each enrollment and in activity browser

This is a small, self-contained PR that closes the pricing visibility gap for members without touching any backend business logic.
