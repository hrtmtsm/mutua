import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Simple admin secret — set ADMIN_SECRET in your Vercel env vars
// (or leave blank and it will use 'mutua-dev' as default for testing)
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId     = searchParams.get('sid') ?? '';
  const secret        = searchParams.get('secret') ?? '';
  const minutesFromNow = Number(searchParams.get('m') ?? '15');
  return handle(sessionId, secret, minutesFromNow);
}

export async function POST(request: Request) {
  const { sessionId, secret, minutesFromNow = 5 } = await request.json();

  return handle(sessionId, secret, minutesFromNow);
}

async function handle(sessionId: string, secret: string, minutesFromNow: number) {
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const scheduledAt = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('matches')
    .update({ scheduling_state: 'scheduled', scheduled_at: scheduledAt })
    .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
    .select('id, session_id_a, session_id_b, scheduled_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, match: data, scheduledAt });
}
