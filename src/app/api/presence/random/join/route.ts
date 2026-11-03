import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Language pair always comes from the caller's own saved profile — never
  // trust a client-supplied language for matching.
  const { data: profile } = await auth.db
    .from('profiles')
    .select('native_language, learning_language')
    .eq('email', auth.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!profile?.native_language || !profile?.learning_language) {
    return NextResponse.json({ error: 'language_pair_not_set' }, { status: 400 });
  }

  const { data: sessionId, error } = await auth.rpcDb.rpc('join_random_queue', {
    p_native:   profile.native_language,
    p_learning: profile.learning_language,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // sessionId is null while still waiting — the client polls/subscribes for a match.
  return NextResponse.json({ sessionId: sessionId ?? null });
}
