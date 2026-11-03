import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/presenceAuth';

// Public, read-only. No Bearer token required — this is the data behind the
// home-screen globe, visible before signup. Returns ONLY fields that are
// safe to show to an anonymous visitor: never email, never any other
// auth.users field, never bio/interests (those are gated to GET
// /api/presence/profile/[userId] for authenticated callers only).
const FRESHNESS_SECONDS = 30;

export async function GET() {
  const db = adminClient();
  const since = new Date(Date.now() - FRESHNESS_SECONDS * 1000).toISOString();

  const { data: presence, error } = await db
    .from('call_presence')
    .select('user_id, email, native_language, learning_language, country_code')
    .eq('is_available', true)
    .gt('last_heartbeat_at', since);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!presence || presence.length === 0) return NextResponse.json({ users: [] });

  const emails = [...new Set(presence.map(p => p.email))];
  const { data: profiles } = await db
    .from('profiles')
    .select('email, name, avatar_url')
    .in('email', emails);

  const byEmail = new Map((profiles ?? []).map(p => [p.email, p]));

  const users = presence.map(p => {
    const profile = byEmail.get(p.email);
    return {
      userId:            p.user_id,
      name:               profile?.name ?? null,
      avatarUrl:          profile?.avatar_url ?? null,
      countryCode:        p.country_code,
      nativeLanguage:     p.native_language,
      learningLanguage:   p.learning_language,
    };
  });

  return NextResponse.json({ users });
}
