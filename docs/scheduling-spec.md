# yonder Scheduling System — Product Spec
_Updated after design review_

---

## Overview

Scheduling a first session should require minimal effort from users. The system collects recurring weekly availability once, reuses it across matches, and auto-schedules when an overlap is found. Users only get prompted again when something is stale or no overlap exists.

**Key principle:** the system *suggests* — it never silently books.
Copy: "We found your first session" not "You've been scheduled."

---

## Core Concepts

### 1. Default Availability
- Recurring weekly pattern stored on the user's profile
- Set once, reused for all matches
- Editable anytime from profile
- Stored as 30-min blocks (by minute offset) in user's local timezone
- Stale after 14 days — triggers lightweight reconfirmation before reuse

### 2. Confirmed Sessions
- A real booked slot for a specific match
- Once confirmed, that 30-min slot is blocked for both users across all their matches
- Used to exclude already-taken slots when scheduling future matches

### 3. Match Scheduler
- Per-match computation triggered when both users have (fresh) availability
- Also runs automatically at match creation if both already have availability
- Algorithm: find earliest valid 30-min overlap within next 7 days
- Falls back to `no_overlap` if nothing found in that window

---

## Data Model

### `user_availability` table
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID NOT NULL  -- FK → auth.users (not session_id)
day_of_week   INT NOT NULL   -- 0=Mon … 6=Sun
start_minute  INT NOT NULL   -- minutes from midnight, 0–1410 (step 30)
timezone      TEXT NOT NULL  -- IANA, e.g. "America/Chicago"
updated_at    TIMESTAMPTZ DEFAULT NOW()
```
One row per 30-min block.
User free Mon 7–8 PM → two rows: day_of_week=0, start_minute=1140 and 1170.

**Why `start_minute` not `TIME`:** integer arithmetic is simpler and safer for overlap computation. No casting, no DST edge cases in comparisons.

### `matches` table (additions)
```sql
scheduling_state        TEXT DEFAULT 'pending_both'
scheduled_at            TIMESTAMPTZ        -- confirmed slot in UTC
availability_a_set_at   TIMESTAMPTZ        -- when A last set availability
availability_b_set_at   TIMESTAMPTZ        -- when B last set availability
expires_at              TIMESTAMPTZ        -- match auto-expires if no action
```

### `confirmed_sessions` table
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
match_id    UUID NOT NULL
user_id     UUID NOT NULL
starts_at   TIMESTAMPTZ NOT NULL   -- UTC
ends_at     TIMESTAMPTZ NOT NULL   -- UTC (starts_at + 30 min)
```
One row per user per session (two rows per confirmed match slot).
Used to subtract booked time from available slots during scheduling.

---

## State Machine

```
pending_both
    │ A sets availability               │ B sets availability
    ▼                                   ▼
pending_b                           pending_a
    │ B sets availability               │ A sets availability
    └──────────────┬────────────────────┘
                   ▼
              computing ◄──── either user updates availability
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
     scheduled           no_overlap
         │                    │
    reschedule           user updates
    requested            availability
         │                    │
         ▼                    ▼
     computing           computing
```

| State | Meaning |
|-------|---------|
| `pending_both` | Neither user has set availability |
| `pending_a` | B has set availability, waiting on A |
| `pending_b` | A has set availability, waiting on B |
| `computing` | Both have availability, running scheduler |
| `no_overlap` | No common slot found in next 7 days |
| `scheduled` | Session confirmed — slot locked |

**Scheduler runs at:**
- Match creation (if both users already have fresh availability)
- Either user sets/updates availability and the other already has theirs
- Either user requests reschedule

---

## Scheduler Algorithm

```
function findSlot(userA, userB, matchId):

  // 1. Get default availability for both users
  slotsA = getUserAvailability(userA)   // list of (day, start_minute, timezone)
  slotsB = getUserAvailability(userB)

  // 2. Convert all slots to UTC datetimes for next 7 days
  candidatesA = expandToUTC(slotsA, next7Days)
  candidatesB = expandToUTC(slotsB, next7Days)

  // 3. Find overlapping 30-min windows (supports partial overlap)
  overlaps = intersect(candidatesA, candidatesB)
  // e.g. A free 19:00–20:00, B free 19:30–20:30 → overlap 19:30–20:00 ✅

  // 4. Subtract already confirmed sessions for either user
  bookedA = getConfirmedSessions(userA)
  bookedB = getConfirmedSessions(userB)
  free = overlaps - bookedA - bookedB

  // 5. Rank: soonest first, skip slots before now + 2h buffer
  ranked = sortByStartAsc(free).filter(slot => slot.start > now + 2h)

  // 6. Return earliest, or null if none found in window
  return ranked[0] ?? null
```

**Partial overlap:** explicitly supported — the intersection can start mid-block.
A 19:00–20:00 ∩ B 19:30–20:30 = 19:30–20:00, which is exactly 30 min. Valid.

**Transaction safety:** wrap the final booking in a DB transaction.
Re-check that neither user's slot is taken before committing.
If slot was taken by a concurrent scheduler, re-run from step 4.

---

## Match Expiration

Matches where neither user sets availability within 7 days auto-expire.

```sql
expires_at = created_at + INTERVAL '7 days'
```

A daily cron job (or Supabase scheduled function) moves stale matches to `archived` state and sends a "your match expired" email.

This prevents the system from filling with dead matches.

---

## Stale Availability

If a user's `updated_at` on availability is > 14 days old:
- Before reusing for a new match, show reconfirmation screen
- "Still available at these times?" → `Looks good` / `Update`
- If confirmed without changes, bump `updated_at` to now
- Does not block the other user's flow — they can still set their availability while this is pending

---

## Timezone Handling

- Store `timezone` (IANA string) at write time alongside each availability block
- **Never convert recurring weekly slots to UTC at rest** — DST breaks this
- Convert to UTC only at scheduling time, for the specific dates being checked
- Display scheduled times to each user in their own stored timezone
- Availability picker UI must detect local timezone before rendering
- On first open: "We'll use your device timezone (America/Chicago). Change?"

---

## User Flows

### Flow A — Happy path
1. Match created → email to both: *"You've been matched with [Name]! Set your availability."*
2. Each user independently opens the availability picker and marks weekly free times
3. Second user submits → scheduler runs → slot found
4. State → `scheduled`
5. Email to both: *"We found your first session with [Name] — Thu, Mar 20 · 7:00 PM your time. Confirm or reschedule."*
6. Partner card shows scheduled time + Confirm + Reschedule

### Flow B — Match created, both already have fresh availability
1. Match created
2. System immediately runs scheduler (no user action needed)
3. If slot found → email both: *"We already found a time that works for you both."*
4. If no slot → fall through to Flow C

### Flow C — No overlap found
1. Scheduler runs, returns null
2. State → `no_overlap`
3. Email to both: *"We couldn't find a shared 30-minute window yet."*
4. Partner card shows:
   - "No shared window found yet."
   - Closest miss: *"You're both nearly free on Wed evening — open one more slot and we can schedule."*
   - CTA: **Update availability →**
5. Either user updates → scheduler re-runs

### Flow D — Stale availability
1. New match created for user with availability set 3 weeks ago
2. System flags as stale before running scheduler
3. Show: *"Still free at these times? [Mon, Wed 7–9 PM]"* → `Looks good` / `Update`
4. User confirms → scheduler runs as normal

### Flow E — Multi-match conflict
1. User A has matches with B and C, both overlap at Tue 7:00 PM
2. B's match was created first → Tue 7:00 PM goes to B
3. Scheduler for C excludes Tue 7:00 PM → picks next available overlap
4. Both schedulers run in transactions to prevent double-booking

### Flow F — Reschedule
1. User taps Reschedule
2. State → `computing`, original slot excluded
3. Scheduler finds next valid slot → `scheduled` with new time
4. If no alternative: *"No alternative slots found — try expanding your availability."*
5. Email both with new time

---

## UI States (Partner Card)

### `pending_both` / own side pending
```
[Avatar] Name

Native  ·  Practicing  ·  In common tags

─────────────────────────────────────────
Set your availability to find a time
for your first 30-min session.

  [ Set your availability → ]
─────────────────────────────────────────
```

### Waiting on partner (own side done)
```
[Avatar] Name                    ⏳ Waiting

─────────────────────────────────────────
You're all set. Waiting for [Name]
to share their availability.
─────────────────────────────────────────
```

### `no_overlap`
```
[Avatar] Name               No overlap yet

─────────────────────────────────────────
No shared window found yet.

Closest: Wed evenings — you're both
nearly free. Open one more slot to
get scheduled.

  [ Update availability → ]
─────────────────────────────────────────
```

### `scheduled`
```
[Avatar] Name                  ✓ Scheduled

─────────────────────────────────────────
We found your first session

Thu, Mar 20 · 7:00 PM your time

  [ Confirm ]          Reschedule
─────────────────────────────────────────
```

---

## Email Triggers

| Trigger | Recipient | Subject |
|---------|-----------|---------|
| Match created | Both | "You've been matched — set your availability" |
| One user sets availability | Partner | "[Name] is ready — share your availability" |
| 48h no response (partner waiting) | Pending user | "[Name] is waiting on you" |
| Session found | Both | "We found your first session with [Name]" |
| No overlap found | Both | "Update your availability to get scheduled" |
| Match expires (7 days no activity) | Both | "Your match with [Name] has expired" |
| Reschedule complete | Both | "Your session has been moved to [new time]" |
| Session in 24h | Both | "Your session with [Name] is tomorrow" |

---

## Priority / Fairness

When one user has multiple matches competing for the same slot:
- **Earliest match created gets priority** (deterministic, simple)
- Ties: most overlapping slots wins (best fit)
- This means later matches may get less optimal times — acceptable for MVP, worth logging

---

## MVP Scope

### Build now ✅
- `user_availability` table + weekly picker UI on profile
- Additions to `matches` table (`scheduling_state`, `scheduled_at`, `expires_at`)
- `confirmed_sessions` table
- Scheduler function (overlap logic + conflict subtraction + transaction)
- State machine transitions
- All email triggers
- Timezone detection + storage
- Stale check (14 days)
- Reschedule path
- Match expiration (7 days)

### Cut for now ❌
- Advanced slot ranking (preferred time buckets)
- Fairness scoring across multiple matches
- Distributed locking (monitor, add when needed)
- Recurring session scheduling (week 2, 3…)
- In-app push notifications

---

## Next Steps

1. **Supabase schema** — create tables, RLS policies, indexes
2. **Scheduler function** — either Edge Function or API route
3. **Availability picker UI** — weekly grid on profile page
4. **Partner card state UI** — swap current confirm/other-times for state-driven card
5. **Email triggers** — wire into existing Resend setup
