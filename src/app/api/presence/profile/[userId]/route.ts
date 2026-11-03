import { NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/presenceAuth';

// Public read (no Bearer required) for the globe's tap-to-view profile card,
// but the FIELD SET is explicitly gated by whether the caller is
// authenticated — bio/interests are never sent to an anonymous visitor.
// Never returns email or any other auth.users field, authenticated or not.
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { db, userId: viewerId } = await optionalAuth(request);

  const { data: presence } = await db
    .from('call_presence')
    .select('user_id, email, native_language, learning_language, country_code, is_available')
    .eq('user_id', userId)
    .maybeSingle();

  if (!presence || !presence.is_available) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const fields = viewerId
    ? 'name, avatar_url, bio, interests'
    : 'name, avatar_url';

  const { data: profile } = await db
    .from('profiles')
    .select(fields)
    .eq('email', presence.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ name: string | null; avatar_url: string | null; bio?: string | null; interests?: string | null }>();

  return NextResponse.json({
    userId:            presence.user_id,
    name:               profile?.name ?? null,
    avatarUrl:          profile?.avatar_url ?? null,
    countryCode:        presence.country_code,
    nativeLanguage:     presence.native_language,
    learningLanguage:   presence.learning_language,
    bio:                viewerId ? (profile?.bio ?? null) : undefined,
    interests:          viewerId ? (profile?.interests ?? null) : undefined,
  });
}
