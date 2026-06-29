# Gym SaaS

> **Actualizado — 2026-06-26**

Full stack gym management SaaS built with Django REST Framework, PostgreSQL and React.

This project focuses on creating a modern and scalable management system for gyms and fitness centers, including member management, subscriptions, payments, attendance, routines, activities, and a member portal.

---

## Current Status

Backend and frontend MVP in production. Active development on Sprint 2 (onboarding wizard).

## Current Features

### Members
- CRUD members
- Public registration via QR code
- Member portal with access token
- Photo upload (Cloudinary)
- Entry mode tracking (gym / activity-only)

### Membership Plans
- Monthly/Weekly plans with pricing and duration
- Configurable weekly visit limits

### Subscriptions
- Member ↔ Plan relationship
- Payment status tracking (paid, pending, overdue, blocked, initial_pending)
- Auto-renewal
- Plan change requests with schedule migration

### Attendance
- Schedule slots per gym (day + hour)
- QR code check-in
- Schedule change requests
- Schedule swap requests
- Attendance analytics

### Routines
- Exercise library per gym
- Routine templates with exercises
- Bulk assignment to members
- Member workout tracking (sets, reps, weights)
- WhatsApp routine sharing

### Activities (feature-flagged)
- Activity catalog per gym
- Activity schedules with capacity
- Member enrollment with overlap validation
- Public enrollment management

### Payments
- Payment history
- Prorated amounts for registrations after billing closing day

### Member Portal
- Token-based authentication (no password)
- Dashboard with routine, schedule, payments, activities
- Conditional tabs based on contracted services
- Photo upload from portal

### Admin Dashboard
- Active members count
- Monthly revenue
- Expiring subscriptions
- Recent payments

## Tech Stack

### Backend
- Python / Django
- Django REST Framework
- PostgreSQL (Neon)
- Cloudinary (media storage)
- django-filter

### Frontend
- React
- Vite
- React Router
- Tailwind CSS
- lucide-react (icons)
- react-hot-toast

## Project Structure

```txt
gym-saas/
├── backend/
│   ├── config/             # Django project settings, URLs, API config
│   ├── accounts/           # Auth, user management
│   ├── members/            # Member model, CRUD, public registration
│   ├── gyms/               # Gym model, onboarding setup
│   ├── plans/              # Membership plans
│   ├── subscriptions/      # Subscriptions, plan changes, payment status
│   ├── attendance/         # Schedule slots, attendance, change/swap requests
│   ├── routines/           # Exercises, templates, assignments, workout tracking
│   ├── activities/         # Activities, schedules, enrollments (feature-flagged)
│   ├── payments/           # Payment records
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/          # Route pages (admin + public portal)
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service functions
│   │   ├── layouts/        # Layout components
│   │   └── App.jsx         # Route definitions
│   └── package.json
├── docs/
│   ├── specs/              # Functional specifications
│   ├── architecture/       # Technical architecture docs
│   └── sprint-2/           # Sprint 2 implementation plan
└── README.md
```

## Key Documentation

- [Multi-Service Domain Architecture](./docs/architecture/multi-service-domain.md) — Single source of truth for business domain
- [Product Vision & Onboarding](./docs/specs/member-services-and-onboarding.md)
- [Activities Module Rules](./docs/activities-rules.md)
- [Entry Mode Architecture](./docs/member-entry-mode.md)
- [Documentation Audit Report](./docs/architecture/audit-report.md)
