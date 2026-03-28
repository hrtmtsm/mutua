import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';

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

  // Look up both profiles by email
  const [{ data: profileA }, { data: profileB }] = await Promise.all([
    admin.from('profiles').select('*').eq('email', emailA).maybeSingle(),
    admin.from('profiles').select('*').eq('email', emailB).maybeSingle(),
  ]);

  if (!profileA) return NextResponse.json({ error: `No profile found for ${emailA}` }, { status: 404 });
  if (!profileB) return NextResponse.json({ error: `No profile found for ${emailB}` }, { status: 404 });

  const scheduledAt = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

  // Upsert match between the two
  const { data: match, error } = await admin
    .from('matches')
    .upsert({
      session_id_a:       profileA.session_id,
      session_id_b:       profileB.session_id,
      name_a:             profileA.name ?? emailA,
      name_b:             profileB.name ?? emailB,
      email_a:            profileA.email,
      email_b:            profileB.email,
      native_language_a:  profileA.native_language,
      native_language_b:  profileB.native_language,
      goal:               profileA.goal,
      comm_style:         profileA.comm_style,
      practice_frequency: profileA.practice_frequency,
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
