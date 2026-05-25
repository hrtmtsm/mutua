/**
 * POST /api/admin/reset-past-sessions
 * Body: { secret: string, dryRun?: boolean }
 *
 * For every match where scheduled_at has passed:
 *   1. Deletes expired session_slots for both users on that match
 *   2. Resets scheduling_state → 'pending' and clears scheduled_at
 *   3. Emails both users asking them to resubmit their availability
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com').replace(/\/$/, '');
const resend       = new Resend(process.env.RESEND_API_KEY);
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getMagicLink(db: ReturnType<typeof adminClient>, email: string): Promise<string> {
  try {
    const { data } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
    return data?.properties?.action_link ?? `${APP_URL}/auth/send`;
  } catch {
    return `${APP_URL}/auth/send`;
  }
}

function emailHtml(name: string, partnerName: string, ctaUrl: string): string {
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
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your language exchange community</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#666666;">${name ? `Hi ${name},` : 'Hi there,'}</p>
            <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
              Ready to book your next session with ${partnerName}?
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#666666;line-height:1.6;">
              Your last session has passed. Set your availability for this week and we'll lock in your next one.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                    Set availability →
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
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = body.dryRun === true;
  const db     = adminClient();
  const now    = new Date().toISOString();

  // Find all matches where the scheduled session is in the past
  const { data: matches, error } = await db
    .from('matches')
    .select('id, email_a, email_b, name_a, name_b, session_id_a, session_id_b')
    .eq('scheduling_state', 'scheduled')
    .lt('scheduled_at', now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!matches?.length) return NextResponse.json({ ok: true, reset: 0 });

  if (dryRun) {
    return NextResponse.json({ dryRun: true, wouldReset: matches.map(m => m.id) });
  }

  const results: { matchId: string; ok: boolean; error?: string }[] = [];

  for (const match of matches) {
    try {
      // 1. Reset the match state
      await db.from('matches').update({
        scheduling_state:    'pending',
        scheduled_at:        null,
        availability_a_set_at: null,
        availability_b_set_at: null,
      }).eq('id', match.id);

      // 2. Delete expired slots for this match
      await db.from('session_slots').delete().eq('match_id', match.id);

      // 3. Email both users (fire-and-forget if emails disabled)
      if (EMAILS_ENABLED) {
        const scheduleUrlA = `${APP_URL}/set-availability?matchId=${match.id}`;
        const scheduleUrlB = `${APP_URL}/set-availability?matchId=${match.id}`;

        const [linkA, linkB] = await Promise.all([
          getMagicLink(db, match.email_a),
          getMagicLink(db, match.email_b),
        ]);

        // Magic links redirect to /auth/callback — append the scheduling URL via redirectTo
        const ctaA = linkA !== `${APP_URL}/auth/send` ? linkA.replace(
          encodeURIComponent(`${APP_URL}/auth/callback`),
          encodeURIComponent(scheduleUrlA),
        ) : scheduleUrlA;
        const ctaB = linkB !== `${APP_URL}/auth/send` ? linkB.replace(
          encodeURIComponent(`${APP_URL}/auth/callback`),
          encodeURIComponent(scheduleUrlB),
        ) : scheduleUrlB;

        await Promise.allSettled([
          resend.emails.send({
            from:    'Mutua <hello@trymutua.com>',
            to:      match.email_a,
            subject: `Book your next session with ${match.name_b ?? match.email_b.split('@')[0]}`,
            html:    emailHtml(match.name_a ?? '', match.name_b ?? match.email_b.split('@')[0], ctaA),
          }),
          resend.emails.send({
            from:    'Mutua <hello@trymutua.com>',
            to:      match.email_b,
            subject: `Book your next session with ${match.name_a ?? match.email_a.split('@')[0]}`,
            html:    emailHtml(match.name_b ?? '', match.name_a ?? match.email_a.split('@')[0], ctaB),
          }),
        ]);
      }

      results.push({ matchId: match.id, ok: true });
    } catch (e) {
      results.push({ matchId: match.id, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ ok: true, reset: results.filter(r => r.ok).length, results });
}
