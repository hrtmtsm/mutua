/**
 * POST /api/record-join
 * Body: { matchId: string, sessionId: string }
 *
 * Stamps joined_at_a or joined_at_b on confirmed_sessions so we can
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

  // Find the confirmed session for this match
  const { data: session } = await db
    .from('confirmed_sessions')
    .select('id, match_id, matches(session_id_a, session_id_b)')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'no confirmed session found' }, { status: 404 });
  }

  const match = (session as any).matches;
  const isA = match?.session_id_a === sessionId;
  const isB = match?.session_id_b === sessionId;

  if (!isA && !isB) {
    return NextResponse.json({ error: 'sessionId not part of this match' }, { status: 403 });
  }

  const column = isA ? 'joined_at_a' : 'joined_at_b';

  await db
    .from('confirmed_sessions')
    .update({ [column]: new Date().toISOString() })
    .eq('id', session.id);

  return NextResponse.json({ ok: true, side: isA ? 'a' : 'b' });
}
