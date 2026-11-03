import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  // Verify the caller is authenticated
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { sessionId, name, bio, needsWelcome } = await request.json();
  if (!sessionId || !name?.trim()) {
    return NextResponse.json({ error: 'sessionId and name required' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Confirm the token belongs to the owner of this sessionId
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('email', user.email!)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const trimmed = name.trim();
  // needs_welcome is deliberately NOT included in this update. Combining it
  // with name/bio in one statement means that, until the column is actually
  // migrated in, the WHOLE update fails (unknown column) — silently breaking
  // the pre-existing, working name-save behavior for every /auth/welcome
  // submission. Keep this update exactly as it always was.
  const profileUpdate: Record<string, string> = { name: trimmed };
  if (bio !== undefined) profileUpdate.bio = bio;

  const [{ error: profileError }, ,] = await Promise.all([
    adminClient.from('profiles').update(profileUpdate).eq('session_id', sessionId),
    adminClient.from('matches').update({ name_a: trimmed }).eq('session_id_a', sessionId),
    adminClient.from('matches').update({ name_b: trimmed }).eq('session_id_b', sessionId),
  ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Best-effort, separate from the save above on purpose: clear needs_welcome
  // once the invited user completes setup. If the column doesn't exist yet
  // (migration not applied), this no-ops with a warning — it must never
  // affect the response below, since /auth/callback's own fallback already
  // covers the pre-migration period correctly via the name heuristic.
  if (typeof needsWelcome === 'boolean') {
    const { error: flagError } = await adminClient
      .from('profiles')
      .update({ needs_welcome: needsWelcome })
      .eq('session_id', sessionId);
    if (flagError) {
      console.warn('needs_welcome update skipped (column likely not migrated yet):', flagError.message);
    }
  }

  return NextResponse.json({ success: true });
}
