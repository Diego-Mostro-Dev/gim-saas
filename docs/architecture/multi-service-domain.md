# Multi-Service Domain — Business Architecture

> **Version:** 1.0
> **Date:** 2026-06-29
> **Status:** Approved — Single source of truth for Sprint 2+ business domain

---

## Philosophy

### One gym, many services

GymDev started as a traditional gym management system. A member joined, picked a plan, came to train. That model is mature and works well.

The market reality is different. Modern fitness centers sell multiple distinct services under one roof:

- Gym access
- Yoga classes
- Pilates sessions
- Crossfit boxes
- Rehabilitation programs
- Nutrition counseling
- Personal training

These are not variations of the same product. They are separate products sold by the same gym. A member may buy one, two, or five of them.

The system must model this without forcing artificial categories onto members or duplicating infrastructure.

### Contracted services, not member types

The system does not classify members into types. There is no "gym member" versus "activities member". There is a single `Member` entity that examines its own data to determine what it has contracted.

This avoids the combinatorial explosion of member types as new services appear. It keeps the member model stable. Business logic inspects real data (subscription items, enrollments, schedules) rather than a single type field.

### Activities are execution, not products

A common mistake is to treat activities as products. Activities are operational sessions — Tuesday yoga at 10:00 with Maria. They have capacity, a teacher, a room. They execute a service (Yoga) but are not themselves the product.

The product is the Yoga service. The activity is when and where it happens.

### Modular by nature

Every service is a vertical slice. It may have its own plans, schedules, enrollments, and portal modules. Services share the member identity but keep their own logic. Adding a new service means adding a new vertical, not modifying existing ones.

---

## Business Concepts

### Service

A **Service** is what the gym sells.

Examples:

| Service | Description |
|---------|-------------|
| Gym | Traditional gym access with equipment, fixed schedules, routines |
| Yoga | Group yoga sessions with teachers and capacity limits |
| Pilates | Group pilates sessions |
| Crossfit | High-intensity functional training sessions |
| Rehabilitation | One-on-one or small-group recovery sessions |
| Nutrition | Dietary planning and professional consultation |

Services are NOT the same as features (see Features vs. Services below).

### Membership Plan

Each **Service** owns one or more **Membership Plans**. A plan defines:

- Price
- Duration
- Service-specific limits (e.g., weekly visits for Gym, session count for Rehab)

A plan belongs to exactly one service.

Example — Yoga service plans:

| Plan | Price | Duration | Limits |
|------|-------|----------|--------|
| Monthly | $40 | 30 days | Unlimited classes |
| 8 Classes | $35 | 60 days | 8 sessions |

Example — Gym service plans:

| Plan | Price | Duration | Limits |
|------|-------|----------|--------|
| Basic | $30 | 30 days | 3x/week |
| Premium | $50 | 30 days | 6x/week |
| Unlimited | $70 | 30 days | Unlimited |

### Subscription

A **Subscription** represents the complete commercial agreement between the member and the gym. It is the billing and contracting container.

There is exactly **one** Subscription per member at any given time.

The Subscription contains **Subscription Items**, each referencing one Membership Plan. This means a single Subscription can bundle multiple services.

Example:

> **Member: Ana**
>
> Subscription #142
> - Gym Premium ($50)
> - Yoga Monthly ($40)
>
> Total: $90/month

Another member:

> **Member: Carlos**
>
> Subscription #189
> - Rehabilitation 8 Sessions ($60)
>
> Total: $60

### Subscription Item

A **SubscriptionItem** is one contracted plan within the subscription. It references:

- The `MembershipPlan` (which implicitly identifies the `Service`)
- The `Subscription` it belongs to
- Status (active, cancelled, expired)

This is the key innovation: SubscriptionItems enable bundling without denormalizing the subscription model.

### Activity

An **Activity** is an operational session. It belongs to a `Service` (not directly to the gym). It has a day, time, teacher, room, and capacity.

Activities are NOT products. They do not have prices. They execute a service.

Example — Yoga service activities:

| Day | Time | Teacher | Capacity |
|-----|------|---------|----------|
| Tuesday | 10:00–11:00 | Maria | 20 |
| Thursday | 18:00–19:00 | Maria | 20 |

### Enrollment

An **Enrollment** links a member with a specific activity schedule. It represents the member's registration for that operational session.

Enrollments validate capacity, overlap, and service eligibility. A member cannot enroll in a Yoga activity without having a Yoga SubscriptionItem (or a plan that includes Yoga).

### Attendance Schedule

The **AttendanceSchedule** model continues to represent the member's fixed gym schedule. It is specific to the Gym service. It records which days and hours the member attends the gym.

Other services (Yoga, Pilates, etc.) do NOT use AttendanceSchedule. They use Enrollments.

### Member

The **Member** is the universal customer. There is one model, one table. Every service contracts the same entity. The member's data (subscription items, enrollments, schedules) determines what they have access to.

`entry_mode` is a technical field kept for backward compatibility during migration (see Migration Strategy).

---

## Domain Model

```
Gym
│
├── Service (e.g., Gym, Yoga, Pilates, Rehab)
│   ├── name, description, active
│   └── MembershipPlan
│       ├── name, price, duration
│       └── service-specific limits (e.g., weekly_visits, session_count)
│
├── Member
│   ├── personal data (name, phone, email, photo)
│   ├── access_token (portal authentication)
│   ├── entry_mode (technical, transitional)
│   │
│   └── Subscription (one per member)
│       └── SubscriptionItem
│           ├── membership_plan → Service implicitly
│           ├── status (active, cancelled, expired)
│           ├── start_date, end_date
│           └── price_snapshot
│
├── For Gym service only:
│   ├── AttendanceSchedule (fixed gym schedule)
│   │   └── day, hour
│   ├── Attendance (QR check-in)
│   └── RoutineAssignment (workout plan)
│
├── For Activity-based services (Yoga, Pilates, etc.):
│   ├── Activity (catalog item)
│   │   └── service → which Service this activity executes
│   └── ActivitySchedule (operational session)
│       └── Enrollment (member ↔ schedule)
│
└── Future:
    └── ContractedService (see Roadmap)
```

---

## Entity Responsibilities

### Gym
- Owns everything
- Has features (capabilities) and services (products)
- Configures business rules (payment terms, schedule policies)

### Service
- Defines what the gym sells
- Owns membership plans
- Is referenced by activities that execute it
- Has no database model yet (Sprint 4) — currently identified by plan grouping or convention

### MembershipPlan
- Represents a price point and duration for a service
- Has service-specific limits (e.g., weekly visits for Gym, session count for Rehab)
- Belongs to a Service (currently implicit via naming/convention; future FK)

### Member
- Universal customer identity
- Owns personal data and access token
- Has one active subscription

### Subscription
- Commercial container: one per member
- Contains one or more SubscriptionItems
- Tracks payment state (paid, pending, blocked, etc.)
- Subject to renewal, plan changes, and cancellation

### SubscriptionItem
- One contracted plan
- References MembershipPlan (→ Service)
- Has status lifecycle: active → cancelled / expired
- Stores price snapshot for billing history

### Activity
- Operational catalog item (e.g., "Yoga Level 1", "Pilates Mat")
- Belongs to a Service
- Has schedules with capacity

### ActivitySchedule
- Concrete session (Tuesday 10:00, Teacher Maria)
- Belongs to one Activity
- Has capacity and enrolled count

### Enrollment
- Links a member to an ActivitySchedule
- Validates: capacity, overlap, service eligibility
- Soft-deletable (active flag)

### AttendanceSchedule
- Gym-specific: member's fixed weekly schedule
- Only applies when the member has contracted Gym service
- Used for QR check-in and overlap validation with activities

---

## Relationships

```
Gym (1) ──── (N) Service
Service (1) ──── (N) MembershipPlan
Service (1) ──── (N) Activity
Activity (1) ──── (N) ActivitySchedule
ActivitySchedule (1) ──── (N) Enrollment
Enrollment (N) ──── (1) Member

Gym (1) ──── (N) Member
Member (1) ──── (1) Subscription
Subscription (1) ──── (N) SubscriptionItem
SubscriptionItem (N) ──── (1) MembershipPlan

Member (1) ──── (N) AttendanceSchedule  [Gym service only]
Member (1) ──── (N) Enrollment           [Activity services]
```

Key constraints:

- A Subscription belongs to exactly one member and one gym
- A SubscriptionItem belongs to exactly one Subscription
- An Enrollment belongs to exactly one Member and one ActivitySchedule
- AttendanceSchedule exists only for the Gym service
- A member can have AttendanceSchedule, Enrollment, or both

---

## Commercial Flow

### Registration (New Member)

1. Member scans QR code or opens registration link
2. Selects one or more services (checkboxes: Gym, Yoga, Pilates, etc.)
3. For each selected service, completes the corresponding wizard step:
   - **Gym:** picks plan → picks weekly schedule slots
   - **Yoga:** picks plan → picks activity schedules
   - **Pilates:** picks plan → picks activity schedules
4. Confirms and submits
5. System creates:
   - `Member` record
   - `Subscription` with `paid=false`
   - `SubscriptionItem` for each selected plan
   - `AttendanceSchedule` records (if Gym selected)
   - `Enrollment` records (if activity-based services selected)
6. Member receives `access_token`

### Payment

- One subscription per member
- Payment is applied to the subscription as a whole (not per item)
- The gym's payment terms, due days, and blocking rules operate on the subscription level
- `SubscriptionItem.price_snapshot` enables per-item billing history

### Plan Changes

- A plan change targets a specific SubscriptionItem
- The system creates a PlanChangeRequest for that item
- Other items in the subscription are unaffected
- Approval/execution follows existing workflow

### Renewal

- Subscription auto-renewal renews all active SubscriptionItems
- Cancelled or expired items are not renewed
- Price snapshots capture the plan price at time of renewal

---

## Onboarding Flow

### Frontend Wizard

```
Registration Link
    │
    ▼
┌──────────────────────┐
│ Service Selection    │  ← Checkboxes (Gym, Yoga, Pilates...)
│ ☐ Gym               │     At least one required
│ ☐ Yoga              │
│ ☐ Pilates           │
│ [Continue]           │
└──────────────────────┘
    │
    ▼
┌──────────────────────┐
│ Personal Data        │  ← Always shown
│ Name, Phone, Email   │
│ Photo (optional)     │
│ [Continue]           │
└──────────────────────┘
    │
    ├── (if Gym selected) ──→ ┌──────────────────────┐
    │                          │ Gym — Plan Selection  │
    │                          │ • List of Gym plans   │
    │                          │ [Continue]            │
    │                          └──────────────────────┘
    │                                   │
    │                                   ▼
    │                          ┌──────────────────────┐
    │                          │ Gym — Schedule        │
    │                          │ • Day/hour selection  │
    │                          │ [Continue]            │
    │                          └──────────────────────┘
    │
    ├── (if Yoga selected) ──→ ┌──────────────────────┐
    │                          │ Yoga — Plan Selection │
    │                          │ [Continue]            │
    │                          └──────────────────────┘
    │                                   │
    │                                   ▼
    │                          ┌──────────────────────┐
    │                          │ Yoga — Schedules      │
    │                          │ • Activity selection  │
    │                          │ [Continue]            │
    │                          └──────────────────────┘
    │
    ├── (if Pilates selected) → (similar wizard)
    │
    ▼
┌──────────────────────┐
│ Confirmation         │
│ • All selections     │
│ [Confirm Register]   │
└──────────────────────┘
```

### Backend Behavior

The backend receives the complete payload and creates records atomically:

```
POST /api/public/register/<gym_code>/
{
    "first_name": "...",
    "last_name": "...",
    "phone": "...",
    "services": {
        "gym": {
            "plan_id": 1,
            "schedules": [{"day": "monday", "hour": "08:00"}, ...]
        },
        "yoga": {
            "plan_id": 5,
            "activity_schedules": [14, 15, ...]
        }
    }
}
```

The backend:

1. Creates `Member` with `entry_mode` set based on service selection
2. Creates `Subscription` (paid=false)
3. Creates `SubscriptionItem` for each service's plan
4. Creates `AttendanceSchedule` for Gym schedules
5. Creates `Enrollment` for each activity schedule

---

## Portal Philosophy

### The portal always loads

Every member with an `access_token` can access the portal. There is no minimum service requirement. The portal loads the member's data and renders what it finds.

### Render by data, not by type

The portal does not check `entry_mode`. It inspects the member's actual data:

- Has `AttendanceSchedule`? → Show Gym dashboard, schedules tab, routine tab
- Has `Enrollment`? → Show Activities tab, activity dashboard
- Has `SubscriptionItem` for Nutrition? → Show Nutrition tab

This is the modular approach. Adding a new service means a new tab appears for members who have it. No portal-wide conditionals.

### Service-conditional tabs

Each service can expose portal tabs:

| Service | Tab | Content |
|---------|-----|---------|
| Gym | Inicio | Dashboard (subscription, plan, next workout, recent attendance, last payment) |
| Gym | Rutina | Workout tracking |
| Gym | Horarios | Schedule management |
| Any | Pagos | Payment history (always shown) |
| Yoga | Actividades | Activity enrollments |
| Pilates | Actividades | Activity enrollments |

If a member has Gym + Yoga, they see: Inicio, Rutina, Horarios, Pagos, Actividades.
If only Yoga: Inicio (yoga dashboard), Pagos, Actividades.

### Empty states

When a service is contracted but has no data yet (e.g., Gym without routine assignment), the tab still appears but shows an empty state. The portal does not hide tabs based on data emptiness — only based on absence of the service.

---

## Features vs. Services

This distinction is critical.

### Features

**Features** are platform capabilities enabled for a Gym. They are technical toggles that control whether a module is available at all.

Examples:

| Feature | Effect |
|---------|--------|
| `extra_activities` | Enables the Activities CRUD module in admin |
| `payments` | Enables payment processing |
| `store` | Enables the online store |
| `nutrition` | Enables the nutrition module |
| `booking` | Enables class booking |
| `reports` | Enables analytics |

Features are stored in `Gym.features` (JSONField) and validated against a registry. If the Activities feature is disabled, activities should not appear anywhere — not in registration, not in portal, not in admin.

### Services

**Services** are what the Gym sells. They are the products. A Gym can sell Gym access, Yoga, Pilates, Rehab, etc.

Services are independent of features, but features may be prerequisites:

- To sell Yoga as a service, the `extra_activities` feature must be enabled
- To sell Nutrition as a service, the `nutrition` feature must be enabled

A feature can exist without the corresponding service being sold (a gym may have the activities feature but choose not to sell Yoga/Pilates separately).

### Comparison

| Aspect | Feature | Service |
|--------|---------|---------|
| What it controls | Platform capability | Product for sale |
| Scope | All gyms or per-gym toggle | Per-gym catalog |
| Implementation | Feature flag (JSONField) | Service model (future) |
| Example | `extra_activities: true` | "Yoga" with plans |
| Visibility | Admin, backend gating | Registration, portal, billing |

---

## Future Roadmap

### Sprint 2 — SubscriptionItem and onboarding

- [ ] Create `SubscriptionItem` model
- [ ] Migrate existing subscriptions: move plan FK from Subscription to SubscriptionItem
- [ ] Update registration endpoint to create SubscriptionItems per service
- [ ] Frontend onboarding wizard with multi-service selection
- [ ] `Subscription.plan` becomes nullable or is removed
- [ ] Update `can_member_operate()` to check SubscriptionItem existence

### Sprint 3 — Service detection and portal modularity

- [ ] Remove `entry_mode` dependency from portal
- [ ] Portal renders tabs based on SubscriptionItem data
- [ ] Each service registers its own portal modules
- [ ] DashboardSelector reads SubscriptionItems instead of `entry_mode`

### Sprint 4 — Service model

- [ ] Create `Service` model with FK to Gym
- [ ] Create `ContractedService` model
- [ ] Migrate `MembershipPlan` to reference `Service`
- [ ] Move activity-service association from convention to FK
- [ ] Deprecate `entry_mode` (keep as read-only historical field)
- [ ] Admin UI for managing services per gym

### Sprint 5+ — New services

- [ ] Nutrition module
- [ ] Personal Training module
- [ ] Rehabilitation module
- [ ] CrossFit module
- [ ] Each as a vertical slice with its own plans, schedules (if applicable), enrollments, and portal tabs

### Far future — ContractedService consolidation

- [ ] `ContractedService` as explicit join between Member and Service
- [ ] Enrollments, AttendanceSchedule, etc. derive eligibility from ContractedService
- [ ] SubscriptionItem becomes billing-only; ContractedService owns access
- [ ] Full audit trail of service subscriptions

---

## Migration Strategy

### Phase A (current state)

- `entry_mode` exists on `Member` with default `GYM`
- `Subscription.plan` is a non-nullable FK to `MembershipPlan`
- Activities are feature-flagged via `Gym.features["extra_activities"]`
- Activity-service association is implicit (Activity belongs to Gym, not to Service)
- Portal uses `entry_mode` as proxy for service detection

### Phase B (Sprint 2)

- `SubscriptionItem` is created as the new core model
- Existing `Subscription.plan` data is migrated to a `SubscriptionItem`
- Registration endpoint creates SubscriptionItems
- `Subscription.plan` becomes nullable (or removed)
- `entry_mode` continues to be set but not used for business logic on new members

### Phase C (Sprint 3)

- Portal detection switches from `entry_mode` to subscription data
- No new members depend on `entry_mode`
- Existing members still have `entry_mode` for read-only compatibility

### Phase D (Sprint 4)

- `Service` model is created and populated for each gym
- `MembershipPlan.service` FK is added
- Activities get a `service` FK
- `ContractedService` is designed but may not replace SubscriptionItem yet
- `entry_mode` is fully deprecated as a business field (kept for data history)

### Backward compatibility invariants

1. All existing API responses must continue to include `entry_mode` if they did before
2. All existing members retain their `entry_mode` value
3. Legacy registration (without `services` field) continues to work and creates `GYM` entry_mode
4. Subscription queries that reference `subscription.plan` continue to work via the primary SubscriptionItem
5. Feature flags (`Gym.features`) continue to gate module availability
