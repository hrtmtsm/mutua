/**
 * POST /api/admin/send-nudges
 * Body: { secret: string, state?: 'no_overlap' | 'pending_ab' | 'pending_both', dryRun?: boolean }
 *
 * Sends nudge emails to matched users who haven't scheduled yet.
 *
 *   no_overlap   → both parties: "No shared window found — update your times"
 *   pending_ab   → the person who hasn't set times: "[Partner] wants to practice with you 🔥"
 *   pending_both → both parties: "You've been matched — set your schedule"
 *
 * Skips matches nudged within the last 3 days (last_nudge_at).
 * Requires: ALTER TABLE matches ADD COLUMN last_nudge_at timestamptz;
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const ADMIN_SECRET   = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';
const resend         = new Resend(process.env.RESEND_API_KEY);
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';
const NUDGE_COOLDOWN_DAYS = 3;

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

function baseEmail(header: string, body: string, ctaText: string, ctaUrl: string, footer: string): string {
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
            ${header}
            ${body}
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                    ${ctaText}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
              ${footer}<br/>
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

function noOverlapEmail(greeting: string, partnerName: string, langs: string, ctaUrl: string): string {
  return baseEmail(
    `<p style="margin:0 0 8px;font-size:15px;color:#666666;">${greeting}</p>
     <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
       No shared window found yet 🗓️
     </p>`,
    `<p style="margin:0 0 24px;font-size:15px;color:#666666;line-height:1.6;">
       You and ${partnerName} are matched for a <strong style="color:#111;">${langs}</strong> exchange, but we couldn't find a time that works for both of you. Update your availability and we'll automatically re-check.
     </p>`,
    'Update my schedule →',
    ctaUrl,
    "You're receiving this because you have a match waiting on Mutua.",
  );
}

function pendingAbEmail(greeting: string, partnerName: string, langs: string, ctaUrl: string): string {
  return baseEmail(
    `<p style="margin:0 0 8px;font-size:15px;color:#666666;">${greeting}</p>
     <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
       ${partnerName} wants to<br/>practice with you 🔥
     </p>`,
    `<p style="margin:0 0 24px;font-size:15px;color:#666666;line-height:1.6;">
       They've already set their schedule for your <strong style="color:#111;">${langs}</strong> exchange. Set yours so we can find a time that works for both of you.
     </p>`,
    'Set my schedule →',
    ctaUrl,
    "You're receiving this because you have a match waiting on Mutua.",
  );
}

function pendingBothEmail(greeting: string, partnerName: string, langs: string, ctaUrl: string): string {
  return baseEmail(
    `<p style="margin:0 0 8px;font-size:15px;color:#666666;">${greeting}</p>
     <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
       You've been matched with ${partnerName} ✨
     </p>`,
    `<p style="margin:0 0 24px;font-size:15px;color:#666666;line-height:1.6;">
       You're paired for a <strong style="color:#111;">${langs}</strong> exchange. Set your weekly availability so we can find a time that works for both of you — it only takes a minute.
     </p>`,
    'Set my schedule →',
    ctaUrl,
    "You're receiving this because you were matched on Mutua.",
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body.secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun     = body.dryRun === true;
  const stateFilter: string | undefined = body.state; // 'no_overlap' | 'pending_ab' | 'pending_both'

  const db = adminClient();

  // Cooldown: skip matches nudged within the last N days
  const cooldownCutoff = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const statesToQuery: string[] = stateFilter === 'no_overlap'
    ? ['no_overlap']
    : stateFilter === 'pending_ab'
    ? ['pending_a', 'pending_b']
    : stateFilter === 'pending_both'
    ? ['pending_both']
    : ['no_overlap', 'pending_a', 'pending_b', 'pending_both'];

  const { data: matches, error } = await db
    .from('matches')
    .select('id, scheduling_state, email_a, email_b, name_a, name_b, native_language_a, native_language_b')
    .in('scheduling_state', statesToQuery)
    .or(`last_nudge_at.is.null,last_nudge_at.lt.${cooldownCutoff}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = matches ?? [];

  if (dryRun) {
    const preview = rows.map(m => ({
      matchId: m.id,
      state:   m.scheduling_state,
      emails:  m.scheduling_state === 'pending_a'
        ? [m.email_b]
        : m.scheduling_state === 'pending_b'
        ? [m.email_a]
        : [m.email_a, m.email_b],
    }));
    return NextResponse.json({ dryRun: true, matchCount: rows.length, preview });
  }

  if (!EMAILS_ENABLED) {
    return NextResponse.json({ error: 'SEND_MATCH_EMAILS is not enabled' }, { status: 403 });
  }

  const sent:   { matchId: string; emails: string[] }[] = [];
  const failed: { matchId: string; email: string; error: string }[] = [];

  for (const m of rows) {
    const nameA  = m.name_a  ?? m.email_a?.split('@')[0] ?? 'your partner';
    const nameB  = m.name_b  ?? m.email_b?.split('@')[0] ?? 'your partner';
    const langs  = `${m.native_language_a} ↔ ${m.native_language_b}`;
    const state  = m.scheduling_state as string;

    // Determine who to email and with what copy
    type Recipient = { email: string; greeting: string; html: string; subject: string };
    const recipients: Recipient[] = [];

    if (state === 'no_overlap') {
      const [linkA, linkB] = await Promise.all([
        getMagicLink(db, m.email_a),
        getMagicLink(db, m.email_b),
      ]);
      recipients.push({
        email:    m.email_a,
        greeting: m.name_a ? `Hi ${m.name_a},` : 'Hi there,',
        subject:  `Update your times — no shared window found yet`,
        html:     noOverlapEmail(m.name_a ? `Hi ${m.name_a},` : 'Hi there,', nameB, langs, linkA),
      });
      recipients.push({
        email:    m.email_b,
        greeting: m.name_b ? `Hi ${m.name_b},` : 'Hi there,',
        subject:  `Update your times — no shared window found yet`,
        html:     noOverlapEmail(m.name_b ? `Hi ${m.name_b},` : 'Hi there,', nameA, langs, linkB),
      });
    } else if (state === 'pending_a') {
      // A set their times, B hasn't
      const link = await getMagicLink(db, m.email_b);
      recipients.push({
        email:    m.email_b,
        greeting: m.name_b ? `Hi ${m.name_b},` : 'Hi there,',
        subject:  `${nameA} wants to practice with you 🗓️ Set your schedule`,
        html:     pendingAbEmail(m.name_b ? `Hi ${m.name_b},` : 'Hi there,', nameA, langs, link),
      });
    } else if (state === 'pending_b') {
      // B set their times, A hasn't
      const link = await getMagicLink(db, m.email_a);
      recipients.push({
        email:    m.email_a,
        greeting: m.name_a ? `Hi ${m.name_a},` : 'Hi there,',
        subject:  `${nameB} wants to practice with you 🗓️ Set your schedule`,
        html:     pendingAbEmail(m.name_a ? `Hi ${m.name_a},` : 'Hi there,', nameB, langs, link),
      });
    } else if (state === 'pending_both') {
      const [linkA, linkB] = await Promise.all([
        getMagicLink(db, m.email_a),
        getMagicLink(db, m.email_b),
      ]);
      recipients.push({
        email:    m.email_a,
        greeting: m.name_a ? `Hi ${m.name_a},` : 'Hi there,',
        subject:  `You've been matched with ${nameB} — set your schedule`,
        html:     pendingBothEmail(m.name_a ? `Hi ${m.name_a},` : 'Hi there,', nameB, langs, linkA),
      });
      recipients.push({
        email:    m.email_b,
        greeting: m.name_b ? `Hi ${m.name_b},` : 'Hi there,',
        subject:  `You've been matched with ${nameA} — set your schedule`,
        html:     pendingBothEmail(m.name_b ? `Hi ${m.name_b},` : 'Hi there,', nameA, langs, linkB),
      });
    }

    const results = await Promise.allSettled(
      recipients.map(r =>
        resend.emails.send({
          from:    'Mutua <hello@trymutua.com>',
          to:      r.email,
          subject: r.subject,
          html:    r.html,
        })
      )
    );

    const sentEmails: string[] = [];
    results.forEach((res, i) => {
      const email = recipients[i].email;
      if (res.status === 'rejected') {
        failed.push({ matchId: m.id, email, error: String(res.reason) });
      } else if (res.value.error) {
        failed.push({ matchId: m.id, email, error: res.value.error.message });
      } else {
        sentEmails.push(email);
      }
    });

    if (sentEmails.length > 0) {
      sent.push({ matchId: m.id, emails: sentEmails });
      await db.from('matches').update({ last_nudge_at: new Date().toISOString() }).eq('id', m.id);
    }
  }

  return NextResponse.json({
    summary: {
      matchesProcessed: rows.length,
      emailsSent:       sent.reduce((n, s) => n + s.emails.length, 0),
      failures:         failed.length,
    },
    sent,
    failed,
  });
}
