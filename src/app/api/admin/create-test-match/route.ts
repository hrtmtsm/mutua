import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';

async function ensureProfile(admin: any, email: string, nativeLang: string, learningLang: string) {
  const { data: existing } = await admin.from('profiles').select('*').eq('email', email).maybeSingle();
  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  const { data: created, error } = await admin.from('profiles').insert({
    session_id:          sessionId,
    email,
    native_language:     nativeLang,
    learning_language:   learningLang,
    goal:                'Casual conversation',
    comm_style:          'Video call',
    practice_frequency:  'Once a week',
  }).select('*').single();

  if (error) throw new Error(`Profile insert failed for ${email}: ${error.message} (code: ${error.code})`);
  return created;
}

export async function POST(request: Request) {
  const { emailA, emailB, secret, minutesFromNow = 5 } = await request.json();

  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!emailA || !emailB) {
    return NextResponse.json({ error: 'emailA and emailB required' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Create both profiles if they don't exist (A=English native, B=Japanese native)
  let profileA: any, profileB: any;
  try {
    profileA = await ensureProfile(admin, emailA, 'English', 'Japanese');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  try {
    profileB = await ensureProfile(admin, emailB, 'Japanese', 'English');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const scheduledAt = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

  // Upsert match between the two
  const { data: match, error } = await admin
    .from('matches')
    .upsert({
      session_id_a:       profileA.session_id,
      session_id_b:       profileB.session_id,
      name_a:             profileA.name ?? emailA.split('@')[0],
      name_b:             profileB.name ?? emailB.split('@')[0],
      email_a:            profileA.email,
      email_b:            profileB.email,
      native_language_a:  profileA.native_language,
      native_language_b:  profileB.native_language,
      goal:               'Casual conversation',
      comm_style:         'Video call',
      practice_frequency: 'Once a week',
      scheduling_state:   'scheduled',
      scheduled_at:       scheduledAt,
      score:              100,
      reasons:            ['Test match'],
    }, { onConflict: 'session_id_a,session_id_b' })
    .select('id, scheduled_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    scheduledAt,
    restoreLinkA: `${appUrl}/auth/restore?sid=${profileA.session_id}`,
    restoreLinkB: `${appUrl}/auth/restore?sid=${profileB.session_id}`,
    matchId: match.id,
  });
}
