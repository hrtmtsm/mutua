import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [
    { count: totalProfiles },
    { data: matchStates },
    { count: totalAvailability },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).not('name', 'is', null),
    admin.from('matches').select('scheduling_state').neq('scheduling_state', 'archived'),
    admin.from('user_availability').select('user_id', { count: 'exact', head: true }),
  ]);

  const stateCounts: Record<string, number> = {};
  for (const m of matchStates ?? []) {
    stateCounts[m.scheduling_state] = (stateCounts[m.scheduling_state] ?? 0) + 1;
  }

  // Profiles with no active match
  const { data: activeMatches } = await admin
    .from('matches')
    .select('session_id_a, session_id_b')
    .neq('scheduling_state', 'archived');

  const matchedIds = new Set<string>();
  for (const m of activeMatches ?? []) {
    matchedIds.add(m.session_id_a);
    matchedIds.add(m.session_id_b);
  }

  const { data: allProfiles } = await admin
    .from('profiles')
    .select('session_id')
    .not('name', 'is', null);

  const unmatchedCount = (allProfiles ?? []).filter(p => !matchedIds.has(p.session_id)).length;

  return NextResponse.json({
    total_real_profiles: totalProfiles,
    unmatched_profiles: unmatchedCount,
    profiles_with_availability: totalAvailability,
    match_states: stateCounts,
    total_active_matches: matchStates?.length ?? 0,
  });
}
