import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';
import { AVATAR_OPTIONS } from '@/lib/glyphAvatars';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sessionId !== 'string' || !AVATAR_OPTIONS.includes(body.avatarUrl)) {
    return NextResponse.json({ error: 'Choose a valid icon.' }, { status: 400 });
  }
  const { data, error } = await auth.db.from('profiles')
    .update({ avatar_url: body.avatarUrl })
    .eq('session_id', body.sessionId).eq('email', auth.email)
    .select('avatar_url').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not save icon.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Profile not found.' }, { status: 403 });
  return NextResponse.json({ url: data.avatar_url });
}
