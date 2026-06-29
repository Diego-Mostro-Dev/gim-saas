# Documentation Audit Report

> **Date:** 2026-06-29
> **Scope:** All markdown documentation in the repository
> **Reference:** `docs/architecture/multi-service-domain.md`

---

## Files Reviewed

| # | File | Lines |
|---|------|-------|
| 1 | `README.md` | 124 |
| 2 | `frontend/README.md` | 54 |
| 3 | `docs/specs/member-services-and-onboarding.md` | 435 |
| 4 | `docs/member-entry-mode.md` | 220 |
| 5 | `docs/activities-rules.md` | 269 |
| 6 | `docs/architecture/multi-service-domain.md` | (new) |

---

## Contradictions Found

### C1 — "Service" terminology inconsistency

| Aspect | Detail |
|--------|--------|
| **Where** | All existing docs |
| **What** | The word "services" is used to mean "Gym vs Activities" — two fixed options. The new architecture defines services as an extensible catalog (Gym, Yoga, Pilates, Rehab, Nutrition...). |
| **Example** | `member-services-and-onboarding.md` line 40: table with Gimnasio, Actividades, FUTURO: Nutrición/PT/Rehab. This implies activities ARE a service, but activities are actually a feature flag. |
| **Severity** | **Medium** |
| **Correction** | Rename "Actividades" from a service to "a category of services executed via the Activities feature". The onboarding spec lists Gym and Activities as parallel services, but under the new model, Yoga, Pilates, and Crossfit are separate services that share the Activities infrastructure. |
| **Apply** | Postponed — wait until Service model is implemented (Sprint 4) |

---

### C2 — `Subscription.plan` non-nullable contradicts activity-only subscriptions

| Aspect | Detail |
|--------|--------|
| **Where** | `subscriptions/models.py` line 17, `docs/specs/member-services-and-onboarding.md` line 213 |
| **What** | The spec says "Subscription always exists for every member" and "plan may be null for activity-only". But the code enforces non-null FK. |
| **Severity** | **Critical** — blocks activity-only onboarding |
| **Correction** | Make `Subscription.plan` nullable OR create a "Activities Only" default plan. The architecture document resolves this via SubscriptionItem. |
| **Apply** | Sprint 2 — before activity-only registration ships |

---

### C3 — "Activities" treated as a single service, not a category

| Aspect | Detail |
|--------|--------|
| **Where** | `docs/specs/member-services-and-onboarding.md` line 40, `docs/activities-rules.md` line 43 |
| **What** | Activities is presented as one service alongside Gym. But in reality, the Activities feature enables multiple services (Yoga, Pilates, Crossfit). The current onboarding spec has only "Actividades" as a checkbox — it should eventually have individual service checkboxes. |
| **Severity** | **Medium** |
| **Correction** | The onboarding spec should be updated to reflect that "Activities" in Sprint 2 is a simplified proxy for multiple services. Full per-service selection comes in Sprint 4 when the Service model exists. |
| **Apply** | Postponed — Sprint 2 spec is intentionally simplified |

---

### C4 — `entry_mode` description contradicts between docs

| Aspect | Detail |
|--------|--------|
| **Where** | `docs/member-entry-mode.md` line 24-26 vs `docs/specs/member-services-and-onboarding.md` line 55-68 |
| **What** | Both docs agree entry_mode is transitional, but they describe slightly different futures. `member-entry-mode.md` says "ya no es el eje del producto" and describes specific fallback logic. The spec says "solo una guía para el frontend". Neither is wrong, but they are redundant and could drift. |
| **Severity** | **Low** |
| **Correction** | Consolidate entry_mode description into one place (the architecture document) and reference it from both. |
| **Apply** | Now — minor editorial change |

---

### C5 — Portal behavior spec contradicts between docs

| Aspect | Detail |
|--------|--------|
| **Where** | `docs/specs/member-services-and-onboarding.md` lines 218-268 vs `docs/activities-rules.md` lines 192-212 |
| **What** | Both describe portal modularity with similar but not identical tables. The spec uses a "Modules" table showing what each member type sees; activities-rules.md uses a decision tree. Different format, same content — duplication risk. |
| **Severity** | **Low** |
| **Correction** | Keep portal spec in one place (the spec document or the architecture doc) and reference from activities-rules.md |
| **Apply** | Now — editorial |

---

### C6 — Gym `features` registration will need to expand

| Aspect | Detail |
|--------|--------|
| **Where** | `gyms/models.py` `FEATURE_REGISTRY`, all docs |
| **What** | Currently only `extra_activities` is registered. The new architecture lists Payments, Store, Nutrition, Booking, Reports as potential features. These don't exist yet, but no document acknowledges the gap. The feature registry must be extended before new features are referenced. |
| **Severity** | **Low** |
| **Correction** | Add placeholder entries to `FEATURE_REGISTRY` as services are designed. No action now — only add when implementing. |
| **Apply** | Postponed — only when implementing each feature |

---

### C7 — `AttendanceSchedule` ownership ambiguity

| Aspect | Detail |
|--------|--------|
| **Where** | `docs/activities-rules.md` lines 54-55, all docs |
| **What** | The docs describe AttendanceSchedule as the mechanism to detect "has Gym service". But AttendanceSchedule is a schedule, not a service indicator. A member could have a Gym subscription without having set up schedules yet. The architecture document clarifies that SubscriptionItem detects the service; AttendanceSchedule is just operational data. |
| **Severity** | **Medium** |
| **Correction** | Update activities-rules.md service detection section to use SubscriptionItem (or at minimum, Subscription) as the primary detection mechanism, with AttendanceSchedule as secondary/operational. Currently it uses AttendanceSchedule.exists() which is fragile. |
| **Apply** | Sprint 3 — when service detection based on SubscriptionItem is implemented |

---

### C8 — No mention of SubscriptionItem anywhere in existing docs

| Aspect | Detail |
|--------|--------|
| **Where** | All existing docs |
| **What** | SubscriptionItem is the cornerstone of the new architecture. No existing document mentions it or plans for its introduction. The spec at line 205-210 still describes Subscription as directly referencing a single plan. |
| **Severity** | **Critical** — every doc that references subscriptions is incomplete |
| **Correction** | Update `member-services-and-onboarding.md` Subscription section to describe the SubscriptionItem model as the Sprint 2 target. |
| **Apply** | Now — critical for Sprint 2 planning |

---

### C9 — Git stash test confirmed `entry_mode` migration not applied

| Aspect | Detail |
|--------|--------|
| **Where** | `docs/member-entry-mode.md` line 89, `docs/specs/member-services-and-onboarding.md` line 307 |
| **What** | Both docs acknowledge the migration is pending. But `subscriptions/tests.py` Phase3BTest fails because of missing `entry_mode` column. This is a known but unfixed regression. |
| **Severity** | **Medium** |
| **Correction** | Apply the migration to the database. Fix Phase3BTest tests to provide `entry_mode` when creating members. |
| **Apply** | Now — unblocks tests |

---

### C10 — `can_member_operate` will need updating

| Aspect | Detail |
|--------|--------|
| **Where** | `docs/activities-rules.md` lines 123-132 |
| **What** | The doc notes that with the new vision, ALL members have a Subscription. `can_member_operate` currently returns True if no subscription exists. Once activity-only members get subscriptions (via SubscriptionItem), this code path becomes dead. But it also needs to handle the case where a subscription exists with no items (should not happen, but defensive). |
| **Severity** | **Low** |
| **Correction** | Update `can_member_operate` to check SubscriptionItem existence rather than Subscription existence. Update documentation accordingly. |
| **Apply** | Sprint 2 -- when SubscriptionItem is implemented |

---

### C11 — `docs/architecture/` directory referenced but doesn't exist

| Aspect | Detail |
|--------|--------|
| **Where** | `README.md` line 115: `├── architecture/       # Technical architecture docs` |
| **What** | The README project structure references `docs/architecture/` directory, but it did not exist until the current session. This is now resolved. |
| **Severity** | **Low** (resolved) |
| **Correction** | None — directory now exists with the architecture document. |
| **Apply** | Done |

---

### C12 — Activity-to-Service association is implicit

| Aspect | Detail |
|--------|--------|
| **Where** | `activities/models.py`, all docs |
| **What** | `Activity` has `gym` FK but no `service` FK. Currently, all activities in a gym are assumed to belong to whatever "Activities" means for that gym. Under the new model, an Activity must belong to a specific Service (e.g., Yoga activity belongs to Yoga service). This is not modeled. |
| **Severity** | **Medium** |
| **Correction** | Add `service` FK to `Activity` model when `Service` model is created (Sprint 4). Until then, document the implicit association. |
| **Apply** | Sprint 4 |

---

## Summary by Severity

| Severity | Count | Action Needed |
|----------|-------|---------------|
| Critical | 2 | C2 (Subscription.plan nullable) blocks onboarding. C8 (SubscriptionItem missing from planning docs) blocks Sprint 2 architecture alignment. |
| Medium | 4 | C1, C3, C7, C12 — need documentation updates aligned with Sprint 2-4 implementation |
| Low | 5 | C4, C5, C6, C9, C10, C11 — minor cleanups, test fixes, and editorial changes |

---

## Recommended Action Plan

### Now (before Sprint 2 coding)

1. **C2** — Decide: make `Subscription.plan` nullable or create a default plan for activity-only (product decision)
2. **C8** — Update `docs/specs/member-services-and-onboarding.md` to reference `SubscriptionItem` as the Sprint 2 target
3. **C9** — Apply `0009_member_entry_mode.py` migration and fix Phase3BTest tests
4. **C4, C5** — Minor editorial consolidation, no code changes

### Sprint 2

5. **C2** implementation — Modify Subscription model for multi-item support
6. **C10** — Update `can_member_operate()` for SubscriptionItem logic

### Sprint 3

7. **C7** — Fix service detection in activities-rules.md and code (SubscriptionItem-based)

### Sprint 4

8. **C1, C3, C12** — Create Service model, add FK to Activity, update all documentation

### No timeline

9. **C6** — Extend `FEATURE_REGISTRY` as new features are designed
