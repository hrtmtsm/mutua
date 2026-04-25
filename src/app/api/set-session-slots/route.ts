/**
 * POST /api/set-session-slots
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: { matchId: string, slots: Array<{ startsAt: string }> }
 *
 * Saves specific UTC slots for a match, then runs the scheduler inline.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { matchId, slots } = body as { matchId?: string; slots?: { startsAt: string }[] };

  if (!matchId || !slots?.length) {
    return NextResponse.json({ error: 'matchId and slots required' }, { status: 400 });
  }

  const db = adminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Validate slots
  const now = new Date();
  for (const s of slots) {
    const d = new Date(s.startsAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: `invalid startsAt: ${s.startsAt}` }, { status: 400 });
    if (d < now) return NextResponse.json({ error: 'slots must be in the future' }, { status: 400 });
  }

  // Verify user is part of this match
  const { data: match } = await db
    .from('matches')
    .select('id, email_a, email_b, name_a, name_b, native_language_a, native_language_b, scheduling_state')
    .eq('id', matchId)
    .single();

  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 });
  if (match.email_a !== user.email && match.email_b !== user.email) {
    return NextResponse.json({ error: 'not your match' }, { status: 403 });
  }

  const iAmA = match.email_a === user.email;

  // Replace this user's slots for this match
  await db.from('session_slots').delete().eq('user_id', user.id).eq('match_id', matchId);
  const { error: insertErr } = await db.from('session_slots').insert(
    slots.map(s => ({ user_id: user.id, match_id: matchId, starts_at: s.startsAt }))
  );
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Update availability timestamp and check if other side is ready
  const nowIso = new Date().toISOString();
  const { data: current } = await db.from('matches').select('availability_a_set_at, availability_b_set_at').eq('id', matchId).single();
  const otherSideReady = iAmA ? !!current?.availability_b_set_at : !!current?.availability_a_set_at;
  const availUpdate    = iAmA ? { availability_a_set_at: nowIso } : { availability_b_set_at: nowIso };

  if (otherSideReady) {
    // Both sides have slots — run scheduler
    await db.from('matches').update({ ...availUpdate, scheduling_state: 'computing', scheduled_at: null }).eq('id', matchId);
    await db.from('confirmed_sessions').delete().eq('match_id', matchId);

    const result = await runSessionSlotScheduler(matchId, db);

    if (result.state === 'scheduled' && result.scheduledAt && EMAILS_ENABLED) {
      fetch(`${APP_URL.replace(/\/$/, '')}/api/send-match-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, scheduledAt: result.scheduledAt }),
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, state: result.state, scheduledAt: result.scheduledAt ?? null });
  } else {
    const pendingState = iAmA ? 'pending_b' : 'pending_a';
    await db.from('matches').update({ ...availUpdate, scheduling_state: pendingState }).eq('id', matchId);
    return NextResponse.json({ ok: true, state: pendingState });
  }
}

async function runSessionSlotScheduler(matchId: string, db: ReturnType<typeof adminClient>) {
  const { data: match } = await db.from('matches').select('email_a, email_b').eq('id', matchId).single();
  if (!match) throw new Error('match not found');

  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const users  = usersData?.users ?? [];
  const authA  = users.find(u => u.email === match.email_a);
  const authB  = users.find(u => u.email === match.email_b);
  if (!authA || !authB) throw new Error('users not found');

  const [{ data: slotsA }, { data: slotsB }] = await Promise.all([
    db.from('session_slots').select('starts_at').eq('user_id', authA.id).eq('match_id', matchId),
    db.from('session_slots').select('starts_at').eq('user_id', authB.id).eq('match_id', matchId),
  ]);

  if (!slotsA?.length || !slotsB?.length) {
    await db.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
    return { state: 'no_overlap' as const, scheduledAt: null };
  }

  const minStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const setB     = new Set(slotsB.map(s => new Date(s.starts_at).getTime()));

  const overlaps = (slotsA as { starts_at: string }[])
    .map(s => new Date(s.starts_at))
    .filter(d => d > minStart && setB.has(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (!overlaps.length) {
    await db.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
    return { state: 'no_overlap' as const, scheduledAt: null };
  }

  const best   = overlaps[0];
  const endsAt = new Date(best.getTime() + 30 * 60 * 1000);

  const { error: txError } = await db.rpc('book_session_slot', {
    p_match_id:  matchId,
    p_user_id_a: authA.id,
    p_user_id_b: authB.id,
    p_starts_at: best.toISOString(),
    p_ends_at:   endsAt.toISOString(),
  });

  if (txError) {
    await db.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
    return { state: 'no_overlap' as const, scheduledAt: null };
  }

  return { state: 'scheduled' as const, scheduledAt: best.toISOString() };
}
