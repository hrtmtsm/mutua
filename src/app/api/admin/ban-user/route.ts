import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, reason, durationDays } = await req.json();
  if (!sessionId || !reason || !durationDays) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const bannedUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from('profiles')
    .update({ banned_until: bannedUntil, ban_reason: reason, ban_claimed_at: null })
    .eq('session_id', sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, banned_until: bannedUntil });
}

export async function DELETE(req: NextRequest) {
  // Lift a ban early
  if (req.nextUrl.searchParams.get('secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await req.json();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await admin
    .from('profiles')
    .update({ banned_until: null, ban_reason: null, ban_claimed_at: null })
    .eq('session_id', sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
