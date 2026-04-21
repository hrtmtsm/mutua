/**
 * POST /api/record-join
 * Body: { matchId: string, sessionId: string }
 *
 * Stamps joined_at on the caller's confirmed_sessions row so we can
 * see per-session who actually showed up.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const { matchId, sessionId } = await request.json();
  if (!matchId || !sessionId) {
    return NextResponse.json({ error: 'matchId and sessionId required' }, { status: 400 });
  }

  const db = admin();

  // Resolve the anonymous sessionId → auth user_id via user_availability
  const { data: avail } = await db
    .from('user_availability')
    .select('user_id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (!avail?.user_id) {
    return NextResponse.json({ error: 'sessionId not found' }, { status: 404 });
  }

  const { error } = await db
    .from('confirmed_sessions')
    .update({ joined_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('user_id', avail.user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
