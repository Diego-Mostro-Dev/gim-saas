# Gym SaaS — Frontend

> **Actualizado — 2026-06-26**

React frontend for the Gym SaaS platform.

## Tech Stack
- React 18
- Vite
- React Router v6
- Tailwind CSS
- lucide-react
- react-hot-toast
- dayjs

## Routes

### Public
- `/register/:gymCode` — Member registration (onboarding wizard)
- `/routine/:token` — Member portal (token-based auth)
  - Index: DashboardSelector (GymDashboard or ActivityDashboard)
  - `/workout` — Routine workout tracking
  - `/payments` — Payment history
  - `/activities` — Activity enrollments
  - `/schedules` — Gym schedule management
- `/checkin/:gymCode` — QR check-in
- `/onboarding/:gymCode` — Gym initial setup

### Admin (authenticated)
- `/dashboard` — Admin dashboard
- `/members` — Member CRUD
- `/subscriptions` — Subscription management
- `/plans` — Membership plans
- `/payments` — Payment records
- `/attendance` — Attendance view
- `/routines` — Exercise and routine management
- `/activities` — Activities management (feature-flagged)
- `/registration` — Manual member registration
- `/settings` — Gym settings
- `/attendance-qr` — QR code generator
- `/schedule-change-requests` — Schedule change approvals
- `/schedule-swap-requests` — Schedule swap approvals
- `/plan-change-requests` — Plan change approvals
- `/attendance-analytics` — Attendance metrics

## Build & Run

```bash
npm install
npm run dev     # development server
npm run build   # production build
```

Environment: `VITE_API_URL` points to the Django backend.
