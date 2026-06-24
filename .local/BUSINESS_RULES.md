# Business Rules

> Update this document whenever architecture, business rules, audits or major features change.

## Member

### `active` Field

| Aspect | Meaning |
|---|---|
| `active = True` (default) | Member is active. Can check in, access portal, perform all operations. |
| `active = False` | **Currently under-enforced.** Only check-in is blocked. Portal reads and writes (workout logging, schedule changes, swaps, plan changes, renewal toggle) are all permitted. See AUDIT_LOG.md "Member.active Audit" for planned enforcement. |

**Current enforcement:** Only `PublicCheckinView.post` filters `Member.objects.filter(active=True)`. All other public views use `get_object_or_404(Member, access_token=token)` with no `active` filter.

**Intended behavior:** `active=False` should mean "account disabled — viewing allowed, modifications blocked." Enforcement is partially implemented (see TODO_MASTER.md).

### Access Token

- Auto-generated UUID on member creation (`members/models.py:save()`).
- Unique per member.
- Used as the authentication mechanism for the public member portal.
- The token appears in the portal URL: `https://<domain>/member/<token>/...`
- No password, no session. Token possession is the sole authentication factor.

### Member Lifecycle

1. **Registration** — Member is created via staff UI (`MemberForm`) or public registration (`PublicRegisterView` using `gym_code`).
2. **Active** — Default state. Member has a gym, access token, and can check in.
3. **Inactive** — `active=False` set via Django admin (no UI exists). Currently only blocks check-in.
4. **Deletion** — Hard delete via staff UI. No soft delete mechanism.

## Subscription

### Payment Status (derived by `get_subscription_payment_status`)

| Status | Meaning | Condition |
|---|---|---|
| `paid` | Subscription is paid for the current period | `subscription.paid = True` |
| `pending` | Subscription exists but not yet paid | `subscription.paid = False`, `end_date >= today` |
| `overdue` | Subscription period ended without payment | `subscription.paid = False`, `end_date < today`, days overdue ≤ gym's `access_block_day` |
| `blocked` | Payment delinquency exceeds grace period | `subscription.paid = False`, days overdue > gym's `access_block_day` |
| `initial_pending` | First subscription, not yet paid, still within due period | `subscription.paid = False`, first subscription, days since start ≤ gym's `payment_due_day` |

### `can_member_operate(member)` Gate

Returns `False` only for `blocked` and `initial_pending` statuses. Used by all public write endpoints (schedule changes, swaps, plan changes, renewal toggle, photo upload) to block members with delinquent payments. Also blocks check-in.

**Planned addition:** Also return `False` if `not member.active`, making this a combined "can member operate at all" gate.

### `auto_renew` Field

- `default=True` on the model but historically not propagated correctly — registration set it, but renewal/plan-change paths used the default, creating a broken chain where cron-renewed subscriptions had `auto_renew=False`.
- **Fix applied:** All creation paths (registration, manual renew, plan change immediate, cron) now explicitly copy `auto_renew` from the source subscription or default to `True`.

### Renewal Behavior

- Cron (`auto_renew_subscriptions`) runs monthly.
- Finds subscriptions ending this month where `auto_renew=True`.
- Skips first-subscription-unpaid (first subscription for a member that hasn't been paid).
- Creates new subscription for next month.
- Respects approved plan changes (new subscription uses the requested plan).

## Schedule Change

### Business Meaning

A schedule change is a **permanent recurring modification** to a member's weekly schedule. It replaces one recurring slot with another.

### Workflow

1. Member creates request via public portal (`POST /api/attendance/public/schedule-change-requests/<token>/`).
2. Staff reviews and approves/rejects via `ScheduleChangeRequestViewSet.approve/reject`.
3. On approval: old `AttendanceSchedule` is deactivated (`active=False`), new one is created or existing one reactivated.
4. No cron — execution is immediate on approval.

### Restrictions (enforced in `PublicScheduleChangeRequestSerializer.validate()`)

| Rule | Enforced? | Location |
|---|---|---|
| Gym must allow changes (`gym.allow_member_schedule_changes`) | ✅ | Line 460 |
| Notice period (`gym.schedule_change_notice_hours`) | ✅ | Lines 541-546 |
| Cooldown between requests (`gym.schedule_change_cooldown_hours`) | ✅ | Lines 480-490 |
| Monthly cap (`gym.max_schedule_changes_per_month`) | ✅ | Lines 492-501 |

## Schedule Swap

### Business Meaning

A schedule swap is a **one-time exception** for a single date. It does NOT modify the member's recurring schedule. The member checks in using the approved swap, which records attendance against the swapped slot for that date only.

### Workflow

1. Member creates swap request via public portal (`POST /api/attendance/public/schedule-swap-requests/<token>/`).
2. Staff approves/rejects via `ScheduleSwapRequestViewSet.approve/reject`.
3. On check-in day: member's approved swap is detected by `PublicCheckinView`, and attendance is recorded against the swap's destination slot.
4. The origin schedule remains active for future weeks.

### Enforced Restrictions

| Rule | Enforced? | Location |
|---|---|---|
| Origin schedule is active | ✅ | `validate_origin_schedule` |
| Belongs to same gym | ✅ | Both origin and destination |
| Not swapping to same slot | ✅ | |
| Destination not already assigned | ✅ | |
| Swap date matches destination weekday | ✅ | |
| Swap date must be future | ✅ | |
| No duplicate pending swap for same date | ✅ | |
| No pending schedule change for same weekday | ✅ | |
| Gym must allow changes (`allow_member_schedule_changes`) | ✅ | Added per audit — both staff and public serializers |
| Notice period (`schedule_change_notice_hours`) | ✅ | Added per audit — both staff and public serializers |

**Not enforced (by design):**
- Cooldown (`schedule_change_cooldown_hours`) — swaps are staff-approved one-offs.
- Monthly cap (`max_schedule_changes_per_month`) — staff approval is the natural throttle.

## Plan Change Request

### Business Meaning

A member requests to switch to a different membership plan. The change takes effect at the start of the next billing cycle (or immediately for some flows).

### Workflow

1. Member creates request via public portal (`POST /api/subscriptions/public/plan-change-requests/<token>/`).
2. Staff creates request via `PlanChangeRequestViewSet`.
3. Staff approves/rejects via `PlanChangeRequestViewSet.approve/reject`.
4. On approval: `effective_date` is set to the start of next month.
5. Cron (`apply_plan_changes`) activates it on `effective_date`.
6. During auto-renewal, if a member has an approved plan change, the renewal uses the requested plan instead of the current plan.
7. A separate "immediate" path exists in staff `SubscriptionViewSet` for instant plan changes.

### Restrictions (enforced in `PlanChangeRequestValidator`)

| Rule | Enforced? | Location |
|---|---|---|
| Member must have active subscription | ✅ | `_validate_active_subscription` |
| Gym must allow plan changes (`gym.allow_plan_changes`) | ✅ | `_validate_plan_changes_allowed` |
| Requested plan must belong to same gym | ✅ | `_validate_same_gym` |
| Must be a different plan | ✅ | `_validate_different_plan` |
| No duplicate pending request | ✅ | `_validate_no_duplicate_pending` |
| No already-approved future change | ✅ | `_validate_no_future_approved` |
| Target schedule must have capacity | ✅ | `_validate_schedule_capacity` |
| Schedule count must match plan's weekly visits | ✅ | `_validate_schedule_count` |

## Attendance

### Check-in Flow

1. Staff or member-facing page generates a check-in URL with the member's access token.
2. `PublicCheckinView.post` looks up member (must be `active=True` and pass `can_member_operate`).
3. If member has an approved swap for today, attendance is recorded against the swap's destination slot.
4. Otherwise, attendance is recorded against their regular schedule (or as walk-in if no schedule).
5. Duplicate check-in for same date is prevented (unique_together on `(gym, schedule, date)` and explicit check).

### Occupancy Calculation (`compute_effective_occupancy`)

```python
effective = active_recurring_schedules + approved_swaps_in - approved_swaps_out
```

Capacity is checked at check-in time, not at swap creation time. Swaps can be approved for over-capacity slots — the member will be denied at check-in.

## Gym Configuration

### Inventory of All Gym Configuration Fields

| Field | Type | Default | Purpose | Enforced? | Enforcement Location |
|---|---|---|---|---|---|
| `default_schedule_capacity` | PositiveInteger | null | Default capacity for slots without explicit capacity | ✅ | `ScheduleChangeRequestSerializer`, `PublicScheduleChangeRequestSerializer`, `PublicCheckinView` |
| `allow_member_schedule_changes` | Boolean | False | Master toggle for member self-service schedule changes | ✅ | `PublicScheduleChangeRequestSerializer`, `ScheduleSwapRequestSerializer` (both added per audit) |
| `schedule_change_notice_hours` | PositiveInteger | 24 | Minimum hours before a change must be requested | ✅ | `PublicScheduleChangeRequestSerializer`, `ScheduleSwapRequestSerializer` (both added per audit) |
| `payment_due_day` | PositiveInteger | 10 | Day of month payment is due (for `initial_pending` calculation) | ✅ | `get_subscription_payment_status` |
| `access_block_day` | PositiveInteger | 16 | Days overdue before member is blocked | ✅ | `get_subscription_payment_status` (blocked status) |
| `allow_plan_changes` | Boolean | True | Master toggle for plan change requests | ✅ | `PlanChangeRequestValidator._validate_plan_changes_allowed` |
| `schedule_change_cooldown_hours` | PositiveInteger | 168 | Hours a member must wait between schedule changes | ✅ | `PublicScheduleChangeRequestSerializer` only |
| `max_schedule_changes_per_month` | PositiveInteger | 4 | Maximum schedule changes allowed per month per member | ✅ | `PublicScheduleChangeRequestSerializer` only |
| `allow_schedule_changes` | Boolean | True | **Deprecated.** Duplicate of `allow_member_schedule_changes` from Phase 8A migration. Not used anywhere. | ❌ | None |
| `schedule_change_notice_days` | PositiveInteger | 0 | **Deprecated.** Duplicate of `schedule_change_notice_hours` from Phase 8A migration. Not used anywhere. | ❌ | None |

### Deprecated Fields (Phase 8A Migration `0008`)

The migration `0008_phase8a_gym_config.py` added `allow_schedule_changes` and `schedule_change_notice_days` as duplicates of existing fields (`allow_member_schedule_changes` and `schedule_change_notice_hours`). These duplicates are not enforced anywhere and should be ignored.

## Current Business Decisions

| Decision | Context | Date |
|---|---|---|
| Schedule swaps are one-time exceptions, not permanent changes. They should NOT be governed by cooldown or monthly caps. | Schedule Swap Audit | 2026-06 |
| `allow_member_schedule_changes` and `schedule_change_notice_hours` SHOULD apply to swaps. | Schedule Swap Audit | 2026-06 |
| `Member.active` should mean "viewing allowed, modifications blocked." | Member.active Audit | 2026-06 |
| Pagination fix: Frontend should fetch all pages for list endpoints, not just page 1. | Pagination Audit | 2026-06 |
| `can_member_operate()` should be the single centralized gate for all public write endpoints. | Workout Progress Audit | 2026-06 |
| `auto_renew` must propagate correctly across all creation paths (registration, renew, plan change). | Auto-renew Bug | 2026-06 |
