import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify the user token
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { note } = await req.json().catch(() => ({ note: '' }));

  // Find profile by auth user id
  const { data: profile } = await admin
    .from('profiles')
    .select('session_id, banned_until, ban_claimed_at')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.ban_claimed_at) return NextResponse.json({ error: 'Already claimed' }, { status: 409 });

  const { error } = await admin
    .from('profiles')
    .update({ ban_claimed_at: new Date().toISOString() })
    .eq('session_id', profile.session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log the claim note (optional — you could email yourself here)
  console.log(`[claim-ban] user=${user.email} session=${profile.session_id} note="${note}"`);

  return NextResponse.json({ ok: true });
}
