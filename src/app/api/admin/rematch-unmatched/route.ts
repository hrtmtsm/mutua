import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all session_ids that have at least one active match
  const { data: activeMatches } = await admin
    .from('matches')
    .select('session_id_a, session_id_b')
    .neq('scheduling_state', 'archived');

  const matchedIds = new Set<string>();
  for (const m of activeMatches ?? []) {
    matchedIds.add(m.session_id_a);
    matchedIds.add(m.session_id_b);
  }

  // Get all real profiles (non-stub = has a name)
  const { data: profiles } = await admin
    .from('profiles')
    .select('session_id, email, name')
    .not('name', 'is', null);

  const unmatched = (profiles ?? []).filter(p => !matchedIds.has(p.session_id));

  if (unmatched.length === 0) {
    return NextResponse.json({ message: 'No unmatched profiles found', triggered: 0 });
  }

  // Fire auto-match for each unmatched profile
  const baseUrl = APP_URL.replace(/\/$/, '');
  const results = await Promise.allSettled(
    unmatched.map(p =>
      fetch(`${baseUrl}/api/auto-match`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: p.session_id }),
      }).then(r => r.json())
    )
  );

  const matched = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.created?.length > 0).length;

  return NextResponse.json({
    unmatched_count: unmatched.length,
    newly_matched:   matched,
    triggered:       unmatched.length,
  });
}
