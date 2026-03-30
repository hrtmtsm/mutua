import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { text, sessionId, name } = await request.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await adminClient.from('feedback').insert({
    text:       text.trim(),
    session_id: sessionId || null,
    name:       name || null,
  });

  if (error) {
    // Table may not exist yet — fail silently so UX isn't broken
    console.error('feedback insert error:', error.message);
  }

  return NextResponse.json({ success: true });
}
