/**
 * POST /api/admin/send-session-reminders
 * Body: { secret: string, dryRun?: boolean, hoursAhead?: number }
 *
 * Sends "your session is coming up" reminder emails to both parties in
 * every confirmed session starting within `hoursAhead` hours (default 24).
 * Marks reminder_sent_at = now() so re-runs never double-send.
 *
 * Requires: confirmed_sessions.reminder_sent_at column (timestamptz, nullable)
 * Add it in Supabase: ALTER TABLE confirmed_sessions ADD COLUMN reminder_sent_at timestamptz;
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';
const resend       = new Resend(process.env.RESEND_API_KEY);

interface SessionRow {
  id:         string;
  match_id:   string;
  starts_at:  string;
  ends_at:    string;
  matches: {
    email_a:           string;
    email_b:           string;
    name_a:            string | null;
    name_b:            string | null;
    native_language_a: string;
    native_language_b: string;
    session_id_a:      string;
    session_id_b:      string;
  };
}

function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    hour:    'numeric',
    minute:  '2-digit',
    timeZoneName: 'short',
    timeZone: 'UTC',
  });
}

function emailHtml(
  greeting:       string,
  partnerName:    string,
  scheduledTime:  string,
  nativeLang:     string,
  targetLang:     string,
  ctaUrl:         string,
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#1a6fb5 url(https://trymutua.com/sky.jpg) center/cover no-repeat;padding:40px 40px 32px;">
            <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;text-shadow:0 1px 4px rgba(0,0,0,0.3);">Mutua</p>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);text-shadow:0 1px 3px rgba(0,0,0,0.2);">Your language exchange community</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#666666;">${greeting}</p>
            <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
              Your session with ${partnerName}<br/>is coming up 🔥
            </p>
            <p style="margin:0 0 8px;font-size:15px;color:#666666;line-height:1.6;">
              Your <strong style="color:#111;">${nativeLang} ↔ ${targetLang}</strong> exchange is scheduled for:
            </p>
            <p style="margin:0 0 24px;font-size:20px;font-weight:800;color:#111111;">
              ${scheduledTime}
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#666666;line-height:1.6;">
              Click below when you're ready to join.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                    Join session →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
              You're receiving this because you have a session scheduled on Mutua.<br/>
              <a href="https://trymutua.com" style="color:#aaaaaa;">trymutua.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMagicLink(admin: any, email: string): Promise<string> {
  const { data } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });
  return data?.properties?.action_link ?? `${APP_URL}/auth/send`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun     = body.dryRun === true;
  const hoursAhead = typeof body.hoursAhead === 'number' ? body.hoursAhead : 24;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const now      = new Date();
  const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const { data: sessions, error } = await admin
    .from('confirmed_sessions')
    .select(`
      id, match_id, starts_at, ends_at,
      matches ( email_a, email_b, name_a, name_b, native_language_a, native_language_b, session_id_a, session_id_b )
    `)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .is('reminder_sent_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sessions ?? []) as unknown as SessionRow[];

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldEmail: rows.flatMap(s => [s.matches.email_a, s.matches.email_b]),
      sessionCount: rows.length,
      window: `now → +${hoursAhead}h`,
    });
  }

  const sent:   { sessionId: string; emailA: string; emailB: string }[] = [];
  const failed: { sessionId: string; email: string; error: string }[]   = [];

  for (const session of rows) {
    const m             = session.matches;
    const scheduledTime = formatSessionTime(session.starts_at);

    const [linkA, linkB] = await Promise.all([
      getMagicLink(admin, m.email_a),
      getMagicLink(admin, m.email_b),
    ]);

    const [resA, resB] = await Promise.allSettled([
      resend.emails.send({
        from:    'Mutua <hello@trymutua.com>',
        to:      m.email_a,
        subject: `Your session with ${m.name_b ?? m.email_b.split('@')[0]} is coming up 🔥`,
        html:    emailHtml(
          m.name_a ? `Hi ${m.name_a},` : 'Hi there,',
          m.name_b ?? m.email_b.split('@')[0],
          scheduledTime,
          m.native_language_a,
          m.native_language_b,
          linkA,
        ),
      }),
      resend.emails.send({
        from:    'Mutua <hello@trymutua.com>',
        to:      m.email_b,
        subject: `Your session with ${m.name_a ?? m.email_a.split('@')[0]} is coming up 🔥`,
        html:    emailHtml(
          m.name_b ? `Hi ${m.name_b},` : 'Hi there,',
          m.name_a ?? m.email_a.split('@')[0],
          scheduledTime,
          m.native_language_b,
          m.native_language_a,
          linkB,
        ),
      }),
    ]);

    const errA = resA.status === 'rejected' ? String(resA.reason) : (resA.value.error?.message ?? null);
    const errB = resB.status === 'rejected' ? String(resB.reason) : (resB.value.error?.message ?? null);

    if (errA) failed.push({ sessionId: session.id, email: m.email_a, error: errA });
    if (errB) failed.push({ sessionId: session.id, email: m.email_b, error: errB });

    if (!errA || !errB) {
      await admin
        .from('confirmed_sessions')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', session.id);
      sent.push({ sessionId: session.id, emailA: m.email_a, emailB: m.email_b });
    }
  }

  return NextResponse.json({
    summary: {
      sessionsProcessed: rows.length,
      emailsSent:        sent.length * 2 - failed.length,
      failures:          failed.length,
    },
    sent,
    failed,
  });
}
