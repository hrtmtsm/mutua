/**
 * POST /api/admin/send-invites
 * Body: { secret: string, dryRun?: boolean }
 *
 * Sends "your partner is waiting" emails to both parties in every
 * pending_both match that hasn't been emailed yet.
 * Marks email_sent_at = now() on success so re-runs never double-send.
 *
 * dryRun: true  → logs what would be sent without actually emailing
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';
const resend       = new Resend(process.env.RESEND_API_KEY);

interface Match {
  id:                string;
  email_a:           string;
  email_b:           string;
  native_language_a: string;
  native_language_b: string;
  name_a:            string | null;
  name_b:            string | null;
}

function emailHtml(ctaUrl: string, recipientName: string | null, nativeLanguage: string, targetLanguage: string): string {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#1a6fb5;padding:40px 40px 32px;">
              <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Mutua</p>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your language exchange community</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#666666;">${greeting}</p>
              <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
                Your language partner<br/>is waiting for you.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#666666;line-height:1.6;">
                Someone who speaks <strong style="color:#111;">${nativeLanguage}</strong> natively and wants to practice <strong style="color:#111;">${targetLanguage}</strong> — just like you — is ready to connect on Mutua.
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#666666;line-height:1.6;">
                Click below to set up your profile and meet them.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                    <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Meet your partner →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
                You're receiving this because you signed up for Mutua.<br/>
                <a href="https://trymutua.com" style="color:#aaaaaa;">trymutua.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
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

  const dryRun = body.dryRun === true;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Fetch all pending matches that haven't been emailed yet
  const { data: matches, error } = await admin
    .from('matches')
    .select('id, email_a, email_b, native_language_a, native_language_b, name_a, name_b')
    .eq('scheduling_state', 'pending_both')
    .is('email_sent_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (matches ?? []) as Match[];

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldEmail: rows.flatMap(m => [m.email_a, m.email_b]),
      matchCount: rows.length,
    });
  }

  const sent:   { matchId: string; emailA: string; emailB: string }[] = [];
  const failed: { matchId: string; email: string; error: string }[]   = [];

  for (const match of rows) {
    // Generate magic links for both parties
    const [linkA, linkB] = await Promise.all([
      getMagicLink(admin, match.email_a),
      getMagicLink(admin, match.email_b),
    ]);

    // Send both emails, track individually
    const [resA, resB] = await Promise.allSettled([
      resend.emails.send({
        from:    'Mutua <hello@trymutua.com>',
        to:      match.email_a,
        subject: 'Your language partner is here',
        html:    emailHtml(linkA, match.name_a, match.native_language_a, match.native_language_b),
      }),
      resend.emails.send({
        from:    'Mutua <hello@trymutua.com>',
        to:      match.email_b,
        subject: 'Your language partner is here',
        html:    emailHtml(linkB, match.name_b, match.native_language_b, match.native_language_a),
      }),
    ]);

    const errA = resA.status === 'rejected' ? String(resA.reason) : (resA.value.error?.message ?? null);
    const errB = resB.status === 'rejected' ? String(resB.reason) : (resB.value.error?.message ?? null);

    if (errA) failed.push({ matchId: match.id, email: match.email_a, error: errA });
    if (errB) failed.push({ matchId: match.id, email: match.email_b, error: errB });

    // Mark as sent if at least one email went through (re-run will retry the failed one)
    if (!errA || !errB) {
      await admin.from('matches').update({ email_sent_at: new Date().toISOString() }).eq('id', match.id);
      sent.push({ matchId: match.id, emailA: match.email_a, emailB: match.email_b });
    }
  }

  return NextResponse.json({
    summary: {
      matchesProcessed: rows.length,
      emailsSent:       sent.length * 2 - failed.length,
      failures:         failed.length,
    },
    sent,
    failed,
  });
}
