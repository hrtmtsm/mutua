import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET  = process.env.ADMIN_SECRET ?? 'mutua-dev';
const MAX_MATCHES   = 5;   // max active matches per person

// ── Scoring ───────────────────────────────────────────────────────────────────

interface WaitlistEntry {
  id:                   string;
  email:                string;
  native_language:      string;
  target_language:      string;
  goal:                 string;
  communication_style:  string;
  practice_frequency?:  string;
  created_at:           string;
}

function score(a: WaitlistEntry, b: WaitlistEntry): number {
  let s = 60;
  if (a.goal               === b.goal)               s += 15;
  if (a.communication_style === b.communication_style) s += 20;
  if (a.practice_frequency  && b.practice_frequency &&
      a.practice_frequency  === b.practice_frequency)  s += 10;
  return Math.min(s, 99);
}

// ── Profile helper ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureProfile(admin: any, entry: WaitlistEntry): Promise<string> {
  // Return existing profile session_id if already created
  const { data: existing } = await admin
    .from('profiles')
    .select('session_id')
    .eq('email', entry.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.session_id;

  // Create a minimal profile seeded from waitlist data
  const sessionId = crypto.randomUUID();
  const { error } = await admin.from('profiles').insert({
    session_id:         sessionId,
    email:              entry.email,
    native_language:    entry.native_language,
    learning_language:  entry.target_language,
    goal:               entry.goal,
    comm_style:         entry.communication_style,
    availability:       'Flexible',
    practice_frequency: entry.practice_frequency ?? 'Once a week',
  });
  if (error) throw new Error(`Profile insert failed for ${entry.email}: ${error.message}`);
  return sessionId;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── 1. Load all waitlist entries ──────────────────────────────────────────
  const { data: waitlist, error: wErr } = await admin
    .from('waitlist_matches')
    .select('*')
    .order('created_at', { ascending: true });

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
  const entries = (waitlist ?? []) as WaitlistEntry[];

  // ── 2. Load existing active matches so we don't re-create them ────────────
  const { data: existingMatches } = await admin
    .from('matches')
    .select('session_id_a, session_id_b, email_a, email_b')
    .neq('scheduling_state', 'archived');

  const alreadyPaired = new Set<string>();
  const existingMatchCount = new Map<string, number>();
  for (const m of existingMatches ?? []) {
    const key = [m.email_a, m.email_b].sort().join('|');
    alreadyPaired.add(key);
    existingMatchCount.set(m.email_a, (existingMatchCount.get(m.email_a) ?? 0) + 1);
    existingMatchCount.set(m.email_b, (existingMatchCount.get(m.email_b) ?? 0) + 1);
  }

  // ── 3. Build all valid candidate pairs ────────────────────────────────────
  // A valid pair: A.native = B.target AND B.native = A.target
  type Pair = { a: WaitlistEntry; b: WaitlistEntry; score: number };
  const pairs: Pair[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];

      const languagesMatch =
        a.native_language === b.target_language &&
        b.native_language === a.target_language;
      if (!languagesMatch) continue;

      const pairKey = [a.email, b.email].sort().join('|');
      if (alreadyPaired.has(pairKey)) continue;

      pairs.push({ a, b, score: score(a, b) });
    }
  }

  // Sort best matches first
  pairs.sort((x, y) => y.score - x.score);

  // ── 4. Greedy assignment — max MAX_MATCHES per person ─────────────────────
  // Seed with existing counts so we don't exceed the cap across runs
  const matchCount = new Map<string, number>(existingMatchCount);
  const selectedPairs: Pair[] = [];

  for (const pair of pairs) {
    const countA = matchCount.get(pair.a.email) ?? 0;
    const countB = matchCount.get(pair.b.email) ?? 0;
    if (countA >= MAX_MATCHES || countB >= MAX_MATCHES) continue;

    selectedPairs.push(pair);
    matchCount.set(pair.a.email, countA + 1);
    matchCount.set(pair.b.email, countB + 1);
  }

  // ── 5. Create match rows (no emails sent) ─────────────────────────────────
  const created: { emailA: string; emailB: string; score: number }[] = [];
  const errors:  { emailA: string; emailB: string; error: string }[]  = [];

  for (const pair of selectedPairs) {
    try {
      const [sidA, sidB] = await Promise.all([
        ensureProfile(admin, pair.a),
        ensureProfile(admin, pair.b),
      ]);

      const reasons: string[] = [
        `Native ${pair.a.native_language} speaker — exactly the language ${pair.b.email} wants to practice`,
        `Learning ${pair.a.target_language} — ${pair.b.email}'s native language`,
      ];
      if (pair.a.goal === pair.b.goal)
        reasons.push(`Same goal: ${pair.a.goal}`);
      if (pair.a.communication_style === pair.b.communication_style)
        reasons.push(`Both prefer ${pair.a.communication_style.toLowerCase()}`);
      if (pair.a.practice_frequency && pair.a.practice_frequency === pair.b.practice_frequency)
        reasons.push(`Both want to practice ${pair.a.practice_frequency.toLowerCase()}`);

      const { error: insertErr } = await admin.from('matches').insert({
        session_id_a:       sidA,
        session_id_b:       sidB,
        email_a:            pair.a.email,
        email_b:            pair.b.email,
        native_language_a:  pair.a.native_language,
        native_language_b:  pair.b.native_language,
        goal:               pair.a.goal,
        comm_style:         pair.a.communication_style,
        practice_frequency: pair.a.practice_frequency ?? null,
        score:              pair.score,
        reasons,
        scheduling_state:   'pending_both',
      });

      if (insertErr) throw new Error(insertErr.message);

      created.push({ emailA: pair.a.email, emailB: pair.b.email, score: pair.score });
    } catch (err) {
      errors.push({
        emailA: pair.a.email,
        emailB: pair.b.email,
        error:  err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    summary: {
      waitlistSize:    entries.length,
      candidatePairs:  pairs.length,
      matchesCreated:  created.length,
      errors:          errors.length,
    },
    created,
    errors,
    // How many matches each person ended up with
    matchCounts: Object.fromEntries(matchCount),
  });
}
