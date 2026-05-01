/**
 * GET /api/get-confirmed-sessions?sessionId=...
 * Returns the user's future confirmed sessions (across all matches).
 * Used to exclude already-booked slots when pre-populating the template.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const token     = req.headers.get('authorization')?.replace('Bearer ', '');
  const sessionId = req.nextUrl.searchParams.get('sessionId');

  if (!token && !sessionId) return NextResponse.json({ sessions: [] });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let authUserId: string | null = null;

  if (token) {
    const { data: { user } } = await db.auth.getUser(token);
    authUserId = user?.id ?? null;
  }

  if (!authUserId && sessionId) {
    // Look up auth user via profile session_id → email → auth user
    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (profile?.email) {
      const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
      const authUser = (usersData?.users ?? []).find(u => u.email === profile.email);
      authUserId = authUser?.id ?? null;
    }
  }

  if (!authUserId) return NextResponse.json({ sessions: [] });

  const now = new Date().toISOString();
  const { data: sessions } = await db
    .from('confirmed_sessions')
    .select('starts_at, ends_at, match_id')
    .eq('user_id', authUserId)
    .gte('starts_at', now)
    .order('starts_at', { ascending: true });

  return NextResponse.json({
    sessions: (sessions ?? []).map(s => ({
      startsAt: s.starts_at,
      endsAt:   s.ends_at,
      matchId:  s.match_id,
    })),
  });
}
