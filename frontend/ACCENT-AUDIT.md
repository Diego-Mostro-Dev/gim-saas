# Visual Accent Audit

**Reference**: Dashboard page (light mode)
**Date**: June 2026

---

## Dashboard Reference Palette

| Usage | Class | Hex | Where on Dashboard |
|---|---|---|---|
| Stat icon (active members) | `text-blue-400` | `#60a5fa` | StatsCards icon + "Datos en tiempo real" |
| Activity dot | `bg-blue-400` | `#60a5fa` | RecentActivity timeline |
| "Ver Todos" link | `text-blue-400` | `#60a5fa` | UpcomingExpirations/PendingPayments |
| Weekly chart bars | `bg-blue-500` | `#3b82f6` | WeeklyChart |
| Revenue icon | `text-success-text` | `#15803d` (green-700) | StatsCards DollarSign |
| Revenue label | `text-success-text` | `#15803d` | StatsCards comparison text |
| Expiration icon | `text-danger-text` | `#b91c1c` (red-700) | StatsCards AlertTriangle |
| Expiration count | `text-danger-text` | `#b91c1c` | StatsCards number |
| Expiration pills | `bg-danger-bg` / `text-danger-text` | `#fee2e2`/`#b91c1c` | UpcomingExpirations |
| Pending payment pills | `bg-warning-bg` / `text-warning-text` | `#fef9c3`/`#a16207` | PendingPayments |
| Quick action icons | `text-pink-300` | `#f9a8d4` | QuickActions (4 icons) |
| Mark Attendance icon | `text-success-text` | `#15803d` | QuickActions |
| View Payments icon | `text-success-text` | `#15803d` | QuickActions |
| Gym avatar fallback | `bg-pink-500` | `#ec4899` | TopBar |
| Logout button | `bg-danger-bg` / `text-danger-text` | `#fee2e2`/`#b91c1c` | TopBar |

---

## GOOD (keep as-is — matches Dashboard contrast)

### Blue Primary (`blue-500` / `#3b82f6`)
| File | Usage | Why OK |
|---|---|---|
| Most pages | Primary action buttons (`bg-blue-500 text-white`) | Same weight as Dashboard chart bars |
| WeeklyChart.jsx:26 | Bar chart fill | Dashboard reference |
| BottomNav.jsx:76,95 | Notification badge bg | Solid, intentional badge |
| Members.jsx:251 | "+ Nuevo miembro" button | Standard primary |
| Payments.jsx:150 | "+ Nuevo pago" button | Standard primary |
| Plans.jsx:142 | "+ Nuevo plan" button | Standard primary |
| Subscriptions.jsx:179 | "+ Nueva suscripción" button | Standard primary |
| PageHeader.jsx:18 | "+ Nuevo" button | Standard primary |

### Blue Accent (`blue-400` / `#60a5fa`)
| File | Usage | Why OK |
|---|---|---|
| StatsCards.jsx:10 | Active members icon | Dashboard reference |
| StatsCards.jsx:17 | "Datos en tiempo real" | Dashboard reference |
| RecentActivity.jsx:14 | Activity dot | Dashboard reference |
| UpcomingExpirations.jsx:15 | "Ver Todos" link | Dashboard reference |
| AttendanceStatus.jsx:36,91,116,146 | Swap indicators | Consistent with Dashboard link pattern |
| WeeklyOccupancy.jsx:156 | "Swap de dia" label | Consistent accent |
| Members.jsx:238 | "Actualizando..." status | Fine as secondary text |
| ExerciseList.jsx:20 | Exercise icon | Fine as accent |
| TemplateList.jsx:20 | Template icon | Fine as accent |
| AttendanceAnalytics.jsx:156,208 | StatCard + chart label | Fine as accent |

### Success (`success-text`/`success-bg`) — fully semantic
| File | Usage | Why OK |
|---|---|---|
| StatsCards.jsx:24,31 | Revenue icon + label | Dashboard reference |
| QuickActions.jsx:55,66 | Mark Attendance / View Payments | Dashboard reference |
| PaymentCard.jsx:24 | Paid badge | Matches semantic convention |
| PaymentStats.jsx:26 | Cash total | Consistent semantic |
| MemberCard.jsx:50 | Membership badge | Consistent semantic |
| All status badges (approved, active, attended) | Status indicators | Consistent semantic |

### Danger (`danger-text`/`danger-bg`) — fully semantic
| File | Usage | Why OK |
|---|---|---|
| StatsCards.jsx:41,44 | Expiration icon + count | Dashboard reference |
| UpcomingExpirations.jsx:58 | Expiration pill | Dashboard reference |
| TopBar.jsx:50 | Logout button | Dashboard reference |
| All reject/delete buttons | Destructive actions | Consistent |
| All error banners | Error display | Consistent |

### Warning (`warning-text`/`warning-bg`) — fully semantic
| File | Usage | Why OK |
|---|---|---|
| PendingPayments.jsx:43,56 | Pending payment pill | Dashboard reference |
| All pending status badges | Status indicators | Consistent |

### Pink-500 for avatars (`bg-pink-500`)
| File | Usage | Why OK |
|---|---|---|
| TopBar.jsx:24 | Gym avatar | Dashboard reference |
| MemberPortalLayout.jsx:180 | Member avatar | Consistent with TopBar |
| Settings.jsx:225 | Gym avatar | Consistent branding |

---

## TOO WASHED OUT (low contrast on light surfaces)

| File | Line | Current | Hex | Issue |
|---|---|---|---|---|
| **PlanCard.jsx** | 24 | `text-blue-400` | `#60a5fa` | Weekly label on white card. `blue-400` on white is ~3.8:1 — acceptable for large text but borderline for this 14px text. Minor, but the Dashboard uses it sparingly. |
| **PlanSelector.jsx** | 37 | `text-blue-400` | `#60a5fa` | Same — plan option label |
| **CurrentPlanCard.jsx** | 38 | `text-blue-400` | `#60a5fa` | Plan price — could benefit from `blue-600` for price prominence |
| **PlanChangeModal.jsx** | 223 | `text-blue-400` | `#60a5fa` | Plan price in modal |
| **MemberCard.jsx** | 105 | `text-blue-400` | `#60a5fa` | "Ver rutina" button text. Button text needs better contrast. |
| **MemberDashboard.jsx** | 270 | `text-blue-400` | `#60a5fa` | "Ver historial completo" link |
| **PublicRoutine.jsx** | 239, 327 | `text-blue-400` | `#60a5fa` | "Ver historial completo" link |
| **MemberWorkout.jsx** | 23 | `text-blue-400` on `bg-blue-500/15` | `#60a5fa` on ~`#ebf2ff` | Day badge — very low contrast |
| **MemberWorkout.jsx** | 37 | `text-blue-400` on `bg-blue-500/20` | `#60a5fa` on ~`#e6efff` | Set number badge — very low contrast |
| **MemberWorkout.jsx** | 62 | `text-blue-400` | `#60a5fa` | Exercise weight label |
| **RoutineBuilder.jsx** | 41 | `text-blue-300` | `#93c5fd` | Builder header title on blue-tinted bg. Any `blue-300` text on light bg is ~2.6:1. |
| **RoutineBuilder.jsx** | 226 | `text-blue-300` | `#93c5fd` | Exercise weight in builder — washed out |
| **PublicRoutine.jsx** | 199 | `text-blue-400` on `bg-blue-500/20` | `#60a5fa` on ~`#e6efff` | Day filter tag — low contrast |
| **PlanChangeModal.jsx** | 247 | `text-blue-300` | `#93c5fd` | Helper message text |
| **Settings.jsx** | 528 | `text-blue-400` on `bg-blue-500/20` | `#60a5fa` on ~`#e6efff` | Edit schedule button |
| **ScheduleSwapRequests.jsx** | 451 | `text-purple-300` | `#d8b4fe` | Destination day/time in modal — very washed out |
| **MemberDashboard.jsx** | 245 | `text-blue-400` on `bg-blue-500/15` | `#60a5fa` on ~`#ebf2ff` | Check-in indicator badge |
| **MemberDashboard.jsx** | 246 | `text-text-primary` on `bg-zinc-500/15` | `#0f172a` on ~`#dadadd` | "Not checked in" — better, but `zinc-500/15` is very light |

### Pink-300 in QuickActions — borderline
`text-pink-300` (`#f9a8d4`) on white has ~3.2:1 contrast. While the Dashboard uses it as the reference, the icons are small (18px) which makes them harder to see. This is the Dashboard's own pattern, so it's intentionally soft — but worth flagging.

---

## TOO DARK (heavier than Dashboard palette)

No instances found that are substantially darker/stronger than Dashboard equivalents. The Dashboard itself uses `danger-text` (`#b91c1c`/red-700), `success-text` (`#15803d`/green-700), and `warning-text` (`#a16207`/dark yellow-700), which are intentionally strong for semantic meaning. These same tokens are used consistently elsewhere.

---

## INCONSISTENT

### I1 — Blue: mixed shades for the same purpose

The Dashboard uses `blue-400` for links and decorative accents, and `blue-500` for chart bars (solid fill). But across the app:

| What | Where | Current | Dashboard Equivalent |
|---|---|---|---|
| Active nav text | BottomNav.jsx | `text-blue-600` (`#2563eb`) | N/A (no nav on Dashboard) |
| Member initials | MemberCard, SubscriptionCard, UpcomingExpirations | `text-blue-600` | N/A (no initials on Dashboard) |
| Plan price badges | PlanCard, PlanSelector, PlanChangeModal | `text-blue-400` + `bg-blue-500/10` | N/A |
| Transfer payment count | PaymentStats | `text-blue-600` | N/A |
| Stat card swap count | AttendanceAnalytics | `text-blue-400` | Dashboard uses `text-blue-400` for similar stat |
| Realtime label | StatsCards | `text-blue-400` | ✅ Dashboard reference |
| "Ver rutina" button | MemberCard | `text-blue-400` on `bg-blue-600/20` | Dashboard doesn't have equivalent |

**Issue**: Three different blue shades (`blue-400`, `blue-500`, `blue-600`) are used without a clear rule for which goes where.

### I2 — Blue badge contrast: inconsistent despite Phase 2 fix

- Phase 2 fixed `text-blue-300` → `text-blue-600 dark:text-blue-300`. But `text-blue-600` is what BottomNav active state uses AND what plan price badges use. This means "active nav" and "plan price" now share the same blue weight, which may not be intentional.

### I3 — Purple: used for completely different purposes

| Where | Usage | Hex | Dashboard equivalent |
|---|---|---|---|
| BottomNav.jsx:25 | Active nav background | `bg-purple-500/20` | N/A (no active nav tint on Dashboard) |
| AttendanceAnalytics.jsx:139 | "Actualizar" button | `bg-purple-500` solid | Dashboard has no purple |
| AttendanceAnalytics.jsx:154 | Stats card icon container | `bg-purple-500/10 text-purple-400` | Dashboard stat icons use `text-blue-400` or semantic tokens |
| PublicRoutine.jsx:207 | Day filter tag | `bg-purple-500/20 text-purple-400` | Dashboard has no equivalent |
| PublicRoutine.jsx:536,568 | Block selector button | `bg-purple-500 text-white` | Dashboard has no purple |
| ScheduleSwapRequests.jsx:319 | Active filter tab | `bg-purple-500 text-white` | Other request pages use `bg-blue-500 text-white` |
| ScheduleSwapRequests.jsx:451 | Destination text in modal | `text-purple-300` | Very washed out |

**Issue**: Purple is used as a completely arbitrary accent. In AttendanceAnalytics it's the primary button, in BottomNav it's a background tint, in PublicRoutine it's an alternate selection color, in ScheduleSwapRequests it's a filter indicator. There is no semantic role for purple.

### I4 — Active filter tabs: blue vs purple

| Page | Active tab color |
|---|---|
| ScheduleChangeRequests.jsx:229 | `bg-blue-500 text-white` |
| PlanChangeRequests.jsx:218 | `bg-blue-500 text-white` |
| ScheduleSwapRequests.jsx:319 | `bg-purple-500 text-white` |
| Routines.jsx:98 | `border-blue-500 bg-blue-500/10 text-blue-600` |

ScheduleSwapRequests uses `bg-purple-500` while the other two request pages use `bg-blue-500`. This is a direct inconsistency.

### I5 — BottomNav active state: hybrid colors

BottomNav active item uses `bg-purple-500/20` (background) + `text-blue-600` (text). This mixes purple bg with blue text, which is unlike any other active state in the app. All other active states use solid `bg-blue-500` or `border-blue-500`.

### I6 — Pink usage: decorative vs CTA

| Role | Where | Class |
|---|---|---|
| Quick action icons (decorative) | Dashboard QuickActions | `text-pink-300` |
| Primary CTA button | Registration, Settings, ChangePassword | `bg-pink-500 text-white` |
| Gym avatar | TopBar, Settings, MemberPortal | `bg-pink-500 text-white` |

**Issue**: Pink serves as both a decorative icon accent AND a primary call-to-action color. In Registration, the "Registrar" button is pink (not blue), making it feel different from other primary actions.

### I7 — Zinc/cancelled: no semantic token

Cancelled status badges use `bg-zinc-500/20 text-zinc-400` across 3 request pages and PublicRoutine. There is no semantic token for "neutral/cancelled", so it's raw Tailwind everywhere. No dark variant exists for any of these.

### I8 — Amber-400 in MemberForm

`text-amber-400` is used for schedule warning text in MemberForm.jsx:203 — this is the ONLY raw amber usage in the app, while all other amber-yellow uses `warning` semantic tokens. Should be `text-warning-text dark:text-warning`.

### I9 — TemplateDetails mixed accent

TemplateDetails.jsx uses `bg-warning` (amber) for an "Edit" button at line 92, alongside `bg-danger` for delete. The Edit button uses the warning color, which is semantically incorrect (warning = caution, not edit).

---

## Proposed Unified Accent Palette

Derived from Dashboard colors. All values stay within the existing Tailwind + custom-property system.

### Primary Blue — `--primary` / `blue-500` (#3b82f6)
- **Usage**: Primary action buttons, chart bars, notification badges, selected tab indicators
- **Current state**: Already correct everywhere
- **Changes needed**: None

### Blue Link/Icon — `blue-400` (#60a5fa) [keep Dashboard reference]
- **Usage**: Decorative icons, secondary links ("Ver Todos", "Ver historial"), data labels, activity dots, swap indicators
- **Current state**: Used consistently with Dashboard pattern
- **Changes needed**: Replace purple usages that serve this same role

### Blue Text on Light — `blue-600` (#2563eb) / `dark:blue-300`
- **Usage**: Member initials, plan prices, active nav text, badge text on light backgrounds
- **Current state**: Already applied in Phase 2
- **Changes needed**: None

### Semantic Success — `success-text` / `success-bg`
- **Usage**: Revenue, approved status, attended check-in, paid badges, confirm buttons
- **Current state**: Already consistent and semantic
- **Changes needed**: None

### Semantic Warning — `warning-text` / `warning-bg`
- **Usage**: Pending status, expiry warnings, caution states
- **Current state**: Already consistent and semantic
- **Changes needed**: Change `text-amber-400` in MemberForm → `text-warning-text dark:text-warning`

### Semantic Danger — `danger-text` / `danger-bg`
- **Usage**: Expired status, delete/reject buttons, error banners, absence indicators
- **Current state**: Already consistent and semantic
- **Changes needed**: None

### Pink Accent — `pink-300` (#f9a8d4) / `pink-500` (#ec4899)
- **Usage**: Dashboard quick-action icons only (pink-300), avatar fallbacks (pink-500)
- **Current state**: `pink-500` for avatars is fine. `pink-500` for CTAs (Registration, ChangePassword) conflicts with primary blue. Move those to `blue-500`.
- **Changes needed**: Replace `bg-pink-500` on CTA buttons with `bg-blue-500`

### Purple — ELIMINATE as distinct accent
- **Current usage**: 8 scattered instances, no semantic role
- **Proposal**: Replace with:
  - BottomNav active bg: `bg-blue-500/10` (instead of `bg-purple-500/20`) — matches other active states
  - AttendanceAnalytics button: `bg-blue-500` (already consistent with other primary buttons)
  - AttendanceAnalytics stat: `bg-blue-500/10 text-blue-400` (matches Dashboard stat pattern)
  - ScheduleSwapRequests filter: `bg-blue-500 text-white` (matches other request pages)
  - PublicRoutine purple elements: keep as `blue-500` variant or drop
  - ScheduleSwapRequests purple-300 text: `text-blue-600 dark:text-blue-300`

### Neutral/Cancelled — add to semantic tokens
- **Current**: `bg-zinc-500/20 text-zinc-400` (raw, no token, no dark variant)
- **Proposal**: Define `--muted` and `--muted-text` tokens:
  - Light: `--muted: 113 113 122` (#71717a / zinc-500), `--muted-bg: 228 228 231` (#e4e4e7 / zinc-200), `--muted-text: 113 113 122`
  - Dark: `--muted: 161 161 170`, `--muted-bg: 63 63 70`, `--muted-text: 161 161 170`
- This would give cancelled badges proper light-mode backgrounds and dark-mode support.

### Amber — replaced by warning token
- The single `text-amber-400` in MemberForm should become `text-warning-text dark:text-warning`
- TemplateDetails "Edit" button using `bg-warning` should use `bg-primary` or `bg-blue-500`

---

## Summary of Changes Needed

| Priority | Change | Files Affected | Effort |
|---|---|---|---|
| P0 | Replace purple button in ScheduleSwapRequests → `bg-blue-500` | 1 | 1 edit |
| P0 | Fix `text-blue-300` remnants (RoutineBuilder, PlanChangeModal) | 2 | 2 edits |
| P1 | Replace purple active bg in BottomNav → `bg-blue-500/10` | 1 | 1 edit |
| P1 | Replace purple accents in AttendanceAnalytics → blue equivalents | 2 | 3 edits |
| P1 | Replace purple in PublicRoutine → blue equivalents | 2 | 4 edits |
| P1 | Fix `text-amber-400` → `text-warning-text dark:text-warning` | 1 | 1 edit |
| P1 | Fix TemplateDetails edit button → use blue instead of warning | 1 | 1 edit |
| P2 | Replace pink CTA buttons (Registration, ChangePassword) → blue | 2 | 2 edits |
| P2 | Address `text-blue-400` contrast in MemberCard "Ver rutina" → `text-blue-600` | 1 | 1 edit |
| P2 | Address `text-blue-400` contrast in MemberWorkout badges → darken | 2 | 3 edits |
| P3 | Add `--muted` / `--muted-text` / `--muted-bg` semantic tokens for cancelled states | index.css + 5 files | 6 edits |
| P3 | Swap purple-300 in ScheduleSwapRequests → `text-blue-600 dark:text-blue-300` | 1 | 1 edit |

Total: ~12 files, ~25 edits (not counting token creation).
