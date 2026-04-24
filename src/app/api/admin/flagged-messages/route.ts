import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';

const KEYWORDS = ['instagram', 'insta', 'snapchat', 'whatsapp', 'telegram', 'discord', 'tiktok', 'twitter', 'facebook'];

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch flagged messages (keyword match)
  const orFilter = KEYWORDS.map(k => `text.ilike.%${k}%`).join(',');
  const { data: messages, error } = await admin
    .from('messages')
    .select('id, match_id, sender_id, text, created_at')
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!messages?.length) return NextResponse.json({ messages: [] });

  // Fetch sender profiles
  const senderIds = [...new Set(messages.map(m => m.sender_id))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('session_id, name, email, banned_until, ban_claimed_at')
    .in('session_id', senderIds);

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.session_id, p]));

  const result = messages.map(m => ({
    ...m,
    sender_name:       profileMap[m.sender_id]?.name  ?? 'Unknown',
    sender_email:      profileMap[m.sender_id]?.email ?? '',
    banned_until:      profileMap[m.sender_id]?.banned_until ?? null,
    ban_claimed_at:    profileMap[m.sender_id]?.ban_claimed_at ?? null,
  }));

  return NextResponse.json({ messages: result });
}
