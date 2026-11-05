import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const token     = req.headers.get('authorization')?.replace('Bearer ', '');
  const matchId   = req.nextUrl.searchParams.get('matchId');
  const sessionId = req.nextUrl.searchParams.get('sessionId'); // fallback for non-auth users

  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (match.email_a !== user.email && match.email_b !== user.email) {
      return NextResponse.json({ error: 'not your match' }, { status: 403 });
    }
    partnerEmail = match.email_a === user.email ? match.email_b : match.email_a;
  } else {
    if (match.session_id_a !== sessionId && match.session_id_b !== sessionId) {
      return NextResponse.json({ error: 'not your match' }, { status: 403 });
    }
    partnerEmail = match.session_id_a === sessionId ? match.email_b : match.email_a;
  }

  // Fast email → auth UUID lookup via GoTrue admin REST (avoids loading all users)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const searchRes   = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(partnerEmail)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const searchData  = await searchRes.json().catch(() => ({}));
  const partner     = (searchData.users ?? []).find((u: { email: string }) => u.email === partnerEmail);
  if (!partner) return NextResponse.json({ slots: [], projected: false });

  // Fetch all partner slots for this match (past + future)
  const { data: allSlots } = await db
    .from('session_slots')
    .select('starts_at')
    .eq('user_id', partner.id)
    .eq('match_id', matchId)
    .order('starts_at', { ascending: true });

  const now = new Date();
  const futureSlots = (allSlots ?? []).filter(s => new Date(s.starts_at) > now);

  // If partner has future slots, return them directly
  if (futureSlots.length > 0) {
    return NextResponse.json({
      slots: futureSlots.map(s => ({ startsAt: s.starts_at })),
      projected: false,
    });
  }

  // No future slots — partner hasn't submitted for this match yet
  return NextResponse.json({ slots: [], projected: false });
}
