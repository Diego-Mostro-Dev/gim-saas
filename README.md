# Gym SaaS

Full stack gym management SaaS built with Django REST Framework, PostgreSQL and React.

This project focuses on creating a modern and scalable management system for gyms, including member management, subscriptions, payments and analytics.

The goal of the MVP is to deliver a real usable product for small and medium gyms before adding advanced SaaS features.

---

# Current Status

Backend MVP in progress.

Current backend includes:

- Django REST Framework API
- PostgreSQL database (Neon)
- Modular app architecture
- CRUD endpoints
- Filtering support
- Django Admin integration
- Environment variables configuration

Frontend development with React will begin next.

---

# Features

## Members

- Create members
- Edit members
- Delete members
- List members

## Membership Plans

- Monthly plans
- Weekly plans
- Premium plans
- Pricing and duration

## Subscriptions

- Member ↔ Plan relationship
- Payment status
- Expiration dates
- Active/inactive subscriptions

## Dashboard (planned)

- Active members
- Monthly revenue
- Expiring subscriptions
- Recent payments
- Gym analytics

---

# Tech Stack

## Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- django-filter

## Frontend (planned/in progress)

- React
- Vite
- React Router

---

# Project Structure

```txt
gym-saas/
├── backend/
│   ├── config/
│   ├── members/
│   ├── plans/
│   ├── subscriptions/
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│
└── README.md
```
