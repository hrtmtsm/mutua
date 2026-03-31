/**
 * POST /api/rematch
 * Body: { matchId, userId, partnerId }
 *
 * Records the user's intent to rematch. If the partner has also expressed
 * intent for the same match, creates a new pending_both match and returns it.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  const { matchId, userId, partnerId } = await req.json();
  if (!matchId || !userId || !partnerId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  const db = admin();

  // Record this user's intent (ignore duplicate if already exists)
  await db.from('rematch_intents').upsert({ match_id: matchId, user_id: userId }, { onConflict: 'match_id,user_id' });

  // Check if partner also expressed intent
  const { data: partnerIntent } = await db
    .from('rematch_intents')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', partnerId)
    .maybeSingle();

  if (!partnerIntent) {
    // Partner hasn't responded yet — just wait
    return NextResponse.json({ matched: false });
  }

  // Both expressed intent — fetch original match to get profile info
  const { data: original } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (!original) {
    return NextResponse.json({ error: 'original match not found' }, { status: 404 });
  }

  // Guard: don't create a new match if there's already an active one between these two users
  const { data: existing } = await db
    .from('matches')
    .select('id')
    .or(
      `and(session_id_a.eq.${original.session_id_a},session_id_b.eq.${original.session_id_b}),` +
      `and(session_id_a.eq.${original.session_id_b},session_id_b.eq.${original.session_id_a})`
    )
    .neq('id', matchId)
    .neq('scheduling_state', 'archived')
    .maybeSingle();

  if (existing) {
    // Already have an active match — return it instead of creating a duplicate
    await db.from('rematch_intents').delete().eq('match_id', matchId);
    return NextResponse.json({ matched: true, newMatchId: existing.id });
  }

  // Create new match with same participants
  const { data: newMatch, error } = await db.from('matches').insert({
    session_id_a:       original.session_id_a,
    session_id_b:       original.session_id_b,
    name_a:             original.name_a,
    name_b:             original.name_b,
    email_a:            original.email_a,
    email_b:            original.email_b,
    native_language_a:  original.native_language_a,
    native_language_b:  original.native_language_b,
    goal:               original.goal,
    comm_style:         original.comm_style,
    practice_frequency: original.practice_frequency,
    score:              original.score,
    reasons:            original.reasons,
    scheduling_state:   'pending_both',
  }).select().maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Archive the old match so it no longer appears on the exchanges page
  await db.from('matches').update({ scheduling_state: 'archived' }).eq('id', matchId);

  // Clean up intents so they can rematch again in future
  await db.from('rematch_intents').delete().eq('match_id', matchId);

  return NextResponse.json({ matched: true, newMatchId: newMatch?.id });
}
