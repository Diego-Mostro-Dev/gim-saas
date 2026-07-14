# Release Readiness Checklist — Activities Module

> **Branch:** `development` → `main`
> **Date:** 2026-07-07
> **Status:** MANUAL QA IN PROGRESS

---

# Purpose

This document contains the results of the manual QA performed before merging the Activities module into the `main` branch.

The checklist is divided into three categories:

- ✅ **Verified** – confirmed through manual testing.
- ⚠️ **Confirmed Issues** – reproduced manually and require fixes.
- ⏳ **Pending Validation** – scenarios that still need manual testing.

Only manually verified behavior is considered evidence. Code inspection alone is not treated as a confirmed issue.

---

# 1. Verified Features

## Activities

| Feature                         | Status | Notes                                                                      |
| ------------------------------- | ------ | -------------------------------------------------------------------------- |
| Activity CRUD                   | ✅     | Create, edit, deactivate and reactivate working correctly.                 |
| Schedule CRUD                   | ✅     | Create, edit, deactivate and reactivate working correctly.                 |
| Schedule overlap validation     | ✅     | Overlapping schedules rejected. Back-to-back schedules accepted.           |
| Last active schedule protection | ✅     | Cannot deactivate the last active schedule.                                |
| Automatic activity activation   | ✅     | Creating the first active schedule automatically reactivates the activity. |

---

## Enrollments

| Feature                         | Status | Notes                                                           |
| ------------------------------- | ------ | --------------------------------------------------------------- |
| Staff enrollment                | ✅     | Enrollment created successfully.                                |
| Staff unenrollment              | ✅     | Enrollment deactivated successfully.                            |
| Duplicate enrollment protection | ✅     | Duplicate active enrollments rejected.                          |
| Capacity validation             | ✅     | Schedule rejects enrollments when full.                         |
| Subscription validation         | ✅     | Members without the required service subscription are rejected. |
| Public enrollment               | ✅     | Member can enroll through the public portal.                    |
| Public unenrollment             | ✅     | Member can unenroll through the public portal.                  |

---

## Attendance

| Feature        | Status | Notes                                         |
| -------------- | ------ | --------------------------------------------- |
| QR Check-in    | ✅     | Successfully tested using the member QR link. |
| Gym attendance | ✅     | Attendance record created correctly.          |

---

## Feature Flag

| Feature             | Status | Notes                              |
| ------------------- | ------ | ---------------------------------- |
| Activities enabled  | ✅     | Activities module works correctly. |
| Activities disabled | ✅     | Endpoints correctly return 403.    |

---

# 2. Confirmed Issues

These issues were reproduced manually.

---

## BUG-001 — Gym + Activities onboarding does not request activity schedules

**Severity:** High

### Expected

When registering a member with both Gym and Activities services, the onboarding should request:

- Gym schedules
- Activity schedules

### Actual

Only Gym schedules are requested.

The member finishes the onboarding without selecting activity schedules.

### Status

Confirmed manually.

---

## BUG-002 — Pending subscriptions are not shown correctly

**Severity:** High

### Expected

Expired subscriptions should appear in the pending payments workflow.

### Actual

Members with expired subscriptions are shown in the subscriptions list but do not appear as pending payments.

Observed with:

- Nicolás Navarro
- Luis Suárez

Needs backend investigation.

---

## BUG-003 — Dashboard blocked members information appears inconsistent

**Severity:** Medium

### Expected

Blocked members should appear in the dashboard metrics.

### Actual

Blocked members were not visible during manual verification.

Needs confirmation.

---

## BUG-004 — Routine assignment button has poor placement

**Severity:** Low

### Expected

The "Assign Routine" action should be immediately accessible.

### Actual

The button is located at the bottom of the page, requiring unnecessary scrolling.

UX improvement.

---

## BUG-005 — Member selector pagination is confusing

**Severity:** Medium

### Expected

After filtering members, all matching results should remain accessible.

### Actual

Only the first page of results appears after filtering.

Needs frontend investigation.

---

# 3. Observations

The following behaviors were observed but are not considered bugs yet.

---

### Activity-only member

A member created with only the Activities service:

- appears in the activity enrollment list;
- has no active subscription shown in the portal.

The complete Activity-only flow has not yet been validated.

---

### Portal

The portal correctly displays:

- attendance history;
- payments;
- activities.

The subscription section correctly indicates:

> No active subscription.

This behavior may be expected for Activity-only members and requires business confirmation.

---

### Activity pricing

Activities currently have no pricing model.

This is expected at the current development stage.

---

# 4. Pending Validation

The following scenarios have not yet been manually verified.

## Onboarding

- [ ] Activity-only onboarding
- [ ] Activity-only QR check-in
- [ ] Activity-only self enrollment
- [ ] Activity-only self unenrollment

## Attendance

- [ ] Blocked member QR check-in
- [ ] Double QR check-in
- [ ] Staff check-in for blocked members

## Dashboard

- [ ] Blocked members count
- [ ] Pending payments widget
- [ ] Expiring subscriptions

## Security

- [ ] Cross-gym access
- [ ] Authentication
- [ ] Public endpoint rate limiting

## Activities

- [ ] Sunday validation
- [ ] End time validation
- [ ] Schedule reactivation scenarios
- [ ] Capacity edge cases
- [ ] Non-1-hour overlap validation

---

# 5. Technical Improvements

These are not release blockers.

- Improve member filtering inside EnrollMemberModal.
- Respect `restore_schedules` parameter during activity restoration.
- Improve routine assignment UX.
- Improve member search pagination.
- Review enrollment concurrency protection.

---

# 6. Release Decision

## Current Status

**Manual QA is still in progress.**

The primary Gym + Activities flow is functional, but several inconsistencies were identified during manual testing.

Before merging into `main`, the following items should be completed:

- Fix confirmed onboarding issues.
- Investigate pending payments inconsistency.
- Validate blocked-member behavior.
- Complete Activity-only end-to-end testing.

Once those validations are complete, the release can be evaluated again.
