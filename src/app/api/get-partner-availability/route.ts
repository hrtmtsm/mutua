/**
 * GET /api/get-partner-availability?matchId=<uuid>
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Returns the partner's weekly availability slots for a given match.
 * Only accessible if the requesting user is a member of the match.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const matchId = new URL(request.url).searchParams.get('matchId');
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify requester
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Get requester's session_id
  const { data: myProfile } = await db
    .from('profiles')
    .select('session_id')
    .eq('email', user.email)
    .maybeSingle();
  if (!myProfile?.session_id) return NextResponse.json({ error: 'profile not found' }, { status: 403 });

  // Fetch match and verify membership
  const { data: match } = await db
    .from('matches')
    .select('id, session_id_a, session_id_b, email_a, email_b')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 });

  const iAmA = match.session_id_a === myProfile.session_id;
  const iAmB = match.session_id_b === myProfile.session_id;
  if (!iAmA && !iAmB) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const partnerEmail = iAmA ? match.email_b : match.email_a;
  if (!partnerEmail) return NextResponse.json({ slots: [], timezone: null });

  // Resolve partner auth user id
  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const partnerUser = (usersData?.users ?? []).find(u => u.email === partnerEmail);
  if (!partnerUser) return NextResponse.json({ slots: [], timezone: null });

  // Fetch partner availability
  const { data } = await db
    .from('user_availability')
    .select('day_of_week, start_minute, timezone')
    .eq('user_id', partnerUser.id)
    .order('day_of_week', { ascending: true })
    .order('start_minute', { ascending: true });

  const slots = (data ?? []).map(r => ({
    day_of_week:  r.day_of_week,
    start_minute: r.start_minute,
  }));
  const timezone = data?.[0]?.timezone ?? null;

  return NextResponse.json({ slots, timezone });
}
