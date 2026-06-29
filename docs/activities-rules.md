# Activities Module — Business Rules

> **Actualizado — 2026-06-29**
>
> Para la arquitectura de dominio completa (modelo de negocio, ciclo de facturación,
> estabilidad contractual), ver
> [`docs/architecture/multi-service-domain.md`](./architecture/multi-service-domain.md).
>
> Para la especificación funcional del producto (visión completa, onboarding,
> roadmap, casos de uso), ver
> [`docs/specs/member-services-and-onboarding.md`](./specs/member-services-and-onboarding.md).
>
> Para la arquitectura de `entry_mode`, ver
> [`docs/member-entry-mode.md`](../member-entry-mode.md).

---

## Feature Flag

- Access to the entire Activities module is gated by the `extra_activities` feature flag on the `Gym` model.
- If `gym.features["extra_activities"]` is `False`, all endpoints return `403 Forbidden`.
- The flag is checked in `initial()` of every viewset in the module.

## Model Overview

```
Activity
  ├── name (unique per gym)
  ├── description
  ├── active (boolean — can be soft-disabled)
  └── schedules → ActivitySchedule
                    ├── day (monday–saturday; same choices as attendant schedule)
                    ├── start_time / end_time
                    ├── capacity
                    └── enrollments → Enrollment
                                      ├── gym (FK → Gym)
                                      ├── member (FK → Member)
                                      ├── active (boolean — soft delete)
                                      ├── enrolled_at
                                      └── unique: (gym, member, schedule) where active=True
```

## Service Detection

See also: [Member Services & Onboarding Specification](./specs/member-services-and-onboarding.md)

The system does NOT use member types. It detects which services a member has
by inspecting their data:

### 1. Member has Gym service

- Has one or more active `AttendanceSchedule` records.
- Has a fixed weekly gym schedule (e.g., Monday 08:00, Wednesday 10:00).
- Can enroll in extra activities **only if** the activity schedule does not overlap with any of their fixed gym slots.
- A gym slot is treated as a **1-hour block** starting at `slot.hour` (there is no explicit `end_time` on `ScheduleSlot`).

**Detection:** `AttendanceSchedule.objects.filter(member=member, active=True).exists()`

### 2. Member has Activities service (only)

- Has **zero** active `AttendanceSchedule` records.
- Has no fixed gym schedule, so the gym overlap validation is **skipped**.
- Can enroll in any activity schedule (subject to other rules).

**Detection:** `Enrollment.objects.filter(member=member, active=True).exists()`

### 3. Member has both services

- Has active `AttendanceSchedule` records AND active `Enrollment` records.
- Gym overlap validation applies when enrolling in new activities.
- Portal shows combined modules.

> **Note:** Previous versions of this document described "Member Types" (GYM,
> ACTIVITY_ONLY) as the organizing concept. This was replaced by service detection
> to align with the product vision where a single `Member` can contract any
> combination of services.

## Validation Rules (in order of evaluation)

When `POST /api/activities/schedules/:id/enroll/` is called:

1. **Feature flag** — `extra_activities` must be enabled for the gym.
2. **Schedule exists** — The schedule must belong to the gym.
3. **Activity is active** — `activity.active` must be `True`.
4. **Member exists** — The member must belong to the same gym.
5. **Member can operate** — `can_member_operate()` must return `True` (not blocked or initial_pending).
6. **Capacity** — `count(active enrollments) < schedule.capacity`.
7. **Duplicate** — No active enrollment for the same (member, schedule).
8. **Gym schedule overlap** (only if member has active `AttendanceSchedule`) — No gym slot on the same day whose time range overlaps with the activity schedule. A gym slot at hour H occupies `[H, H+1h)`.
9. **Activity overlap** — No existing active enrollment in another schedule on the same day whose time range overlaps with the target schedule.
10. **Create enrollment** — `Enrollment.objects.create(active=True)`.

## Validation Implementation

All overlap validations live in `backend/activities/services.py`:

```python
validate_enrollment(member, schedule)
  ├── _check_gym_schedule_overload()   # only if AttendanceSchedule exists
  └── _check_activity_overlap()         # always
```

Both call `_times_overlap(start_a, end_a, start_b, end_b)` which returns `True` iff the two `[start, end)` intervals intersect.

> **Implementation note:** The current code detects gym service via
> `AttendanceSchedule.objects.filter(member=member, active=True).exists()`,
> NOT via `member.entry_mode`. This is correct behavior — it inspects actual
> data rather than a type indicator. Previous documentation incorrectly stated
> that `entry_mode` was used.

## Gym Schedule Overlap Detail

- Queries `AttendanceSchedule.objects.filter(member=member, active=True).select_related("slot")`.
- For each gym schedule on the same `day` as the target activity, the time range `[slot.hour, slot.hour + 1h)` is compared against `[activity.start_time, activity.end_time)`.
- The 1-hour assumption is a convention: `ScheduleSlot` has no `end_time` or `duration` field; seed data uses `time(8,0)`, `time(10,0)`, `time(18,0)`.

## Activity Overlap Detail

- Queries `Enrollment.objects.filter(member=member, active=True)` for other schedules on the same `day`.
- Directly compares `[existing.start_time, existing.end_time)` vs `[target.start_time, target.end_time)`.
- Excludes the target schedule itself (idempotent for re-enrollment after unenroll).

## `can_member_operate`

- Defined in `backend/subscriptions/services.py`.
- Returns `True` if the member has no subscriptions, or their latest subscription's payment status is not `"blocked"` or `"initial_pending"`.
- Applied early in the enrollment flow (step 5).

> **Note:** With the new vision, ALL members have a Subscription (even activity-only).
> `can_member_operate` will never encounter a member without a subscription.
> However, `plan` FK in Subscription may be `null` for activity-only members —
> verify that `get_subscription_payment_status` handles null plan gracefully.

### Relationship to billing cycle

- **During the grace period** (after closing day, before block day): payment may be `pending`, but `can_member_operate` returns `True`. The member is fully active.
- **After the grace period expires**: payment status becomes `blocked` (overdue). `can_member_operate` returns `False`. The member cannot enroll in activities, mark attendance, access routines, or request changes.
- **Portal access is always preserved** regardless of `can_member_operate`. The member can log in, view their data, and pay.

See [Billing Cycle](../architecture/multi-service-domain.md#billing-cycle) and [Overdue state](../architecture/multi-service-domain.md#overdue-state) in the architecture document.

## Clave Única y Soft-Delete

- `unique_active_enrollment` constraint: only one active enrollment per `(gym, member, schedule)`.
- Unenrolling sets `active=False` (soft-delete). The same member can re-enroll later (creates a new active record).
- `on_delete=PROTECT` on `schedule` FK prevents deleting schedules with active enrollments.

## Frontend — Admin

### Activities List

- `pages/Activities.jsx` — CRUD list of activities.
- `components/activities/ActivityCard.jsx` — card with name, status, edit/delete buttons.
- `components/activities/ActivityForm.jsx` — create/edit form.

### Schedules per Activity

- `pages/ActivitySchedules.jsx` — lists schedules for an activity.
- `components/activities/ScheduleCard.jsx` — card with:

  | Element | Detail |
  |---------|--------|
  | Day + time | e.g. "Lunes · 10:00 - 11:00" |
  | Badges | "Completo" (100%) or "Últimos lugares" (< 20% available) |
  | Enrolled / Capacity | e.g. "12 / 15" |
  | Occupancy % | e.g. "80%" |
  | Progress bar | Color-coded: green (0-60%), warning (60-90%), danger (90-100%) |
  | "Inscriptos (N)" button | Navigates to enrollment detail |
  | Edit / Delete | Icon buttons |

- `components/activities/ScheduleForm.jsx` — create/edit form.

**Enrollment count loading:**
- `useActivitySchedules` hook fetches schedules via `GET /api/activities/:activityId/schedules/`, then enriches each schedule with `enrolled_count` by calling `getScheduleEnrollmentCount(s.id)` (which hits `GET /api/activities/schedules/:id/enrollments/?page=1&page_size=1` and extracts `count`).
- All schedule mutations (create/update/delete) also re-fetch the count for the affected schedule.

### Enrollment Detail per Schedule

- `pages/ScheduleEnrollments.jsx` — lists enrolled members for a schedule.
- `components/activities/EnrollMemberModal.jsx` — modal to enroll a member, filtered by `subscription_active`.
- `components/ui/ConfirmModal.jsx` — confirm before unenrolling a member.

**Info header** (top of the page):
| Field | Value |
|-------|-------|
| Actividad | Activity name |
| Horario | Day · time range |
| Capacidad | `enrolled / capacity` |
| Disponibles | Available spots (color-coded: red if 0, warning if < 20%) |

### Shared patterns

- All admin pages use `bg-surface` background, `bg-surface-elevated` cards, `border-border` borders.
- All buttons use semantic tokens: `bg-info-bg` / `text-info-text` for info actions, `bg-danger-bg` / `text-danger-text` for destructive actions, `bg-success-bg` / `text-success-text` for success indicators, `bg-warning-bg` / `text-warning-text` for warnings.
- Progress bar uses `bg-surface-input` for the track and `bg-success` / `bg-warning` / `bg-danger` for the fill based on occupancy percentage.
- Overlap errors from the backend are shown via `toast.error()`.

## Frontend — Portal del Socio

### Arquitectura del Portal

Portal unificado que muestra módulos según los servicios contratados por el miembro:

```
MemberPortalLayout (layout + tabs)
  │
  ├── ¿Tiene AttendanceSchedule activos? → Módulo Inicio (dashboard GYM)
  │                                           Módulo Rutina
  │                                           Módulo Horarios
  │
  ├── ¿Tiene Enrollment activos? → Módulo Inicio (dashboard actividades)
  │                                    Módulo Actividades
  │
  └── Siempre: Módulo Pagos
```

> **Transición desde entry_mode:** Actualmente el portal usa `routine.member.entry_mode`
> para decidir qué mostrar (DashboardSelector, tabs). En Sprint 3 esto se reemplazará
> por inspección directa de servicios. Por ahora, `entry_mode` funciona como proxy
> porque la correlación es 1:1 en el estado actual.

### DashboardSelector (`frontend/src/pages/member/DashboardSelector.jsx`)
- Lee datos del contexto (`routine`) para decidir qué dashboard renderizar
- Actualmente usa `entry_mode`; a futuro usará datos reales

### ActivityDashboard (`frontend/src/pages/member/ActivityDashboard.jsx`)
- Dashboard específico para miembros con solo actividades
- Muestra: saludo, gimnasio, actividades activas, próximas actividades, último pago, contacto

### "Mis Actividades" page

- Route: `/routine/:token/activities`
- Component: `frontend/src/pages/MemberActivities.jsx`
- Hook: `frontend/src/hooks/useMemberActivities.js`
- Service: `frontend/src/services/activitiesPublic.service.js`

**States handled:**
- **Loading** — centered "Cargando actividades..." text
- **Error** — red error card with message from backend
- **Empty** — icon + "No estás inscripto en ninguna actividad" + explanatory subtitle
- **List** — card per enrollment with: avatar initial, activity name, day · time range, "Cancelar" button
- **Unenrolling** — button shows "Cancelando..." and is disabled
- **Confirm cancel** — `ConfirmModal` before unenrolling

**Backend endpoints consumed:**
| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `/api/activities/public/{token}/` | List member's active enrollments |
| `POST` | `/api/activities/public/{token}/` | Unenroll from a schedule |

**Public Enrollment Serializer response fields:**
```
id, activity_name, activity_id, schedule, day, start_time, end_time, active, enrolled_at
```

### Authentication

- Uses the member's `access_token` from the URL (same as all portal pages).
- All API calls use `{ skipAuth: true }` (no admin auth header).
- Token is stored in `localStorage` by `MemberPortalLayout` on load.

---

## [HISTÓRICO] Secciones reemplazadas

### Reemplazado: "Member Types" (versión anterior)

La sección anterior definía Gym Member y Activity-Only Member como tipos
separados basados en `entry_mode`. Fue reemplazada por "Service Detection"
que inspecciona datos reales (AttendanceSchedule, Enrollment).

### Reemplazado: Detección por entry_mode

La documentación anterior afirmaba que el backend detectaba el tipo vía
`member.entry_mode` con fallback a `AttendanceSchedule`. Esto era incorrecto:
el código siempre usó `AttendanceSchedule.exists()`. La documentación fue
corregida para reflejar la implementación real.
