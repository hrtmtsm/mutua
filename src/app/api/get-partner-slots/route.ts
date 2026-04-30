import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const token     = req.headers.get('authorization')?.replace('Bearer ', '');
  const matchId   = req.nextUrl.searchParams.get('matchId');
  const sessionId = req.nextUrl.searchParams.get('sessionId'); // fallback for non-auth users

  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  if (!token && !sessionId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: match } = await db
    .from('matches')
    .select('email_a, email_b, session_id_a, session_id_b')
    .eq('id', matchId)
    .single();
  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 });

  let partnerEmail: string;

  if (token) {
    // Auth token path
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (match.email_a !== user.email && match.email_b !== user.email) {
      return NextResponse.json({ error: 'not your match' }, { status: 403 });
    }
    partnerEmail = match.email_a === user.email ? match.email_b : match.email_a;
  } else {
    // session_id fallback path
    if (match.session_id_a !== sessionId && match.session_id_b !== sessionId) {
      return NextResponse.json({ error: 'not your match' }, { status: 403 });
    }
    partnerEmail = match.session_id_a === sessionId ? match.email_b : match.email_a;
  }

  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const partner = (usersData?.users ?? []).find(u => u.email === partnerEmail);
  if (!partner) return NextResponse.json({ slots: [] });

  const { data: slots } = await db
    .from('session_slots')
    .select('starts_at')
    .eq('user_id', partner.id)
    .eq('match_id', matchId)
    .order('starts_at', { ascending: true });

  return NextResponse.json({ slots: (slots ?? []).map(s => ({ startsAt: s.starts_at })) });
}
