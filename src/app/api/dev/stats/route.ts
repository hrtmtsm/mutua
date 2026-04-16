/**
 * GET /api/dev/stats
 * Returns a quick snapshot of match counts by state.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const db = admin();
  const now = new Date().toISOString();

  const { data: matches } = await db
    .from('matches')
    .select('scheduling_state, scheduled_at')
    .neq('scheduling_state', 'archived');

  if (!matches) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });

  const counts: Record<string, number> = {};
  let upcomingCount = 0;

  for (const m of matches) {
    const s = m.scheduling_state ?? 'unknown';
    counts[s] = (counts[s] ?? 0) + 1;
    if (s === 'scheduled' && m.scheduled_at && m.scheduled_at > now) {
      upcomingCount++;
    }
  }

  return NextResponse.json({
    total_active: matches.length,
    upcoming_exchanges: upcomingCount,
    by_state: counts,
  });
}
