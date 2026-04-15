/**
 * POST /api/rematch
 * Body: { matchId, userId, partnerId }
 *
 * Records the user's intent to rematch. If the partner has also expressed
 * intent for the same match, creates a new pending_both match and returns it.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend  = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

async function sendRematchEmail(toEmail: string, requesterName: string, toName: string, historyUrl: string) {
  await resend.emails.send({
    from:    'Mutua <hello@trymutua.com>',
    to:      toEmail,
    subject: `${requesterName} wants to practice with you again`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#1a6fb5;padding:40px 40px 32px;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;">Mutua</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your language exchange community</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#666666;">Hi ${toName},</p>
            <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
              ${requesterName} wants to practice with you again 🙌
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#666666;line-height:1.6;">
              Head to your history to schedule another session.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;">
                  <a href="${historyUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                    Schedule again →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;">
              <a href="https://trymutua.com" style="color:#aaaaaa;">trymutua.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  const { matchId, userId, partnerId } = await req.json();
  if (!matchId || !userId || !partnerId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  const db = admin();

  // Record this user's intent (ignore duplicate if already exists)
  await db.from('rematch_intents').upsert({ match_id: matchId, user_id: userId }, { onConflict: 'match_id,user_id' });

  // Check if partner also expressed intent
  const { data: partnerIntent } = await db
    .from('rematch_intents')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', partnerId)
    .maybeSingle();

  if (!partnerIntent) {
    // Partner hasn't responded yet — notify them
    const { data: match } = await db
      .from('matches')
      .select('name_a, name_b, email_a, email_b, session_id_a')
      .eq('id', matchId)
      .maybeSingle();

    if (match) {
      const isA = match.session_id_a === userId;
      const requesterName = isA ? match.name_a : match.name_b;
      const partnerEmail  = isA ? match.email_b : match.email_a;
      const partnerName   = isA ? match.name_b  : match.name_a;
      try {
        await sendRematchEmail(partnerEmail, requesterName, partnerName, `${APP_URL}/history`);
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ matched: false });
  }

  // Both expressed intent — fetch original match to get profile info
  const { data: original } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (!original) {
    return NextResponse.json({ error: 'original match not found' }, { status: 404 });
  }

  // Guard: don't create a new match if there's already an active one between these two users
  const { data: existing } = await db
    .from('matches')
    .select('id')
    .or(
      `and(session_id_a.eq.${original.session_id_a},session_id_b.eq.${original.session_id_b}),` +
      `and(session_id_a.eq.${original.session_id_b},session_id_b.eq.${original.session_id_a})`
    )
    .neq('id', matchId)
    .neq('scheduling_state', 'archived')
    .maybeSingle();

  if (existing) {
    // Already have an active match — return it instead of creating a duplicate
    await db.from('rematch_intents').delete().eq('match_id', matchId);
    return NextResponse.json({ matched: true, newMatchId: existing.id });
  }

  // Create new match with same participants
  const { data: newMatch, error } = await db.from('matches').insert({
    session_id_a:       original.session_id_a,
    session_id_b:       original.session_id_b,
    name_a:             original.name_a,
    name_b:             original.name_b,
    email_a:            original.email_a,
    email_b:            original.email_b,
    native_language_a:  original.native_language_a,
    native_language_b:  original.native_language_b,
    goal:               original.goal,
    comm_style:         original.comm_style,
    practice_frequency: original.practice_frequency,
    score:              original.score,
    reasons:            original.reasons,
    scheduling_state:   'pending_both',
  }).select().maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Archive the old match so it no longer appears on the exchanges page
  await db.from('matches').update({ scheduling_state: 'archived' }).eq('id', matchId);

  // Clean up intents so they can rematch again in future
  await db.from('rematch_intents').delete().eq('match_id', matchId);

  return NextResponse.json({ matched: true, newMatchId: newMatch?.id });
}
