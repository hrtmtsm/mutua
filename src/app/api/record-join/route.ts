/**
 * POST /api/record-join
 * Body: { matchId: string, sessionId: string }
 *
 * Stamps joined_at on the caller's confirmed_sessions row so we can
 * see per-session who actually showed up.
 */

import { NextResponse } from 'next/server';
import {requireAuth} from '@/lib/presenceAuth';
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

  const auth=await requireAuth(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
  const membership=await auth.rpcDb.from('matches').select('id').eq('id',matchId).maybeSingle();
  if(!membership.data)return NextResponse.json({error:'forbidden'},{status:403});
  const { error } = await db
    .from('confirmed_sessions')
    .update({ joined_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .eq('user_id', auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
