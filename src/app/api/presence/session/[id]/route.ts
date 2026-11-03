import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  // Queried via the user-scoped client — RLS (auth.uid() = user_a_id or
  // user_b_id) is the real gate here, not just this route's own logic.
  const { data: session, error } = await auth.rpcDb
    .from('instant_sessions')
    .select('id, user_a_id, user_b_id, is_ai, status')
    .eq('id', id)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: 'not_found_or_not_a_participant' }, { status: 404 });
  }

  if (session.is_ai || !session.user_b_id) {
    return NextResponse.json({ sessionId: session.id, status: session.status, isAi: true, partner: null });
  }

  const partnerId = session.user_a_id === auth.userId ? session.user_b_id : session.user_a_id;

  const { data: presence } = await auth.db
    .from('call_presence')
    .select('email, country_code, native_language, learning_language')
    .eq('user_id', partnerId)
    .maybeSingle();

  let partner = null;
  if (presence) {
    const { data: profile } = await auth.db
      .from('profiles')
      .select('name, avatar_url, bio, interests')
      .eq('email', presence.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    partner = {
      userId:            partnerId,
      name:               profile?.name ?? null,
      avatarUrl:          profile?.avatar_url ?? null,
      bio:                profile?.bio ?? null,
      interests:          profile?.interests ?? null,
      countryCode:        presence.country_code,
      nativeLanguage:     presence.native_language,
      learningLanguage:   presence.learning_language,
    };
  }

  return NextResponse.json({ sessionId: session.id, status: session.status, isAi: false, partner });
}
