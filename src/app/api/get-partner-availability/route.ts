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

  const partnerTimezone = data?.[0]?.timezone ?? null;

  // Get the viewer's timezone so we can convert partner slots into the viewer's local time.
  // Without this, the picker compares raw start_minute values across different timezones
  // and shows false green "overlap" (e.g. Taipei 19:30 ≠ Nairobi 19:30 in UTC).
  const { data: myAvail } = await db
    .from('user_availability')
    .select('timezone')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  const viewerTimezone = myAvail?.timezone ?? null;

  let slots: { day_of_week: number; start_minute: number }[];

  if (partnerTimezone && viewerTimezone && partnerTimezone !== viewerTimezone) {
    // Convert partner slots from their timezone → UTC → viewer's timezone
    const ref = new Date();

    const getOffsetMinutes = (tz: string): number => {
      try {
        const utcStr   = ref.toLocaleString('en-US', { timeZone: 'UTC',   hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const localStr = ref.toLocaleString('en-US', { timeZone: tz,      hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        return (new Date(localStr).getTime() - new Date(utcStr).getTime()) / 60000;
      } catch { return 0; }
    };

    const partnerOffset = getOffsetMinutes(partnerTimezone);
    const viewerOffset  = getOffsetMinutes(viewerTimezone);

    slots = (data ?? []).map(r => {
      const utcMinute    = r.start_minute - partnerOffset;
      const viewerMinute = utcMinute      + viewerOffset;

      let finalMinute = viewerMinute;
      let finalDay    = r.day_of_week;

      if (finalMinute < 0)    { finalMinute += 1440; finalDay = (finalDay - 1 + 7) % 7; }
      if (finalMinute >= 1440){ finalMinute -= 1440; finalDay = (finalDay + 1) % 7; }

      return { day_of_week: finalDay, start_minute: finalMinute };
    });
  } else {
    slots = (data ?? []).map(r => ({
      day_of_week:  r.day_of_week,
      start_minute: r.start_minute,
    }));
  }

  return NextResponse.json({ slots, timezone: partnerTimezone });
}
