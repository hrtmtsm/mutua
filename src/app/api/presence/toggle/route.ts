import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { isAvailable } = await request.json();
  if (typeof isAvailable !== 'boolean') {
    return NextResponse.json({ error: 'isAvailable (boolean) required' }, { status: 400 });
  }

  // Never trust client-supplied language/country — read from the user's own profile.
  const { data: profile } = await auth.db
    .from('profiles')
    .select('native_language, learning_language, country_code')
    .eq('email', auth.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await auth.db.from('call_presence').upsert({
    user_id:           auth.userId,
    email:               auth.email,
    is_available:       isAvailable,
    native_language:    profile?.native_language ?? null,
    learning_language:  profile?.learning_language ?? null,
    country_code:       profile?.country_code ?? null,
    updated_at:          new Date().toISOString(),
    last_heartbeat_at:   new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
