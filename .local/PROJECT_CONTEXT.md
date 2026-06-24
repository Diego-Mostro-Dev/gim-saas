# Project Context

> Update this document whenever architecture, business rules, audits or major features change.

## Project Overview

Gym SaaS is a multi-tenant gym management platform. Each gym (tenant) manages members, subscriptions, payments, attendance, schedules, routines, and plan changes through a staff web interface. Members access a public portal via a unique access token to view their routine, attendance history, payments, and submit schedule/plan change requests.

**Current scope:**
- Staff dashboard, member CRUD, subscription CRUD, payment tracking
- Member portal (token-based) for self-service operations
- Schedule management (weekly recurring slots, changes, swaps)
- Routine assignment and workout tracking
- Plan change requests with approval workflow
- Auto-renewal subscription engine
- Attendance check-in and analytics
- Multi-gym isolation (staff and data scoped to one gym)
- Demo data seeder for development/testing

## Technology Stack

### Frontend

| Concern | Choice |
|---|---|
| Framework | React 19 with Vite 8 |
| Routing | react-router-dom v7 |
| State management | Zustand 5 + React hooks |
| HTTP client | Native `fetch()` wrapper (`api.js`) |
| UI | Tailwind CSS v4 + lucide-react icons |
| Toasts | react-hot-toast |
| QR codes | react-qr-code |
| Server state | @tanstack/react-query (installed, not yet used; fetches use custom hooks) |
| Linting | ESLint 10 |

### Backend

| Concern | Choice |
|---|---|
| Framework | Django 6.0 + DRF 3.17 |
| Database | PostgreSQL (Neon with PgBouncer) |
| Auth | DRF TokenAuthentication |
| File storage | Cloudinary (via django-cloudinary-storage) |
| CORS | django-cors-headers |
| Filtering | django-filter |
| Throttling | DRF built-in + custom AnonRateThrottle subclasses |
| Server | Gunicorn |
| Static files | Whitenoise |

### Deployment

- Backend: Render (gunicorn, `Procfile` in `backend/`)
- Frontend: Render (Vite build, static hosting)
- Database: Neon PostgreSQL
- No Docker. Native deployment via Procfile.

## Module Map

| Domain | Frontend | Backend App | Models | Staff Endpoints | Public Endpoints |
|---|---|---|---|---|---|
| Members | `pages/Members.jsx`, `hooks/useMembers.js` | `members` | `Member` | `MemberViewSet` | `PublicRegisterView`, `PublicMemberPhotoView` |
| Subscriptions | `pages/Subscriptions.jsx`, `hooks/useSubscriptions.js` | `subscriptions` | `Subscription`, `PlanChangeRequest`, `PlannedSchedule` | `SubscriptionViewSet`, `PlanChangeRequestViewSet` | `PublicPlanChangeRequestView`, `PublicCancelRenewalView`, `PublicEnableRenewalView` |
| Payments | `pages/Payments.jsx`, `hooks/usePayments.js` | `payments` | `Payment` | `PaymentViewSet` | None |
| Attendance | `pages/AttendanceAnalytics.jsx`, `hooks/useWeeklyAttendance.js` | `attendance` | `Attendance`, `AttendanceSchedule`, `ScheduleSlot`, `ScheduleChangeRequest`, `ScheduleSwapRequest` | `ScheduleSlotListCreateView`, `ScheduleChangeRequestViewSet`, `ScheduleSwapRequestViewSet`, `WeeklyScheduleView`, `members_by_schedule`, `attendance_status`, `attendance_analytics` | `PublicCheckinView`, `PublicMemberSlotsView`, `PublicScheduleChangeRequestView`, `PublicScheduleSwapRequestView` |
| Routines | `pages/PublicRoutine.jsx`, `hooks/useActiveRoutines.js` | `routines` | `Exercise`, `RoutineTemplate`, `RoutineExercise`, `RoutineAssignment`, `WorkoutSet` | `ExerciseViewSet`, `RoutineTemplateViewSet`, `RoutineAssignmentViewSet`, `RoutineExerciseViewSet`, `ActiveRoutinesView`, `BulkAssignRoutineView` | `PublicWorkoutProgressView`, `PublicRoutineView` |
| Plans | `pages/Plans.jsx`, `hooks/usePlans.js` | `plans` | `MembershipPlan` | `MembershipPlanViewSet` | None |
| Gyms | `pages/Dashboard.jsx`, `hooks/useGym.js` | `gyms` | `Gym` | `GymMeView` | `GymOnboardingView`, `CreateGymOwnerView` |
| Auth | `store/auth.store.js` | `accounts` | `UserProfile` | `LoginView`, `LogoutView`, `MeView`, `ChangePasswordView` | None |
| Dashboard | `pages/Dashboard.jsx`, `hooks/useDashboard.js` | `config/api/dashboard.py` | (aggregates across models) | `DashboardSummaryView` | None |

## Frontend ↔ Backend Mapping

### Members

| Layer | File(s) |
|---|---|
| Page | `pages/Members.jsx` |
| Hooks | `hooks/useMembers.js`, `hooks/useMemberForm.js`, `hooks/useFilteredMembers.js` |
| Service | `services/members.service.js` |
| Components | `components/members/MemberForm.jsx`, `components/members/MemberCard.jsx` |
| ViewSet | `members/views.py:MemberViewSet` |
| Serializer | `members/serializers.py:MemberSerializer`, `members/serializers.py:PublicRegisterSerializer` |
| Model | `members/models.py:Member` |

### Subscriptions

| Layer | File(s) |
|---|---|
| Page | `pages/Subscriptions.jsx` |
| Hooks | `hooks/useSubscriptions.js`, `hooks/useSubscriptionForm.js`, `hooks/useFilteredSubscriptions.js`, `hooks/useSubscriptionStats.js` |
| Service | `services/subscriptions.service.js` |
| ViewSet | `subscriptions/views.py:SubscriptionViewSet`, `subscriptions/views.py:PlanChangeRequestViewSet` |
| Serializer | `subscriptions/serializers.py:SubscriptionSerializer`, `subscriptions/serializers.py:PlanChangeRequestSerializer`, `subscriptions/serializers.py:PublicPlanChangeRequestSerializer` |
| Model | `subscriptions/models.py:Subscription`, `subscriptions/models.py:PlanChangeRequest` |
| Validator | `subscriptions/validators.py:PlanChangeRequestValidator` |
| Services | `subscriptions/services.py` (can_member_operate, payment status, date utilities) |
| Management | `subscriptions/management/commands/auto_renew_subscriptions.py`, `subscriptions/management/commands/apply_plan_changes.py` |

### Payments

| Layer | File(s) |
|---|---|
| Page | `pages/Payments.jsx` |
| Hooks | `hooks/usePayments.js`, `hooks/usePaymentStats.js`, `hooks/usePaymentForm.js` |
| Service | `services/payments.service.js` |
| ViewSet | `payments/views.py:PaymentViewSet` |
| Serializer | `payments/serializers.py:PaymentSerializer` |
| Model | `payments/models.py:Payment` |

### Attendance

| Layer | File(s) |
|---|---|
| Page | `pages/ScheduleChangeRequests.jsx`, `pages/ScheduleSwapRequests.jsx`, `pages/AttendanceAnalytics.jsx` |
| Hooks | `hooks/useWeeklyAttendance.js`, `hooks/useAttendanceStatus.js`, `hooks/useScheduleChangeWatcher.js`, `hooks/useScheduleSwapWatcher.js`, `hooks/useScheduleChangeData.js`, `hooks/useScheduleSwapData.js` |
| Service | `services/attendance.service.js` |
| Views (staff) | `attendance/views.py:ScheduleSlotListCreateView`, `ScheduleChangeRequestViewSet`, `ScheduleSwapRequestViewSet`, `WeeklyScheduleView`, `members_by_schedule`, `attendance_status`, `attendance_analytics` |
| Views (public) | `attendance/public_views.py:PublicCheckinView`, `PublicMemberSlotsView`, `PublicScheduleChangeRequestView`, `PublicCancelScheduleChangeRequestView`, `PublicScheduleSwapRequestView`, `PublicCancelScheduleSwapRequestView` |
| Serializers | `attendance/serializers.py` (multiple serializers for each model) |
| Models | `attendance/models.py:Attendance`, `AttendanceSchedule`, `ScheduleSlot`, `ScheduleChangeRequest`, `ScheduleSwapRequest` |
| Utils | `attendance/utils.py` (`compute_effective_occupancy`, schedule slot ordering, attendance counting) |

### Routines

| Layer | File(s) |
|---|---|
| Page | `pages/RoutineExercises.jsx`, `pages/member/MemberWorkout.jsx`, `pages/PublicRoutine.jsx` |
| Hooks | `hooks/useExercises.js`, `hooks/useRoutineTemplates.js`, `hooks/useRoutineExercises.js`, `hooks/useActiveRoutines.js`, `hooks/useMemberRoutine.js` |
| Service | `services/routines.service.js` |
| Views | `routines/views.py` (ViewSets for Exercise, RoutineTemplate, RoutineAssignment, RoutineExercise; APIViews for ActiveRoutinesView, PublicWorkoutProgressView, PublicRoutineView, MemberRoutineView) |
| Serializers | `routines/serializers.py` |
| Models | `routines/models.py:Exercise`, `RoutineTemplate`, `RoutineExercise`, `RoutineAssignment`, `WorkoutSet` |

## Architecture Decisions

### Token-based Member Portal
Members authenticate via a UUID `access_token` embedded in their portal URL. No password, no session. The token is auto-generated on member creation. This is a deliberate design choice for simplicity — gym members are not expected to manage passwords.

### Gym Isolation Strategy
- Staff users have a `UserProfile` linked to one `Gym`.
- `GymQuerysetMixin` auto-filters all staff ViewSets to `gym=request.user.profile.gym`.
- Public endpoints derive the gym from the member's `access_token` → `member.gym`.
- The `Member` model has a `gym` FK — all data chains through `member.gym`.
- No cross-gym data leakage is possible through normal API paths.

### Approval Workflows
- Schedule changes: member creates → staff approves/rejects → system executes (deactivates old schedule, activates new slot or creates new AttendanceSchedule).
- Schedule swaps: member creates → staff approves → member checks in using swap (one-time override).
- Plan changes: member creates → staff approves → cron job executes at effective_date.

### Caching Approach
Frontend implements a simple TTL-based cache (`utils/cache.js`):
- Cache keys: `members`, `subscriptions`, `plans`, `dashboard`
- TTLs: members 5min, subscriptions 2min, plans 30min, dashboard 1min
- Hooks check cache freshness before fetching; stale or absent data triggers a fetch.
- The cache stores full datasets (all pages after the pagination fix).

### Pagination Strategy
- DRF global default: `PageNumberPagination`, 50 items/page.
- Members, Subscriptions, Payments endpoints are paginated.
- Plans, Exercises, Templates, Change/Swap request ViewSets have `pagination_class = None`.
- Frontend `api.js` helper `fetchAllPages()` fetches all pages sequentially for list endpoints.
- Previously, the frontend only fetched page 1 (silent truncation). Fixed by adding `fetchAllPages`.

### Auto-renewal Architecture
- `Subscription.auto_renew` (Boolean, default `True`) controls whether the cron renews.
- Cron command `auto_renew_subscriptions` runs monthly, finds subscriptions ending this month with `auto_renew=True`, creates next-month subscriptions.
- `auto_renew` propagates from registration → cron → manual renew → plan change.
- Members can toggle `auto_renew` via public portal endpoints.

### Throttling
- Public endpoints use custom `AnonRateThrottle` subclasses: 30/hr (attendance operations) and 60/hr (general portal access).
- Login: 10/hr. Onboarding: 5/hr create, 30/hr validate.
- Staff endpoints use global UserRateThrottle (1000/hr).

## Known Technical Debt

1. **No frontend pagination UI.** `fetchAllPages` works for initial loads but doesn't support server-side pagination. A gym with 10,000 members would fetch 200 pages sequentially.
2. **`totalCount` attached to arrays but never displayed.** The frontend never shows "X of Y records" anywhere.
3. **`PublicWorkoutProgressView.post` had no access control.** Fixed (commit 3f250fb) but no tests exist for this view.
4. **No deactivation UI.** `Member.active` is only respected by check-in. No frontend toggles it, no workflow exists.
5. **`ScheduleChangeRequestSerializer` (staff) lacks cooldown/monthly limit checks.** Staff can bypass gym policies. May be intentional.
6. **Schedule swaps bypass all schedule-change gym policies** (`allow_member_schedule_changes`, `schedule_change_notice_hours`, cooldown, monthly cap). Two fields (`allow_member_schedule_changes` and `schedule_change_notice_hours`) were recently enforced; cooldown and monthly cap remain unenforced by design decision.
7. **`PublicWorkoutProgressView.get` returns data without any access gate** (no `can_member_operate`, no `active` check). By design for read access.
8. **`MAX_PAGE_SIZE` not configured.** DRF setting has no upper bound on page size.
9. **`useQuery` (`@tanstack/react-query`) installed but unused.** All data fetching uses custom hooks with manual caching.
10. **No tests for attendance, routines, payments, or public endpoints.** Only subscription tests exist.
11. **`compute_next_occurrence` in `attendance/serializers.py` returns a naive datetime** while `timezone.now()` returns aware. The comparison at line 543 may fail depending on `USE_TZ` or may silently coerce. This code runs in production without reported errors, suggesting either `USE_TZ=False` or Django handles the comparison.
