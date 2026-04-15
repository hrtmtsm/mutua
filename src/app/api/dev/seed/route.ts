/**
 * GET /api/dev/seed
 *
 * Seeds dummy matches in every scheduling state between the two test accounts.
 * ONLY works in non-production environments.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const EMAIL_A = 'hrtmtsh@gmail.com';
const EMAIL_B = 'hrt861.dly@gmail.com';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {

  const db = admin();

  // ── 1. Find session IDs from any existing match between the two accounts ──
  const { data: existing } = await db
    .from('matches')
    .select('session_id_a, session_id_b, email_a, email_b, name_a, name_b, native_language_a, native_language_b')
    .or(
      `and(email_a.eq.${EMAIL_A},email_b.eq.${EMAIL_B}),` +
      `and(email_a.eq.${EMAIL_B},email_b.eq.${EMAIL_A})`
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({
      error: `No existing match found between ${EMAIL_A} and ${EMAIL_B}. Make sure both accounts have been matched at least once.`,
    }, { status: 404 });
  }

  // Normalise so A = hrtmtsh, B = hrt861
  const isFlipped = existing.email_a === EMAIL_B;
  const sidA    = isFlipped ? existing.session_id_b : existing.session_id_a;
  const sidB    = isFlipped ? existing.session_id_a : existing.session_id_b;
  const nameA   = isFlipped ? existing.name_b  : existing.name_a;
  const nameB   = isFlipped ? existing.name_a  : existing.name_b;
  const langA   = isFlipped ? existing.native_language_b : existing.native_language_a;
  const langB   = isFlipped ? existing.native_language_a : existing.native_language_b;

  const base = {
    session_id_a:       sidA,
    session_id_b:       sidB,
    name_a:             nameA,
    name_b:             nameB,
    email_a:            EMAIL_A,
    email_b:            EMAIL_B,
    native_language_a:  langA,
    native_language_b:  langB,
    goal:               'Cultural exchange',
    comm_style:         'Text first',
    practice_frequency: 'Once a week',
    score:              88,
    reasons:            ['Shared interest in culture', 'Complementary languages'],
  };

  // ── 2. Delete any existing seed matches (identified by a marker in reasons) ──
  await db
    .from('matches')
    .delete()
    .contains('reasons', ['__seed__']);

  // ── 3. Insert one match per state ──────────────────────────────────────────
  const now   = new Date();
  const inTwoDays  = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const in20min    = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const seeds = [
    // Partners tab states
    { ...base, scheduling_state: 'pending_both', reasons: [...base.reasons, '__seed__'] },
    { ...base, scheduling_state: 'pending_b',    reasons: [...base.reasons, '__seed__'] },
    { ...base, scheduling_state: 'no_overlap',   reasons: [...base.reasons, '__seed__'] },
    { ...base, scheduling_state: 'computing',    reasons: [...base.reasons, '__seed__'] },
    // Exchanges tab — upcoming
    { ...base, scheduling_state: 'scheduled', scheduled_at: inTwoDays, reasons: [...base.reasons, '__seed__'] },
    // Exchanges tab — live now
    { ...base, scheduling_state: 'scheduled', scheduled_at: in20min,   reasons: [...base.reasons, '__seed__'] },
    // Progress tab — missed
    { ...base, scheduling_state: 'scheduled', scheduled_at: twoDaysAgo, reasons: [...base.reasons, '__seed__'] },
    // Progress tab — archived/completed
    { ...base, scheduling_state: 'archived',  scheduled_at: twoDaysAgo, reasons: [...base.reasons, '__seed__'] },
  ];

  const { data: inserted, error } = await db.from('matches').insert(seeds).select('id, scheduling_state, scheduled_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Created ${inserted?.length} seed matches. Refresh the app to see all states.`,
    matches: inserted,
  });
}

export async function DELETE() {

  const db = admin();
  await db.from('matches').delete().contains('reasons', ['__seed__']);
  return NextResponse.json({ ok: true, message: 'Seed matches deleted.' });
}
