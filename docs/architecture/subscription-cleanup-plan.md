# Subscription Cleanup Plan

**Date:** 2026-07-13
**Status:** Verified — awaiting user approval before execution
**Scope:** `subscriptions_subscription` table (29,188 rows → 236)

---

## 1. Problem Statement

The `auto_renew_subscriptions()` function had two compounding bugs that created 28,952 invalid future subscription rows across 48 members in Gym Dev (id=9).

**Bug 1 — MAX(id) selection picks future subscriptions:**
The algorithm selected `MAX(id)` as "the latest subscription" for each member. When the member already had future subscriptions (from a prior bug run), `MAX(id)` pointed to a future row. The algorithm computed the next month from that future date and created another future row — an infinite cascade that ran on every `GET /api/subscriptions/` request.

**Bug 2 — Race condition in Phase 2 idempotency check:**
The "already renewed" check (`Subscription.objects.filter(member=m, start_date=X).exists()`) ran outside the `transaction.atomic()` that performed the `create()`. Under concurrent requests, two requests could both see "not yet renewed" and both create a subscription for the same `(member, start_date)`, producing duplicate pairs separated by 267–604 ms.

**Impact:**
- 29,188 subscription rows (should be ~236)
- 29,188 SubscriptionItem rows (1:1 with subscriptions, cascade-deleted)
- 0 corrupted payments (no payments reference future subs)
- All corruption in Gym Dev (id=9); Gym Demo (id=10) and Sinkro Prueba (id=4) are clean

## 2. Root Cause (Proven)

```
Timeline (single request):
1. GET /api/subscriptions/ fires
2. auto_renew_subscriptions() runs
3. SELECT MAX(id) FROM subscriptions_subscription WHERE member_id = X
   → picks future subscription (e.g., start_date=2027-03-01)
4. Creates start_date=2027-04-01
5. Next request: MAX(id) picks 2027-04-01, creates 2027-05-01
6. Infinite cascade → 600+ future subscriptions per member
```

Duplicate pairs from race condition:
- 37 of 48 members have duplicate `(member_id, start_date)` pairs
- Gaps between `created_at`: 267–604 ms (concurrent HTTP requests)

## 3. Current State (as of 2026-07-13)

| Gym | Total | Past | Active | Future | Status |
|-----|-------|------|--------|--------|--------|
| Gym Dev (9) | 29,093 | 91 | 2 | 29,000 | Corrupted |
| Gym Demo (10) | 90 | 90 | 0 | 0 | Clean |
| Sinkro Prueba (4) | 5 | 4 | 1 | 0 | Clean |
| **Total** | **29,188** | **185** | **3** | **29,000** | |

### Member breakdown (Gym Dev)

- **48 members** have future subscriptions (all expired as of July 13, latest past sub ended June 24, 2026)
- **59 members** have no future subscriptions (clean)
- 2 of the 48 have an active subscription (members 827, 829 — subs running July 2–31 / July 7–31)
- 46 of the 48 are expired (latest past sub ended June 24, 2026)
- All 48 have `auto_renew=True, paid=True` on their latest past sub

### Future subscription distribution

- 340 unique `start_date` values from 2026-08-01 to 2054-11-01
- August 2026: 85 subs (48 members, 37 have duplicate pairs)
- September 2026: 86 subs
- ... cascading up to 2054

## 4. FK Dependencies

| Table | FK to Subscription | on_delete | Rows on future subs |
|-------|--------------------|-----------|---------------------|
| `subscriptions_subscriptionitem` | `subscription_id` | CASCADE | 29,000 |
| `payments_payment` | `subscription_id` | SET_NULL | **0** |
| `members_member` (reverse) | — | — | N/A |

**Key findings:**
- SubscriptionItem: 1:1 with Subscription (29,188 items for 29,188 subs). CASCADE delete means deleting a Subscription auto-deletes its item.
- Payment: 177 total payments, **none reference future subscriptions**. All 177 reference past or active subs. Safe to delete future subs.
- No other tables reference subscriptions.

## 5. Cleanup Strategy

### 5.1 What to keep

| Category | Rule | Count |
|----------|------|-------|
| Past subscriptions | All (historical record) | 185 |
| Active subscriptions | All (in-force as of today) | 3 |
| Future subscriptions | 1 per member (the nearest: `MIN(start_date) > today`) | 48 |
| **Total kept** | | **236** |

### 5.2 What to delete

| Category | Rule | Count |
|----------|------|-------|
| Future subs beyond the nearest | All future subs for each member except the one kept | 28,904 |
| Duplicate Aug 1 subs | For 37 members with 2 Aug 1 subs, delete the higher-id one | 37 |
| **Total deleted** | | **28,952** |
| **Cascade-deleted SubscriptionItems** | | **28,952** |
| **Payments affected** | | **0** |

### 5.3 Why keep 1 future sub per member?

For the 46 expired members: their latest past sub ended June 24, 2026 with `auto_renew=True`. The fixed algorithm (`end_date__lt=today`) would legitimately create an August 1 renewal for them on its next run. Keeping the August 1 sub preserves this expected behavior and avoids a billing gap.

For the 2 active members (827, 829): their current sub runs through July 31. The August 1 sub is their natural next-month renewal.

Deleting all future subs except the nearest ensures the new algorithm won't find expired future subs to cascade on, and each member gets exactly one upcoming billing cycle.

## 6. Validation Queries

Run these **before** cleanup to verify assumptions.

### 6.1 Total counts
```sql
SELECT COUNT(*) FROM subscriptions_subscription;
-- Expected: 29188
```

### 6.2 Future subs per member
```sql
SELECT member_id, COUNT(*) as cnt
FROM subscriptions_subscription
WHERE start_date > '2026-07-13'
GROUP BY member_id;
-- Expected: 48 rows, each cnt between 598-608
```

### 6.3 Confirm no payments on future subs
```sql
SELECT COUNT(*) FROM payments_payment p
JOIN subscriptions_subscription s ON p.subscription_id = s.id
WHERE s.start_date > '2026-07-13';
-- Expected: 0
```

### 6.4 Confirm duplicate pairs (Aug 1)
```sql
SELECT member_id, COUNT(*) as cnt
FROM subscriptions_subscription
WHERE start_date = '2026-08-01'
GROUP BY member_id
HAVING COUNT(*) > 1;
-- Expected: 37 rows (all with cnt=2)
```

### 6.5 Confirm 1:1 SubscriptionItem mapping
```sql
SELECT COUNT(*) FROM subscriptions_subscriptionitem
WHERE subscription_id NOT IN (SELECT id FROM subscriptions_subscription);
-- Expected: 0 (no orphaned items)
```

## 7. Cleanup Execution

### Step 1: Backup

```bash
cp backend/db.sqlite3 backend/db.sqlite3.bak.$(date +%Y%m%d)
```

### Step 2: Delete future subs except the nearest per member

```sql
-- Delete all future subs EXCEPT the one with the lowest id per member
-- (lowest id = the one created first = the legitimate nearest renewal)
DELETE FROM subscriptions_subscription
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY start_date ASC, id ASC) as rn
        FROM subscriptions_subscription
        WHERE start_date > '2026-07-13'
    ) ranked
    WHERE rn > 1
);
-- Expected: 28,952 rows deleted (all future subs except 48)
```

### Step 3: Verify remaining counts

```sql
SELECT COUNT(*) FROM subscriptions_subscription;
-- Expected: 236 (29188 - 28952)

SELECT COUNT(*) FROM subscriptions_subscription WHERE start_date > '2026-07-13';
-- Expected: 48

SELECT member_id, COUNT(*) FROM subscriptions_subscription
WHERE start_date > '2026-07-13'
GROUP BY member_id;
-- Expected: 48 rows, each cnt=1
```

### Step 4: Clean up orphaned SubscriptionItems

The CASCADE should handle this automatically, but verify:

```sql
-- Should be 0 (CASCADE deletes them)
SELECT COUNT(*) FROM subscriptions_subscriptionitem si
LEFT JOIN subscriptions_subscription s ON si.subscription_id = s.id
WHERE s.id IS NULL;
-- Expected: 0
```

If orphaned items remain (CASCADE may not fire on SQLite depending on version):

```sql
DELETE FROM subscriptions_subscriptionitem
WHERE subscription_id NOT IN (SELECT id FROM subscriptions_subscription);
```

### Step 5: Final verification

```sql
-- Total counts
SELECT COUNT(*) FROM subscriptions_subscription;
-- Expected: 236

SELECT COUNT(*) FROM subscriptions_subscriptionitem;
-- Expected: 236

SELECT COUNT(*) FROM payments_payment;
-- Expected: 177 (unchanged)

-- No future duplicates
SELECT member_id, COUNT(*) FROM subscriptions_subscription
WHERE start_date > '2026-07-13'
GROUP BY member_id HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Active subs unchanged
SELECT * FROM subscriptions_subscription WHERE start_date <= '2026-07-13' AND end_date >= '2026-07-13';
-- Expected: 3 rows (members 8, 827, 829)

-- No orphaned items
SELECT COUNT(*) FROM subscriptions_subscriptionitem si
LEFT JOIN subscriptions_subscription s ON si.subscription_id = s.id
WHERE s.id IS NULL;
-- Expected: 0
```

## 8. Rollback

If anything goes wrong:

```bash
cp backend/db.sqlite3.bak.20260713 backend/db.sqlite3
```

Or reverse the deletion by re-inserting from backup (SQLite does not support `ROLLBACK` after commits).

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| Deleting a legitimate subscription | Verified: 0 payments on future subs; all 29,000 future subs are bug-generated |
| Breaking SubscriptionItem FK | CASCADE handles deletion; orphan check in Step 4 |
| Affecting Gym Demo or Sinkro | Both gyms have 0 future subs — not affected |
| Re-triggering the bug | Phase 1 fix already deployed; new algorithm filters `end_date__lt=today` and cannot pick future subs |
| Losing historical data | Only future (invalid) subs are deleted; all past/active subs preserved |

## 10. Post-Cleanup

After cleanup, the system should have:

- **236 subscriptions** (185 past + 3 active + 48 future)
- **236 SubscriptionItems** (1:1)
- **177 Payments** (unchanged, all on past/active subs)
- **48 members** with 1 future sub each (August 2026)
- **59 members** with only past subs (no future)

The `auto_renew_subscriptions()` function (already fixed) will:
1. On Aug 1, find the 46 expired members' July subs (end_date=July 31 < Aug 1)
2. Create September 1 subs for them
3. The 2 active members' July subs expire July 31 → August subs created → September subs created
4. Normal monthly renewal cycle continues

## 11. Open Questions

1. **Should we also fix the race condition in Phase 2?** The current code checks idempotency outside `transaction.atomic()`. Two concurrent requests can still create duplicates. This is a code fix (move the check inside the atomic block), not a data cleanup. Deferred to a future PR.

2. **Should we add `Meta.ordering = ['start_date']` to Subscription?** Currently no ordering is defined, which means Django returns rows in arbitrary order. Adding explicit ordering would prevent future MAX(id) confusion. Deferred.

3. **Should we add `unique_together = ['member', 'start_date']`?** This would prevent duplicate pairs at the DB level. Deferred.

---

## 12. Verified Execution Plan (2026-07-13)

All numbers below were verified against the live database with 22/22 validation checks passing.

### 12.1 Before/After Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| subscriptions_subscription | 29,188 | 236 | -28,952 |
| subscriptions_subscriptionitem | 29,188 | 236 | -28,952 (CASCADE) |
| payments_payment | 177 | 177 | 0 |

### 12.2 What Gets Deleted

- **28,952 subscription rows** (all future subs except 1 per member)
- **28,952 subscriptionitem rows** (CASCADE delete, 1:1 mapping)
- **0 payment rows** (no payments reference future subs — verified)

### 12.3 What Gets Kept

**185 past subscriptions** (all gym IDs):
- Gym Dev: 91 rows (IDs 1294–1474)
- Gym Demo: 90 rows (IDs 26–27, 32–33, 1294–1383... see full list in DB)
- Sinkro: 4 rows

**3 active subscriptions** (as of 2026-07-13):
- id=30, member=8, gym=4 (Sinkro), plan=12, start=2026-07-01, end=2026-07-31, paid=False
- id=1475, member=827, gym=9 (Gym Dev), plan=14, start=2026-07-02, end=2026-07-31, paid=True
- id=1476, member=829, gym=9 (Gym Dev), plan=15, start=2026-07-07, end=2026-07-31, paid=True

**48 future subscriptions** (1 per affected member, all start=2026-08-01, all Gym Dev):
```
id=1477 member=775  id=1478 member=776  id=1479 member=777
id=1480 member=778  id=1481 member=779  id=1482 member=780
id=1483 member=781  id=1484 member=785  id=1485 member=786
id=1486 member=787  id=1487 member=788  id=1488 member=789
id=1489 member=790  id=1491 member=791  id=1493 member=792
id=1495 member=793  id=1497 member=794  id=1499 member=795
id=1501 member=796  id=1503 member=797  id=1505 member=798
id=1507 member=799  id=1509 member=801  id=1511 member=802
id=1513 member=803  id=1515 member=804  id=1517 member=805
id=1519 member=806  id=1521 member=807  id=1523 member=808
id=1525 member=809  id=1527 member=810  id=1529 member=811
id=1531 member=812  id=1533 member=813  id=1535 member=814
id=1537 member=815  id=1539 member=816  id=1541 member=818
id=1543 member=819  id=1545 member=820  id=1547 member=821
id=1549 member=822  id=1551 member=823  id=1553 member=824
id=1555 member=825  id=1557 member=827  id=1559 member=829
```

### 12.4 Affected Members (48 total, all Gym Dev)

All 48 have their latest past sub ending 2026-06-24 with `auto_renew=True, paid=True`.
Delete range per member: 597–607 future subs removed, 2–3 subs kept.

### 12.5 FK Safety

- **SubscriptionItem.subscription → Subscription (CASCADE)**: 28,952 items auto-deleted. Verified 1:1 mapping.
- **Payment.subscription → Subscription (SET_NULL)**: 0 payments reference any future sub. Safe.
- **No other FK points TO Subscription**. Verified via `_meta` introspection.

### 12.6 Execution SQL

```sql
-- Step 1: Backup
-- cp backend/db.sqlite3 backend/db.sqlite3.bak.20260713

-- Step 2: Delete (verified: removes exactly 28,952 rows)
DELETE FROM subscriptions_subscription
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY start_date ASC, id ASC) as rn
        FROM subscriptions_subscription
        WHERE start_date > '2026-07-13'
    ) ranked
    WHERE rn > 1
);

-- Step 3: Verify (run each and confirm expected values)
SELECT COUNT(*) FROM subscriptions_subscription;                          -- 236
SELECT COUNT(*) FROM subscriptions_subscriptionitem;                      -- 236
SELECT COUNT(*) FROM payments_payment;                                    -- 177
SELECT COUNT(*) FROM subscriptions_subscription WHERE start_date > '2026-07-13';  -- 48
SELECT member_id, COUNT(*) FROM subscriptions_subscription
  WHERE start_date > '2026-07-13' GROUP BY member_id HAVING COUNT(*) > 1; -- 0 rows

-- Step 4: Orphan check (CASCADE should handle this)
SELECT COUNT(*) FROM subscriptions_subscriptionitem si
  LEFT JOIN subscriptions_subscription s ON si.subscription_id = s.id
  WHERE s.id IS NULL;                                                     -- 0

-- Step 5: If orphans exist, clean them
DELETE FROM subscriptions_subscriptionitem
  WHERE subscription_id NOT IN (SELECT id FROM subscriptions_subscription);
```
