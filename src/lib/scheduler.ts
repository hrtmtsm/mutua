/**
 * Scheduling engine — implements docs/scheduling-spec.md
 *
 * Call `runScheduler(matchId)` from an API route (server-side only).
 * Uses service role client so it can read both users' availability and
 * write confirmed_sessions + update matches without RLS interference.
 */

import { createClient } from '@supabase/supabase-js';
import type { UserAvailability, ConfirmedSession, SchedulingState } from './supabase';

// ── Admin client (server-side only) ──────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Slot {
  start: Date;
  end:   Date;  // always start + 30 min
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Expand recurring weekly availability into concrete UTC slots over the next 14 days */
function expandToUTC(rows: UserAvailability[]): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();
  // Use UTC midnight as the anchor so day boundaries don't shift based on server clock time
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Check the next 14 days (2 weeks to ensure tz offsets don't miss the current week)
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(todayUTC);
    date.setUTCDate(todayUTC.getUTCDate() + dayOffset);

    // day_of_week: 0=Mon … 6=Sun  (spec convention)
    // JS getUTCDay(): 0=Sun … 6=Sat
    const jsDay = date.getUTCDay();
    const specDay = jsDay === 0 ? 6 : jsDay - 1; // convert JS→spec

    for (const row of rows) {
      if (row.day_of_week !== specDay) continue;

      // Build a local datetime string in the user's timezone, then convert to UTC
      const year  = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day   = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(Math.floor(row.start_minute / 60)).padStart(2, '0');
      const mins  = String(row.start_minute % 60).padStart(2, '0');

      // Use Intl to convert local time in stored timezone → UTC
      const localStr = `${year}-${month}-${day}T${hours}:${mins}:00`;
      const utcStart = localToUTC(localStr, row.timezone);
      if (!utcStart) continue;

      const utcEnd = new Date(utcStart.getTime() + 30 * 60 * 1000);
      slots.push({ start: utcStart, end: utcEnd });
    }
  }

  return slots;
}

/** Convert a local datetime string + IANA timezone to a UTC Date */
function localToUTC(localDatetime: string, timezone: string): Date | null {
  try {
    // Treat the local datetime string as if it were UTC, then measure
    // the offset by formatting that epoch in the target timezone.
    const desired = new Date(localDatetime + 'Z'); // treat as UTC initially
    const displayed = formatInTZ(desired, timezone);
    if (!displayed) return null;

    // Diff in ms between what we wanted and what we got (local offset)
    const offset = desired.getTime() - new Date(displayed + 'Z').getTime();
    return new Date(desired.getTime() + offset);
  } catch {
    return null;
  }
}

function formatInTZ(date: Date, timezone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    return null;
  }
}

/** Find overlapping 30-min windows between two slot arrays (partial overlap supported) */
function intersect(a: Slot[], b: Slot[]): Slot[] {
  const result: Slot[] = [];
  for (const sa of a) {
    for (const sb of b) {
      const overlapStart = sa.start > sb.start ? sa.start : sb.start;
      const overlapEnd   = sa.end   < sb.end   ? sa.end   : sb.end;
      const durationMs   = overlapEnd.getTime() - overlapStart.getTime();
      // Overlap must be exactly 30 min (or the full 30-min block fits)
      if (durationMs >= 30 * 60 * 1000) {
        // Take exactly the first 30 min of the overlap
        result.push({
          start: overlapStart,
          end:   new Date(overlapStart.getTime() + 30 * 60 * 1000),
        });
      }
    }
  }
  return result;
}

/** Remove any slot that overlaps with an already-confirmed session */
function subtractBooked(slots: Slot[], booked: ConfirmedSession[]): Slot[] {
  return slots.filter(slot => {
    return !booked.some(b => {
      const bs = new Date(b.starts_at);
      const be = new Date(b.ends_at);
      // Slot and booking overlap if they share any time
      return slot.start < be && slot.end > bs;
    });
  });
}

// ── Main scheduler function ───────────────────────────────────────────────────

export interface SchedulerResult {
  state: SchedulingState;
  slot:  Slot | null;
}

export async function runScheduler(matchId: string): Promise<SchedulerResult> {
  const db = adminClient();
  const tag = `[scheduler:${matchId.slice(0, 8)}]`;

  // 1. Fetch the match
  const { data: match, error: matchErr } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) throw new Error(`Match not found: ${matchId}`);

  console.log(`${tag} match found — emailA=${match.email_a} emailB=${match.email_b} state=${match.scheduling_state}`);

  // Get auth user IDs from Supabase auth — use perPage:1000 to avoid pagination truncation
  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users ?? [];

  console.log(`${tag} total auth users returned: ${users.length}`);

  const emailA = match.email_a;
  const emailB = match.email_b;
  const authUserA = users.find(u => u.email === emailA);
  const authUserB = users.find(u => u.email === emailB);

  console.log(`${tag} authUserA=${authUserA?.id ?? 'NOT FOUND'} authUserB=${authUserB?.id ?? 'NOT FOUND'}`);

  if (!authUserA || !authUserB) {
    // One or both users haven't signed up yet — can't schedule
    return { state: 'pending_both', slot: null };
  }

  // 3. Fetch availability for both users
  const [{ data: availA }, { data: availB }] = await Promise.all([
    db.from('user_availability').select('*').eq('user_id', authUserA.id),
    db.from('user_availability').select('*').eq('user_id', authUserB.id),
  ]);

  console.log(`${tag} availA rows=${availA?.length ?? 0} availB rows=${availB?.length ?? 0}`);
  if (availA?.length) console.log(`${tag} availA sample:`, JSON.stringify(availA.slice(0, 3)));
  if (availB?.length) console.log(`${tag} availB sample:`, JSON.stringify(availB.slice(0, 3)));

  const hasA = (availA?.length ?? 0) > 0;
  const hasB = (availB?.length ?? 0) > 0;

  if (!hasA && !hasB) return { state: 'pending_both', slot: null };
  if (!hasA)           return { state: 'pending_a',    slot: null };
  if (!hasB)           return { state: 'pending_b',    slot: null };

  // 4. Expand to concrete UTC slots for next 7 days
  const now = new Date();
  console.log(`${tag} server UTC now=${now.toISOString()}`);

  const slotsA = expandToUTC(availA as UserAvailability[]);
  const slotsB = expandToUTC(availB as UserAvailability[]);

  console.log(`${tag} expandedA=${slotsA.length} expandedB=${slotsB.length}`);
  if (slotsA.length) console.log(`${tag} slotsA sample:`, slotsA.slice(0, 3).map(s => s.start.toISOString()));
  if (slotsB.length) console.log(`${tag} slotsB sample:`, slotsB.slice(0, 3).map(s => s.start.toISOString()));

  // 5. Find overlapping windows
  let candidates = intersect(slotsA, slotsB);
  console.log(`${tag} candidates after intersect=${candidates.length}`);

  // 6. Subtract confirmed sessions for both users
  const [{ data: bookedA }, { data: bookedB }] = await Promise.all([
    db.from('confirmed_sessions').select('*').eq('user_id', authUserA.id),
    db.from('confirmed_sessions').select('*').eq('user_id', authUserB.id),
  ]);

  candidates = subtractBooked(candidates, (bookedA ?? []) as ConfirmedSession[]);
  candidates = subtractBooked(candidates, (bookedB ?? []) as ConfirmedSession[]);
  console.log(`${tag} candidates after subtractBooked=${candidates.length}`);

  // 7. Filter: skip slots within next 2 hours
  const minStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  candidates = candidates.filter(s => s.start > minStart);
  console.log(`${tag} candidates after minStart filter=${candidates.length} (minStart=${minStart.toISOString()})`);

  // 8. Sort by soonest
  candidates.sort((a, b) => a.start.getTime() - b.start.getTime());

  const best = candidates[0] ?? null;
  console.log(`${tag} best=${best ? best.start.toISOString() : 'none'} → ${best ? 'scheduled' : 'no_overlap'}`);

  if (!best) {
    return { state: 'no_overlap', slot: null };
  }

  // 9. Book the slot in a transaction (re-check for concurrent conflicts)
  const { error: txError } = await db.rpc('book_session_slot', {
    p_match_id:   matchId,
    p_user_id_a:  authUserA.id,
    p_user_id_b:  authUserB.id,
    p_starts_at:  best.start.toISOString(),
    p_ends_at:    best.end.toISOString(),
  });

  if (txError) {
    // Slot was taken by a concurrent scheduler — caller should retry
    throw new Error(`slot_conflict: ${txError.message}`);
  }

  return { state: 'scheduled', slot: best };
}
