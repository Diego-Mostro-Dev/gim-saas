# Audit Log

> Update this document whenever architecture, business rules, audits or major features change.

## Completed Audits

### Auto-Renew Propagation Audit

**Date:** 2026-06  
**Status:** Complete (fixed)

**Finding:** `Subscription.auto_renew` was set to `True` in the registration serializer but all three renewal/plan-change creation paths (manual renew, plan change immediate execution, cron auto-renew) omitted `auto_renew` from the creation call, causing the model default (`True`) to be used inconsistently — and in some cases the cron path was not setting it at all, causing renewed subscriptions to have `auto_renew=False`, breaking the chain.

**Resolution:**
- `subscriptions/views.py:51` (manual renew): added `auto_renew=subscription.auto_renew`
- `subscriptions/views.py:152` (plan change immediate): added query to get current subscription's `auto_renew`
- `auto_renew_subscriptions.py:73` (cron): added `auto_renew=sub.auto_renew`
- Tests updated to assert propagation.

**Files Modified:**
- `backend/subscriptions/views.py`
- `backend/subscriptions/management/commands/auto_renew_subscriptions.py`
- `backend/subscriptions/tests.py`

---

### Gym Configuration Enforcement Audit (Phase 8A)

**Date:** 2026-06  
**Status:** Complete (partially fixed)

**Finding:** The Phase 8A migration (`0008`) added 5 gym configuration fields. Three were unenforced: `allow_plan_changes`, `max_schedule_changes_per_month`, `schedule_change_cooldown_hours`. Two fields (`allow_schedule_changes`, `schedule_change_notice_days`) were duplicates of existing fields and marked as deprecated.

**Resolution:**
- `allow_plan_changes` — added `_validate_plan_changes_allowed()` to `PlanChangeRequestValidator`
- `max_schedule_changes_per_month` — added monthly count check to `PublicScheduleChangeRequestSerializer.validate()`
- `schedule_change_cooldown_hours` — added cooldown check to `PublicScheduleChangeRequestSerializer.validate()`

**Files Modified:**
- `backend/subscriptions/validators.py`
- `backend/attendance/serializers.py`
- No tests were broken or added.

---

### Schedule Swap Audit

**Date:** 2026-06  
**Status:** Complete (partially fixed)

**Finding:** `ScheduleSwapRequest` had zero enforcement of gym policy fields `allow_member_schedule_changes` and `schedule_change_notice_hours`. Swaps could be created even when the gym disabled schedule changes, and could be created at any time regardless of notice period. Additionally, `compute_effective_occupancy` correctly accounts for approved swaps, but capacity is only checked at check-in time, not at swap creation or approval.

**Resolution:**
- Added `allow_member_schedule_changes` check to both staff and public swap serializers.
- Added `schedule_change_notice_hours` check to both serializers.
- By design: cooldown and monthly cap are NOT enforced for swaps (swaps are one-time staff-approved exceptions).

**Files Modified:**
- `backend/attendance/serializers.py` (both `ScheduleSwapRequestSerializer` and `PublicScheduleSwapRequestSerializer`)

---

### Pagination Audit

**Date:** 2026-06  
**Status:** Complete (partially fixed)

**Finding:** Backend paginated Members, Subscriptions, Payments at 50/page (DRF global default). Frontend `api.js` unwrapped paginated responses but returned only page 1's `results` array. `totalCount` was attached to the array but never read by any consumer. All list pages silently showed only the first 50 records. Stats (`.length`) were wrong.

**Resolution:**
- Added `fetchAllPages()` helper to `api.js` that follows DRF's `next` URL until all pages are collected.
- Extracted shared `buildAuthHeaders()` and `throwIfNotOk()` helpers to avoid repetition between `apiFetch` and `fetchAllPages`.
- Updated `getMembers()`, `getSubscriptions()`, `getPayments()` to use `fetchAllPages`.

**Unresolved:**
- No frontend pagination UI. Large datasets (10k+ records) fetch all pages sequentially.
- `totalCount` still not displayed anywhere in the UI.
- Staff-facing change/swap/plan-request ViewSets have `pagination_class = None`.
- Public member-facing list endpoints (change requests, swap requests, plan change requests) return all records without pagination.

**Files Modified:**
- `frontend/src/services/api.js`
- `frontend/src/services/members.service.js`
- `frontend/src/services/subscriptions.service.js`
- `frontend/src/services/payments.service.js`

---

### Public Workout Progress View Audit

**Date:** 2026-06  
**Status:** Complete (fixed)

**Finding:** `PublicWorkoutProgressView.post()` (routines/views.py:344) was the only public write endpoint that did not call `can_member_operate()`. It used `update_or_create` directly on `WorkoutSet` with no permission, payment, or active-member check. Members with blocked subscriptions could log workout progress.

**Resolution:**
- Added `can_member_operate(member)` check to `post()` method, matching the pattern used by all other public write endpoints.

**Files Modified:**
- `backend/routines/views.py`

---

### Member.active Audit

**Date:** 2026-06  
**Status:** Complete (analysis only, no fixes implemented)

**Finding:** `Member.active` is defined with `default=True` but only enforced in one place: `PublicCheckinView.post` (which filters `active=True` in the member lookup). All 16 other public endpoints use `get_object_or_404(Member, access_token=token)` with no `active` filter. No frontend UI reads or sets `active`. No deactivation workflow exists.

**Current semantic:** `active=False` blocks only check-in. Portal access, writes, and all other operations are permitted.

**Intended semantic (business decision):** `active=False` = "account disabled — viewing allowed, modifications blocked."

**Planned implementation:** Add `not member.active` to `can_member_operate()` to block all 10 write endpoints that use it. The outlier (`PublicWorkoutProgressView.post`) was already fixed in a separate audit.

---

### Complete Audit Index

| # | Audit | Date | Scope | Status |
|---|---|---|---|---|
| 1 | Auto-Renew Propagation | 2026-06 | Backend subscriptions | Complete (fixed) |
| 2 | Gym Configuration Enforcement | 2026-06 | Backend subscriptions + attendance | Complete (partially fixed) |
| 3 | Schedule Change Policy (allow_plan_changes, max changes, cooldown) | 2026-06 | Backend subscriptions + attendance | Complete (fixed) |
| 4 | Unused Gym Config Fields (allow_schedule_changes, schedule_change_notice_days) | 2026-06 | Backend gyms | Complete (identified as deprecated) |
| 5 | Schedule Swap Business Rules | 2026-06 | Backend attendance | Complete (partially fixed) |
| 6 | Pagination Frontend + Backend | 2026-06 | Full stack | Complete (partially fixed) |
| 7 | Public Workout Progress Access Control | 2026-06 | Backend routines | Complete (fixed) |
| 8 | Member.active Semantic Analysis | 2026-06 | Full stack | Complete (analysis only) |
| 9 | Inactive Member Centralized Protection | 2026-06 | Backend all public views | Complete (analysis only) |

## Open Audits

*(None currently in progress.)*

## Rejected Ideas

| Idea | Reason for Rejection | Date |
|---|---|---|
| Add a separate `status` field to Member (active/suspended/archived) | `active` is already the correct field. Adding a second status field would create confusion and require migration of existing data. | 2026-06 |
| Middleware-based inactive member protection | URL pattern matching is fragile and couples middleware to routing. The `can_member_operate()` approach is simpler and covers 10 of 11 endpoints with one change. | 2026-06 |
| Reuse `schedule_change_cooldown_hours` and `max_schedule_changes_per_month` for swaps | Swaps are one-time staff-approved exceptions, not permanent changes. The cooldown and cap exist for permanent schedule changes where members could churn through unlimited permanent modifications. Swaps are naturally throttled by staff workload. | 2026-06 |
| Add a separate `max_swaps_per_month` field to Gym | No evidence that swap abuse is a problem. Staff approval is the natural throttle. Add if abuse is observed. | 2026-06 |
| Replace custom hooks with @tanstack/react-query | The library is installed but not used. Migration would be a large refactor with no immediate benefit. Should be evaluated when caching/refetching requirements become more complex. | 2026-06 |
