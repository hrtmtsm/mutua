/**
 * GET /api/cron/run-matching
 * Called daily by Vercel cron. Finds all unmatched profile pairs and creates matches,
 * then emails both users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_MATCHES    = 8;
const STUCK_DAYS     = 3;  // days before a user is considered stuck
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';
const APP_URL        = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com').replace(/\/$/, '');

interface Profile {
  session_id:          string;
  email:               string;
  name?:               string;
  native_language:     string;
  learning_language:   string;
  goal:                string;
  comm_style:          string;
  practice_frequency?: string;
}

function score(a: Profile, b: Profile): number {
  let s = 60;
  if (a.goal              === b.goal)              s += 15;
  if (a.comm_style        === b.comm_style)        s += 20;
  if (a.practice_frequency && b.practice_frequency &&
      a.practice_frequency === b.practice_frequency) s += 10;
  return Math.min(s, 99);
}

export async function GET(req: NextRequest) {
  const cronSecret  = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET ?? 'mutua-dev';
  const incomingKey = req.headers.get('x-vercel-cron-signature') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  // Vercel signed cron requests; allow admin secret as fallback for manual triggers
  if (incomingKey && incomingKey !== cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Load all profiles
  const { data: profileRows, error: profileErr } = await db
    .from('profiles')
    .select('session_id, email, name, native_language, learning_language, goal, comm_style, practice_frequency');
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  const profiles = (profileRows ?? []) as Profile[];

  // Load existing active matches to avoid duplicates and respect cap
  const { data: existingMatches } = await db
    .from('matches')
    .select('email_a, email_b, scheduling_state, created_at')
    .neq('scheduling_state', 'archived');

  const alreadyPaired = new Set<string>();
  const matchCount    = new Map<string, number>();

  // Track per-user: whether all matches are pending and oldest is > STUCK_DAYS old
  const userMatchAges  = new Map<string, number[]>(); // email → [age_in_days]
  const userHasActive  = new Set<string>();            // has at least one scheduled/completed match

  for (const m of existingMatches ?? []) {
    alreadyPaired.add([m.email_a, m.email_b].sort().join('|'));
    matchCount.set(m.email_a, (matchCount.get(m.email_a) ?? 0) + 1);
    matchCount.set(m.email_b, (matchCount.get(m.email_b) ?? 0) + 1);

    const ageMs = Date.now() - new Date(m.created_at).getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    for (const email of [m.email_a, m.email_b]) {
      if (!userMatchAges.has(email)) userMatchAges.set(email, []);
      userMatchAges.get(email)!.push(ageDays);
    }

    if (m.scheduling_state === 'scheduled') {
      userHasActive.add(m.email_a);
      userHasActive.add(m.email_b);
    }
  }

  // A user is "stuck" if: no scheduled match AND all matches are older than STUCK_DAYS
  const stuckUsers = new Set<string>();
  for (const [email, ages] of userMatchAges) {
    if (userHasActive.has(email)) continue;
    if (ages.every(d => d >= STUCK_DAYS)) stuckUsers.add(email);
  }

  // Build all valid new pairs (language match, not already paired, under cap)
  type Pair = { a: Profile; b: Profile; s: number };
  const pairs: Pair[] = [];

  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      if (a.native_language !== b.learning_language) continue;
      if (b.native_language !== a.learning_language) continue;
      const key = [a.email, b.email].sort().join('|');
      if (alreadyPaired.has(key)) continue;
      pairs.push({ a, b, s: score(a, b) });
    }
  }

  pairs.sort((x, y) => y.s - x.s);

  // Greedy assignment
  const created: { emailA: string; emailB: string; score: number }[] = [];
  const errors:  { emailA: string; emailB: string; error: string }[]  = [];

  for (const { a, b, s } of pairs) {
    // Bypass cap for stuck users; enforce it for everyone else
    if (!stuckUsers.has(a.email) && (matchCount.get(a.email) ?? 0) >= MAX_MATCHES) continue;
    if (!stuckUsers.has(b.email) && (matchCount.get(b.email) ?? 0) >= MAX_MATCHES) continue;

    const reasons = [
      `Native ${a.native_language} speaker — exactly the language ${b.name ?? b.email.split('@')[0]} wants to practice`,
      `Learning ${a.learning_language} — ${b.name ?? b.email.split('@')[0]}'s native language`,
    ];
    if (a.goal       === b.goal)       reasons.push(`Same goal: ${a.goal}`);
    if (a.comm_style === b.comm_style) reasons.push(`Both prefer ${a.comm_style.toLowerCase()}`);
    if (a.practice_frequency && a.practice_frequency === b.practice_frequency)
      reasons.push(`Both want to practice ${a.practice_frequency.toLowerCase()}`);

    const { error: insertErr } = await db.from('matches').insert({
      session_id_a:       a.session_id,
      session_id_b:       b.session_id,
      name_a:             a.name ?? a.email.split('@')[0],
      name_b:             b.name ?? b.email.split('@')[0],
      email_a:            a.email,
      email_b:            b.email,
      native_language_a:  a.native_language,
      native_language_b:  b.native_language,
      goal:               a.goal,
      comm_style:         a.comm_style,
      practice_frequency: a.practice_frequency ?? null,
      score:              s,
      reasons,
      scheduling_state:   'pending_both',
    });

    if (insertErr) {
      errors.push({ emailA: a.email, emailB: b.email, error: insertErr.message });
      continue;
    }

    created.push({ emailA: a.email, emailB: b.email, score: s });
    matchCount.set(a.email, (matchCount.get(a.email) ?? 0) + 1);
    matchCount.set(b.email, (matchCount.get(b.email) ?? 0) + 1);
    alreadyPaired.add([a.email, b.email].sort().join('|'));

    if (EMAILS_ENABLED) {
      await Promise.allSettled([
        fetch(`${APP_URL}/api/send-match-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: a.email, nativeLanguage: a.native_language, targetLanguage: a.learning_language }),
        }),
        fetch(`${APP_URL}/api/send-match-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: b.email, nativeLanguage: b.native_language, targetLanguage: b.learning_language }),
        }),
      ]);
    }
  }

  return NextResponse.json({
    matchesCreated: created.length,
    stuckUsers:     stuckUsers.size,
    errors:         errors.length,
    created,
    ...(errors.length ? { errorDetails: errors } : {}),
  });
}
