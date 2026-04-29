/**
 * POST /api/send-message
 * Body: { matchId, senderId, text }
 * Inserts the message and emails the recipient if they're not the sender.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend       = new Resend(process.env.RESEND_API_KEY);
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com').replace(/\/$/, '');
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';

// Only email if recipient hasn't received a message notification in the last 10 minutes
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  const { matchId, senderId, text } = await request.json().catch(() => ({}));
  if (!matchId || !senderId || !text) {
    return NextResponse.json({ error: 'matchId, senderId, and text required' }, { status: 400 });
  }

  const db = adminClient();

  // Insert the message
  const { error: insertErr } = await db
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, text });
  if (insertErr && insertErr.code !== 'PGRST116') {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  if (!EMAILS_ENABLED) return NextResponse.json({ ok: true });

  // Load match to find recipient
  const { data: match } = await db
    .from('matches')
    .select('email_a, email_b, name_a, name_b, session_id_a, session_id_b, last_message_notify_at')
    .eq('id', matchId)
    .single();
  if (!match) return NextResponse.json({ ok: true });

  // Cooldown — don't spam if they're actively chatting
  if (match.last_message_notify_at) {
    const lastNotify = new Date(match.last_message_notify_at).getTime();
    if (Date.now() - lastNotify < NOTIFY_COOLDOWN_MS) {
      return NextResponse.json({ ok: true, skipped: 'cooldown' });
    }
  }

  // Determine sender/recipient
  const isSenderA    = match.session_id_a === senderId;
  const senderName   = isSenderA ? (match.name_a ?? match.email_a.split('@')[0]) : (match.name_b ?? match.email_b.split('@')[0]);
  const recipientEmail = isSenderA ? match.email_b : match.email_a;

  // Generate magic link for recipient
  let ctaUrl = `${APP_URL}/auth/send`;
  try {
    const { data: linkData } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email: recipientEmail,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
    if (linkData?.properties?.action_link) ctaUrl = linkData.properties.action_link;
  } catch {}

  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#1a6fb5 url(https://trymutua.com/sky.jpg) center/cover no-repeat;padding:40px 40px 32px;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;text-shadow:0 1px 4px rgba(0,0,0,0.3);">Mutua</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your language exchange community</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
              ${senderName} sent you a message
            </p>
            <div style="margin:0 0 24px;background:#f5f4f0;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;font-size:15px;color:#444444;line-height:1.6;font-style:italic;">"${preview}"</p>
            </div>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                    Reply →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
              You're receiving this because you have a match on Mutua.<br/>
              <a href="https://trymutua.com" style="color:#aaaaaa;">trymutua.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const { error: emailErr } = await resend.emails.send({
    from:    'Mutua <hello@trymutua.com>',
    to:      recipientEmail,
    subject: `${senderName} sent you a message on Mutua`,
    html,
  });

  if (!emailErr) {
    await db.from('matches')
      .update({ last_message_notify_at: new Date().toISOString() })
      .eq('id', matchId);
  }

  return NextResponse.json({ ok: true });
}
