/**
 * POST /api/set-availability
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: { slots: Array<{ day_of_week: number; start_minute: number }>, timezone: string }
 *
 * Saves the user's recurring weekly availability, then triggers the scheduler
 * for all their active matches that are waiting on availability.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runScheduler } from '@/lib/scheduler';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { slots, timezone } = body as {
    slots?: Array<{ day_of_week: number; start_minute: number }>;
    timezone?: string;
  };

  if (!slots || !timezone) {
    return NextResponse.json({ error: 'slots and timezone required' }, { status: 400 });
  }

  // Validate slot values to prevent garbage data in DB
  for (const s of slots) {
    if (!Number.isInteger(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6) {
      return NextResponse.json({ error: `invalid day_of_week: ${s.day_of_week}` }, { status: 400 });
    }
    if (!Number.isInteger(s.start_minute) || s.start_minute < 0 || s.start_minute > 1410) {
      return NextResponse.json({ error: `invalid start_minute: ${s.start_minute}` }, { status: 400 });
    }
  }
  try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); } catch {
    return NextResponse.json({ error: `invalid timezone: ${timezone}` }, { status: 400 });
  }

  const db = adminClient();

  // Verify token and get user
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Replace all availability for this user (delete + insert)
  await db.from('user_availability').delete().eq('user_id', user.id);

  if (slots.length > 0) {
    const rows = slots.map(s => ({
      user_id:      user.id,
      day_of_week:  s.day_of_week,
      start_minute: s.start_minute,
      timezone,
      updated_at:   now,
    }));

    const { error: insertErr } = await db.from('user_availability').insert(rows);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  // Find the user's session_id from profiles
  const { data: profile } = await db
    .from('profiles')
    .select('session_id')
    .eq('email', user.email)
    .maybeSingle();

  if (!profile?.session_id) {
    console.warn('[set-availability] no profile found for user', user.email, '— availability saved but matches not triggered');
    return NextResponse.json({ ok: true, matchesTriggered: 0 });
  }

  // Find all active matches waiting on availability (include 'computing' to unstick old matches)
  const { data: matches } = await db
    .from('matches')
    .select('id, scheduling_state, session_id_a, session_id_b')
    .or(`session_id_a.eq.${profile.session_id},session_id_b.eq.${profile.session_id}`)
    .in('scheduling_state', ['pending_both', 'pending_a', 'pending_b', 'no_overlap', 'computing', 'scheduled']);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, matchesTriggered: 0 });
  }

  // Update availability timestamps; only move to computing when BOTH sides have saved
  const isA = (m: any) => m.session_id_a === profile.session_id;
  const matchesToSchedule: string[] = [];

  for (const m of matches) {
    const iAmA = isA(m);
    const updatePayload: Record<string, unknown> = iAmA
      ? { availability_a_set_at: now }
      : { availability_b_set_at: now };

    // When recovering from no_overlap, start a fresh round: clear the other
    // side's stale timestamp so both must explicitly re-submit before the
    // scheduler runs again. This prevents User 1's update from immediately
    // triggering the scheduler against User 2's unchanged old slots.
    if (m.scheduling_state === 'no_overlap') {
      const clearKey     = iAmA ? 'availability_b_set_at' : 'availability_a_set_at';
      const pendingState = iAmA ? 'pending_b' : 'pending_a';
      Object.assign(updatePayload, { [clearKey]: null, scheduling_state: pendingState });
      await db.from('matches').update(updatePayload).eq('id', m.id);
      continue;
    }

    // Fetch current timestamps to check if other side already saved
    const { data: current } = await db
      .from('matches')
      .select('availability_a_set_at, availability_b_set_at')
      .eq('id', m.id)
      .single();

    const otherSideReady = iAmA
      ? !!current?.availability_b_set_at
      : !!current?.availability_a_set_at;

    if (otherSideReady) {
      // Both sides ready — clear any old confirmed session then re-run scheduler
      if (m.scheduling_state === 'scheduled') {
        await db.from('confirmed_sessions').delete().eq('match_id', m.id);
      }
      Object.assign(updatePayload, { scheduling_state: 'computing', scheduled_at: null });
      matchesToSchedule.push(m.id);
    } else {
      // Only this side ready — move to pending_a or pending_b so partner sees the CTA
      const pendingState = iAmA ? 'pending_b' : 'pending_a';
      Object.assign(updatePayload, { scheduling_state: pendingState });
    }

    await db.from('matches').update(updatePayload).eq('id', m.id);
  }

  // Run the scheduler inline for all matches where both sides have availability.
  // Calling it directly (instead of via HTTP) avoids inter-function timeouts on Vercel.
  const db2 = adminClient();
  const schedulerResults: Record<string, string> = {};

  await Promise.allSettled(
    matchesToSchedule.map(async (matchId) => {
      try {
        const result = await runScheduler(matchId);
        schedulerResults[matchId] = result.state + (result.slot ? ` @ ${result.slot.start.toISOString()}` : '');
        if (result.state !== 'scheduled') {
          await db2.from('matches').update({ scheduling_state: result.state }).eq('id', matchId);
        }
      } catch (err: any) {
        // Retry once on slot conflict, otherwise fall back to no_overlap
        try {
          const result = await runScheduler(matchId);
          schedulerResults[matchId] = 'retry:' + result.state + (result.slot ? ` @ ${result.slot.start.toISOString()}` : '');
          if (result.state !== 'scheduled') {
            await db2.from('matches').update({ scheduling_state: result.state }).eq('id', matchId);
          }
        } catch (err2) {
          schedulerResults[matchId] = 'error:' + String(err2);
          await db2.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
          console.error('[set-availability] scheduler failed for', matchId, err);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, matchesTriggered: matches.length, schedulerResults });
}
