/**
 * POST /api/save-profile
 * Upserts a user profile using the service role key so it always has
 * permission to update existing stub profiles created by run-matching.
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
  const profile = await req.json();
  if (!profile?.session_id) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const { error } = await admin()
    .from('profiles')
    .upsert(profile, { onConflict: 'session_id' });

  if (error) {
    console.error('save-profile error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
