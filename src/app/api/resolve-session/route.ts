/**
 * POST /api/resolve-session
 * Body: { email }
 *
 * If a stub profile already exists for this email (created by admin run-matching),
 * returns its session_id so the user inherits pre-created matches.
 * Otherwise returns a freshly generated UUID.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const db = admin();

  const { data: existing } = await db
    .from('profiles')
    .select('session_id')
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const sessionId = existing?.session_id ?? crypto.randomUUID();
  return NextResponse.json({ sessionId });
}
