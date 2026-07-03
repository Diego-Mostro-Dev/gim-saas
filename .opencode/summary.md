# Activities Module — Complete Lifecycle

## Constraint
Never delete records; always preserve historical enrollment/attendance/Enrollment data. All list endpoints filter `active=True` by default; direct-ID access bypasses filter for reactivation PATCH.

## Active Fields
- `Activity.active` (Boolean, default=True) — deactivation cascades `active=False` to all its schedules
- `ActivitySchedule.active` (Boolean, default=True) — day/time uniqueness constraint unaffected

## Backend Changes

### Round 1 — Soft-Delete & Reactivation
- **views.py:**
  - `ActivityViewSet.destroy` → deactivation (`active=False`) of activity + cascade to schedules
  - `ActivityViewSet.get_queryset` accepts `?active=bool` query param for admin filtering
  - `ActivityScheduleViewSet.get_queryset` only filters `active=True` for `list` action; detail actions bypass filter for reactivation
  - `ActivityScheduleViewSet.destroy` → deactivation (`active=False`)
  - Overlap validation in serializer filters to `active=True` schedules
- **serializers.py:** `PublicEnrollmentSerializer` exposes `activity_active` field

### Round 2 — Orphaned Schedule Recovery
- **serializers.py:** Added `schedule_active` field to `PublicEnrollmentSerializer` — flags enrollments whose schedule was deactivated
- **public_views.py:**
  - `PublicAvailableActivitiesView` — `GET /public/{token}/available/` — returns active activities with available schedules; accepts `activity_id`, `day`, `start_time`, `end_time` query params; sorts matching time slots first
  - `PublicMemberEnrollView` — `POST /public/{token}/enroll/` — member self-enrolls in a schedule; reuses `EnrollmentService.enroll_member` for all validation (capacity, overlap, subscription, duplicates)
- **urls.py:** Registered `/public/{token}/available/` and `/public/{token}/enroll/` routes

## Frontend Changes

### Round 1 — Soft-Delete & Reactivation
- **Activities.jsx (admin):** Deactivation replaces delete; inactive collapsible section with reactivate
- **ActivitySchedules.jsx:** Smart empty state (Crea/Ver inactivos); inactive collapsible section with reactivate
- **MemberActivities.jsx:** Deactivated activity enrollments shown with disabled card and "Elegir otra actividad" button
- **ActivityDashboard.jsx:** Filter skips deactivated activities (`e.activity_active !== false`)
- **activitySchedules.service.js:** Added `getInactiveSchedules()`

### Round 2 — Orphaned Schedule Recovery
- **activitiesPublic.service.js:** Added `getAvailableActivities(token, params)`, `enrollMemberPublic(token, scheduleId)`
- **MemberActivities.jsx (rework):**
  - Three-tier categorization: active → orphaned (schedule deactivated) → deactivated (activity deactivated)
  - Orphaned card shows AlertTriangle warning + two buttons: "Elegir otro horario" / "Elegir otra actividad"
  - **Schedule picker modal**: lists active schedules for the same activity with day/time/available spots; if none, shows "{Activity} no tiene horarios disponibles" with "Elegir otra actividad" fallback
  - **Activity picker modal**: lists all available activities; **matching time slot** (= lost day/start/end) shown first under "Coinciden con tu horario", then "Otras actividades"; each activity expandable to show schedules with capacity
  - Selection flow: unenroll from old schedule → enroll in new → reload; errors trigger reload for state consistency
- **ActivityDashboard.jsx:** Filter also checks `e.schedule_active !== false` — orphaned enrollments hidden from dashboard summary

## Key Decisions
- Reactivating an Activity does NOT auto-reactivate its schedules — admin chooses explicitly per schedule
- Reactivation of inactive schedules uses direct service call (not hook); schedule appears in active list on next page load only
- UX pattern: Active items → Inactive items (collapsible) → Reactivate (identical for Activities and Schedules)
- Orphaned schedule recovery: member always decides — no automatic moves; unenroll-before-enroll order to handle same-day/time overlap
- `PublicMemberEnrollView` reuses `EnrollmentService.enroll_member` — all existing validation applies (capacity, overlap, subscription, duplicates, member status)
- `renderActivityGroup` defined after return (hoisted function declaration) — eslint-compatible pattern

## What's Still Missing Before "Complete"
- **Admin notification/audit**: When a schedule is deactivated, the admin page doesn't show which members are affected. Currently only members see the orphaned state in their portal. An admin "Schedule Enrollments" page could show a badge like "N affected enrollments — schedule inactive".
- **Bulk schedule operations**: No batch deactivate/reactivate for schedules (e.g., deactivate all Monday schedules at once). Not required by current scope.
- **Migration guard**: If old schedules were already hard-deleted (pre-soft-delete), their enrollments have `schedule_id` pointing to nonexistent records. The FK uses `PROTECT`, so this shouldn't exist, but worth confirming in production.

## Unchanged / No Changes
- `unique_together = ("service", "name")` — prevents duplicate-named activities
- No billing, subscriptions, proration, notifications, onboarding, swap logic changed
- `enroll` endpoint already blocks enrollment when `schedule.active=False` or `activity.active=False`
- `EnrollmentService.enroll_member` unchanged — all validation preserved
