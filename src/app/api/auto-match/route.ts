import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_MATCHES = 5;

// ── Scoring ───────────────────────────────────────────────────────────────────

interface Profile {
  session_id:         string;
  email:              string;
  name?:              string;
  native_language:    string;
  learning_language:  string;
  goal:               string;
  comm_style:         string;
  practice_frequency?: string;
}

function score(a: Profile, b: Profile): number {
  let s = 60;
  if (a.goal      === b.goal)      s += 15;
  if (a.comm_style === b.comm_style) s += 20;
  if (a.practice_frequency && b.practice_frequency &&
      a.practice_frequency === b.practice_frequency) s += 10;
  return Math.min(s, 99);
}

// Emails are only sent when this env var is explicitly set to 'true'
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { session_id } = body;
  if (!session_id) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── 1. Load the new user's profile ───────────────────────────────────────
  const { data: me, error: meErr } = await admin
    .from('profiles')
    .select('*')
    .eq('session_id', session_id)
    .maybeSingle();

  if (meErr || !me) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // ── 2. Load all existing active matches to build current counts & pairs ──
  const { data: existingMatches } = await admin
    .from('matches')
    .select('email_a, email_b, session_id_a, session_id_b')
    .neq('scheduling_state', 'archived');

  const alreadyPaired = new Set<string>();
  const matchCount    = new Map<string, number>();

  for (const m of existingMatches ?? []) {
    alreadyPaired.add([m.email_a, m.email_b].sort().join('|'));
    matchCount.set(m.email_a, (matchCount.get(m.email_a) ?? 0) + 1);
    matchCount.set(m.email_b, (matchCount.get(m.email_b) ?? 0) + 1);
  }

  // If this user is already at the cap, nothing to do
  const myCount = matchCount.get(me.email) ?? 0;
  if (myCount >= MAX_MATCHES) {
    return NextResponse.json({ created: [], message: 'Already at max matches' });
  }

  // ── 3. Find compatible profiles ──────────────────────────────────────────
  const { data: candidates, error: cErr } = await admin
    .from('profiles')
    .select('*')
    .eq('native_language', me.learning_language)
    .eq('learning_language', me.native_language)
    .neq('session_id', session_id);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // Score, filter already-paired and people at cap, sort best first
  type ScoredCandidate = { profile: Profile; score: number };
  const scored: ScoredCandidate[] = ((candidates ?? []) as Profile[])
    .filter(c => {
      const pairKey = [me.email, c.email].sort().join('|');
      if (alreadyPaired.has(pairKey)) return false;
      if ((matchCount.get(c.email) ?? 0) >= MAX_MATCHES) return false;
      return true;
    })
    .map(c => ({ profile: c, score: score(me, c) }))
    .sort((a, b) => b.score - a.score);

  // ── 4. Create matches up to the remaining cap ────────────────────────────
  const slotsLeft = MAX_MATCHES - myCount;
  const toMatch   = scored.slice(0, slotsLeft);

  const created: { emailA: string; emailB: string; score: number }[] = [];
  const errors:  { email: string; error: string }[]                   = [];

  for (const { profile: partner, score: matchScore } of toMatch) {
    // Re-check partner cap (in case we matched them earlier in this loop)
    const partnerCount = matchCount.get(partner.email) ?? 0;
    if (partnerCount >= MAX_MATCHES) continue;

    const reasons: string[] = [
      `Native ${me.native_language} speaker — exactly the language ${partner.email} wants to practice`,
      `Learning ${me.learning_language} — ${partner.email}'s native language`,
    ];
    if (me.goal       === partner.goal)       reasons.push(`Same goal: ${me.goal}`);
    if (me.comm_style === partner.comm_style) reasons.push(`Both prefer ${me.comm_style.toLowerCase()}`);
    if (me.practice_frequency && me.practice_frequency === partner.practice_frequency)
      reasons.push(`Both want to practice ${me.practice_frequency.toLowerCase()}`);

    const { error: insertErr } = await admin.from('matches').insert({
      session_id_a:       me.session_id,
      session_id_b:       partner.session_id,
      name_a:             me.name        ?? me.email?.split('@')[0]        ?? null,
      name_b:             partner.name   ?? partner.email?.split('@')[0]   ?? null,
      email_a:            me.email,
      email_b:            partner.email,
      native_language_a:  me.native_language,
      native_language_b:  partner.native_language,
      goal:               me.goal,
      comm_style:         me.comm_style,
      practice_frequency: me.practice_frequency ?? null,
      score:              matchScore,
      reasons,
      scheduling_state:   'pending_both',
    });

    if (insertErr) {
      errors.push({ email: partner.email, error: insertErr.message });
      continue;
    }

    created.push({ emailA: me.email, emailB: partner.email, score: matchScore });

    // Notify both users by email — gated behind SEND_MATCH_EMAILS=true
    if (EMAILS_ENABLED) {
      const baseUrl = APP_URL.replace(/\/$/, '');
      await Promise.allSettled([
        // Notify the existing partner that a new match found them
        fetch(`${baseUrl}/api/send-match-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email:          partner.email,
            nativeLanguage: partner.native_language,
            targetLanguage: partner.learning_language,
          }),
        }),
        // Notify the new user that their match was found
        fetch(`${baseUrl}/api/send-match-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email:          me.email,
            nativeLanguage: me.native_language,
            targetLanguage: me.learning_language,
          }),
        }),
      ]);
    }

    // Update in-memory counts so subsequent iterations respect the cap
    matchCount.set(me.email,      (matchCount.get(me.email)      ?? 0) + 1);
    matchCount.set(partner.email, (matchCount.get(partner.email) ?? 0) + 1);
    alreadyPaired.add([me.email, partner.email].sort().join('|'));
  }

  return NextResponse.json({ created, errors });
}
