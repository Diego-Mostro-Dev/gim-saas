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

### Billing Cycle

Every **Gym** defines its own billing cycle. Two configuration values govern timing:

| Parameter | Purpose | Example |
|-----------|---------|---------|
| Closing day | Day of month when the billing cycle closes. Registrations on or before this day pay the full month. After this day, payment is prorated until the next closing day. | 10th |
| Grace period | Number of days after closing day during which the member remains fully active even without payment. | 6 days (closing day 10 → grace until day 16) |

The billing cycle runs from closing day of month N to closing day of month N+1. Every monthly invoice covers exactly one cycle.

The `Gym` model stores these values as `payment_due_day` (closing day) and `access_block_day` (closing day + grace period). The documentation uses business language; the model field names are a legacy naming that will be aligned in a future refactor.

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
- Configures business rules (billing closing day, grace period, schedule policies)
- Defines which services it sells and at what prices

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
6. Member receives `access_token` and immediately accesses the portal

### Initial Payment

The amount charged at registration depends on where the registration date falls relative to the gym's billing closing day.

**Scenario A — Registration on or before the closing day**

The member pays the FULL monthly price for every contracted service. No prorating.

> Example: Closing day is the 10th. Member registers on July 3rd. They pay full price for Gym Premium + Yoga Monthly. They have until the grace period end (day 16) to complete payment.

**Scenario B — Registration after the closing day**

The member pays only the proportional amount from registration date until the next closing day. Starting next cycle (after the closing day), they pay the normal monthly amount.

> Example: Closing day is the 10th. Member registers on July 18th. They pay the prorated amount for July 18–August 10. From August 10 onward, they pay full monthly price.

### Payment

- One subscription per member
- Payment is applied to the subscription as a whole (not per item)
- The gym's billing cycle, grace period, and blocking rules operate on the subscription level
- `SubscriptionItem.price_snapshot` enables per-item billing history

### Grace Period

After the closing day, the member has a **grace period** during which they are considered fully active even if payment is still pending.

During the grace period, the member can:

- Attend the gym
- Attend activities
- Mark attendance (QR check-in)
- Use the portal
- View routines
- Request schedule changes
- Request plan changes
- Everything works normally

The grace period is configured per Gym via `access_block_day` (the day after the grace period ends). Default: closing day + 6 days.

### Overdue

When the grace period expires without payment, the subscription status changes to **overdue** (blocked).

The member retains portal access and can:
- Log in and view their information
- See payment status and history
- Pay outstanding balances
- Contact the gym

The member cannot:
- Mark attendance (QR check-in)
- Enroll in new activities
- Access workout routines
- Request plan changes
- Request schedule changes
- Consume any contracted service

Service consumption is gated by `can_member_operate()`, which returns `False` for overdue subscriptions.

### Plan Changes

- A plan change targets a specific SubscriptionItem
- The system creates a PlanChangeRequest for that item
- Other items in the subscription are unaffected
- Approval/execution follows existing workflow
- **The change becomes effective at the start of the next billing cycle** (see Contract Stability)

### Renewal

- Subscription auto-renewal renews all active SubscriptionItems
- Cancelled or expired items are not renewed
- Price snapshots capture the plan price at time of renewal
- Renewal happens on the closing day of each billing cycle

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

## Contract Stability

This section defines how commercial changes interact with the billing cycle.

### The principle

A contracted service NEVER changes during the current billing cycle. This is the most important operational rule in the system.

All commercial changes — adding a service, removing a service, changing a plan, changing schedules, changing enrollments — are **stored immediately but applied at the beginning of the next billing cycle**.

There are:
- No mid-cycle commercial changes
- No refunds
- No partial recalculations
- No service swaps inside the same cycle

This keeps administration simple, preserves predictable revenue, and protects operational planning (staff scheduling, capacity allocation).

### What is a commercial change

| Change | Classification | Applies |
|--------|---------------|---------|
| Add Gym service | Commercial | Next cycle |
| Remove Gym service | Commercial | Next cycle |
| Add Yoga plan | Commercial | Next cycle |
| Remove Yoga plan | Commercial | Next cycle |
| Change Gym plan (e.g., Basic → Premium) | Commercial | Next cycle |
| Change Yoga plan (e.g., Monthly → 8 Classes) | Commercial | Next cycle |
| Modify attendance schedules | Commercial | Next cycle |
| Enroll in / unenroll from activity schedules | Commercial | Next cycle |
| Update phone, email, profile photo | Personal | Immediately |
| Change portal preferences | Personal | Immediately |

### Reservations

When a future change is approved (e.g., member adds Yoga starting next cycle), the system should **reserve capacity** in the target activity schedules before the effective date.

This means:
- The enrollment is created with `active=False` and `effective_date = next_cycle_start`
- The schedule's available capacity is reduced immediately (reserved, not consumed)
- On the effective date, `active` flips to `True`
- If the change is cancelled before the effective date, the reservation is released

Capacity planning is performed ahead of the effective date so the gym can staff accordingly.

### Implementation approach

- The existing `PlanChangeRequest` mechanism is the model for all deferred changes
- Each deferred change creates a pending record with `effective_date = next_cycle_start`
- A scheduled job (or trigger on cycle rollover) executes pending changes
- The portal shows pending future changes to the member: "Your plan will change to Premium on August 10th"

### Overdue state

After the grace period expires without payment, the subscription becomes **overdue** (blocked).

The member retains:
- Portal login
- Viewing their information
- Payment status and history
- Ability to pay outstanding balances
- Gym contact information

The member loses:
- Marking attendance (QR check-in)
- Enrolling in new activities
- Accessing workout routines
- Requesting plan changes
- Requesting schedule changes
- Any other form of service consumption

Portal access is always preserved. Service consumption is gated by `can_member_operate()`.

### Overdue in the portal

When the subscription is overdue, the portal still loads but shows:
- A prominent banner: "Tu suscripción está vencida. Regularizá tu pago para seguir entrenando."
- Payment tab is fully functional (pay now)
- All other tabs show a locked state with the same message
- Gym contact information is visible

### Immediate changes

Only personal information may be modified immediately:
- Phone number
- Email address
- Profile photo
- Any preference or setting that does not affect the commercial contract

Everything else — anything that changes what the member pays or what services they receive — waits until the next cycle.

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

### Sprint 2 — Billing cycle, subscription items, and onboarding

- [ ] Formalize billing cycle model: closing day, grace period, prorated calculation
- [ ] Implement initial payment logic: full price before/on closing day, prorated after
- [ ] Create `SubscriptionItem` model
- [ ] Migrate existing subscriptions: move plan FK from Subscription to SubscriptionItem
- [ ] Update registration endpoint to create SubscriptionItems per service
- [ ] Frontend onboarding wizard with multi-service selection
- [ ] `Subscription.plan` becomes nullable or is removed
- [ ] Update `can_member_operate()` to check SubscriptionItem existence
- [ ] Implement grace period behavior (member fully active while payment pending)
- [ ] Implement overdue/blocked state (portal preserved, service consumption blocked)
- [ ] Overdue banner and locked state in portal

### Sprint 3 — Contract stability and deferred changes

- [ ] Implement deferred change mechanism: changes stored immediately, applied next cycle
- [ ] Update PlanChangeRequest workflow to enforce next-cycle-only effective dates
- [ ] Implement capacity reservation for future enrollments (active=False, effective_date)
- [ ] Scheduled job or trigger to execute pending changes on cycle rollover
- [ ] Portal shows pending future changes to the member
- [ ] Remove `entry_mode` dependency from portal (second pass)
- [ ] Portal renders tabs based on SubscriptionItem data
- [ ] Each service registers its own portal modules

### Sprint 4 — Service model

- [ ] Create `Service` model with FK to Gym
- [ ] Create `ContractedService` model
- [ ] Migrate `MembershipPlan` to reference `Service`
- [ ] Move activity-service association from convention to FK
- [ ] Deprecate `entry_mode` (keep as read-only historical field)
- [ ] Admin UI for managing services per gym
- [ ] Rename Gym model fields: `payment_due_day` → `closing_day`, `access_block_day` → `grace_period_end_day`

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
- Billing cycle is configured via `payment_due_day` and `access_block_day` but the initial payment rules are not formally implemented
- Plan changes can have arbitrary effective dates (pre-contract-stability)
- Mid-cycle changes are technically possible (no enforcement)

### Phase B (Sprint 2)

- `SubscriptionItem` is created as the new core model
- Existing `Subscription.plan` data is migrated to a `SubscriptionItem`
- Registration endpoint creates SubscriptionItems
- `Subscription.plan` becomes nullable (or removed)
- `entry_mode` continues to be set but not used for business logic on new members
- Billing cycle is formalized: closing day, grace period, initial payment calculation
- Grace period behavior is implemented (member fully active while pending)
- Overdue/blocked state is implemented (portal preserved, service blocked)

### Phase C (Sprint 3)

- Portal detection switches from `entry_mode` to subscription data
- No new members depend on `entry_mode`
- Existing members still have `entry_mode` for read-only compatibility
- Deferred change mechanism is implemented (changes stored now, applied next cycle)
- PlanChangeRequest enforces next-cycle-only effective dates
- Capacity reservation for future enrollments
- Pending changes visible in portal

### Phase D (Sprint 4)

- `Service` model is created and populated for each gym
- `MembershipPlan.service` FK is added
- Activities get a `service` FK
- `ContractedService` is designed but may not replace SubscriptionItem yet
- `entry_mode` is fully deprecated as a business field (kept for data history)
- Gym model fields renamed for clarity

### Backward compatibility invariants

1. All existing API responses must continue to include `entry_mode` if they did before
2. All existing members retain their `entry_mode` value
3. Legacy registration (without `services` field) continues to work and creates `GYM` entry_mode
4. Subscription queries that reference `subscription.plan` continue to work via the primary SubscriptionItem
5. Feature flags (`Gym.features`) continue to gate module availability
