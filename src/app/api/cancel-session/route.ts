/**
 * POST /api/cancel-session
 * Body: { matchId: string }
 * Cancels a scheduled session: deletes confirmed_sessions, resets match to pending_both.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { matchId } = await request.json().catch(() => ({}));
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

  const db = adminClient();

  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Verify user is a member of this match
  const { data: profile } = await db
    .from('profiles')
    .select('session_id')
    .eq('email', user.email)
    .maybeSingle();

  const { data: match } = await db
    .from('matches')
    .select('id, session_id_a, session_id_b')
    .eq('id', matchId)
    .maybeSingle();

  if (!match || !profile) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const isMember = match.session_id_a === profile.session_id || match.session_id_b === profile.session_id;
  if (!isMember) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Delete confirmed session
  await db.from('confirmed_sessions').delete().eq('match_id', matchId);

  // Move to computing — both users still have slots in user_availability,
  // so immediately try to find the next open slot instead of forcing re-submission.
  await db.from('matches').update({
    scheduling_state: 'computing',
    scheduled_at:     null,
  }).eq('id', matchId);

  // Re-run scheduler to book the next available slot. Fire-and-forget.
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';
  fetch(`${origin}/api/schedule-match`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ matchId }),
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
