/**
 * POST /api/set-availability
 * Headers: Authorization: Bearer <supabase_access_token>
 * Body: { slots: Array<{ day_of_week: number; start_minute: number }>, timezone: string }
 *
 * Saves the user's recurring weekly availability, then triggers the scheduler
 * for all their active matches that are waiting on availability.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { runScheduler } from '@/lib/scheduler';

const resend        = new Resend(process.env.RESEND_API_KEY);
const EMAILS_ENABLED = process.env.SEND_MATCH_EMAILS === 'true';
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

function formatInTimezone(isoUtc: string, timeZone: string): string {
  try {
    return new Date(isoUtc).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
      timeZone,
    });
  } catch {
    return new Date(isoUtc).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    });
  }
}

function sessionScheduledEmailHtml(
  recipientName: string | null,
  partnerName: string,
  scheduledTime: string,
  nativeLang: string,
  targetLang: string,
  ctaUrl: string,
): string {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
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
              Your <strong>${nativeLang} ↔ ${targetLang}</strong> session with ${partnerName} is booked 🗓️
            </p>
            <p style="margin:0 0 8px;font-size:15px;color:#666666;line-height:1.6;">
              You're both free at the same time — we locked it in:
            </p>
            <p style="margin:0 0 32px;font-size:20px;font-weight:800;color:#111111;">
              ${scheduledTime}
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                    View session →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
              You're receiving this because you signed up for Mutua.<br/>
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

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { slots, timezone } = body as {
    slots?: Array<{ day_of_week: number; start_minute: number }>;
    timezone?: string;
  };

  if (!slots || !timezone) {
    return NextResponse.json({ error: 'slots and timezone required' }, { status: 400 });
  }

  // Validate slot values to prevent garbage data in DB
  for (const s of slots) {
    if (!Number.isInteger(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6) {
      return NextResponse.json({ error: `invalid day_of_week: ${s.day_of_week}` }, { status: 400 });
    }
    if (!Number.isInteger(s.start_minute) || s.start_minute < 0 || s.start_minute > 1410) {
      return NextResponse.json({ error: `invalid start_minute: ${s.start_minute}` }, { status: 400 });
    }
  }
  try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); } catch {
    return NextResponse.json({ error: `invalid timezone: ${timezone}` }, { status: 400 });
  }

  const db = adminClient();

  // Verify token and get user
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Replace all availability for this user (delete + insert)
  await db.from('user_availability').delete().eq('user_id', user.id);

  if (slots.length > 0) {
    const rows = slots.map(s => ({
      user_id:      user.id,
      day_of_week:  s.day_of_week,
      start_minute: s.start_minute,
      timezone,
      updated_at:   now,
    }));

    const { error: insertErr } = await db.from('user_availability').insert(rows);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  // Find the user's session_id from profiles
  const { data: profile } = await db
    .from('profiles')
    .select('session_id')
    .eq('email', user.email)
    .maybeSingle();

  if (!profile?.session_id) {
    console.warn('[set-availability] no profile found for user', user.email, '— availability saved but matches not triggered');
    return NextResponse.json({ ok: true, matchesTriggered: 0 });
  }

  // Find all active matches waiting on availability (include 'computing' to unstick old matches)
  const { data: matches } = await db
    .from('matches')
    .select('id, scheduling_state, session_id_a, session_id_b, email_a, email_b, name_a, name_b, native_language_a, native_language_b')
    .or(`session_id_a.eq.${profile.session_id},session_id_b.eq.${profile.session_id}`)
    .in('scheduling_state', ['pending_both', 'pending_a', 'pending_b', 'no_overlap', 'computing', 'scheduled']);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, matchesTriggered: 0 });
  }

  // Update availability timestamps; only move to computing when BOTH sides have saved
  const isA = (m: any) => m.session_id_a === profile.session_id;
  const matchesToSchedule: string[] = [];
  const matchDebug: Record<string, unknown> = {};

  for (const m of matches) {
    const iAmA = isA(m);
    const updatePayload: Record<string, unknown> = iAmA
      ? { availability_a_set_at: now }
      : { availability_b_set_at: now };

    // Fetch current timestamps to check if other side already saved
    const { data: current } = await db
      .from('matches')
      .select('availability_a_set_at, availability_b_set_at')
      .eq('id', m.id)
      .single();

    const otherSideReady = iAmA
      ? !!current?.availability_b_set_at
      : !!current?.availability_a_set_at;

    matchDebug[m.id] = {
      branch: otherSideReady ? 'computing' : 'pending',
      state: m.scheduling_state,
      iAmA,
      availability_a_set_at: current?.availability_a_set_at ?? null,
      availability_b_set_at: current?.availability_b_set_at ?? null,
      otherSideReady,
    };

    if (otherSideReady) {
      // Both sides ready — clear any existing confirmed session then re-run scheduler
      // (covers both reschedule from 'scheduled' and orphaned rows from previous attempts)
      await db.from('confirmed_sessions').delete().eq('match_id', m.id);
      Object.assign(updatePayload, { scheduling_state: 'computing', scheduled_at: null });
      matchesToSchedule.push(m.id);
    } else {
      // Only this side ready — move to pending_a or pending_b so partner sees the CTA
      const pendingState = iAmA ? 'pending_b' : 'pending_a';
      Object.assign(updatePayload, { scheduling_state: pendingState });

      // Nudge the partner who hasn't set availability yet.
      // Only fire on the first transition (pending_both → pending_*) to avoid spam.
      if (EMAILS_ENABLED && m.scheduling_state === 'pending_both') {
        const pendingEmail  = iAmA ? m.email_b        : m.email_a;
        const pendingName   = iAmA ? m.name_b         : m.name_a;
        const partnerName   = iAmA ? (m.name_a ?? m.email_a?.split('@')[0]) : (m.name_b ?? m.email_b?.split('@')[0]);
        const pendingNative = iAmA ? m.native_language_b : m.native_language_a;
        const pendingTarget = iAmA ? m.native_language_a : m.native_language_b;

        if (pendingEmail) {
          // Generate magic link for one-click sign-in
          let ctaUrl = `${APP_URL}/auth/send`;
          try {
            const { data: linkData } = await db.auth.admin.generateLink({
              type: 'magiclink',
              email: pendingEmail,
              options: { redirectTo: `${APP_URL}/auth/callback` },
            });
            if (linkData?.properties?.action_link) ctaUrl = linkData.properties.action_link;
          } catch { /* fall back to sign-in page */ }

          const greeting = pendingName ? `Hi ${pendingName},` : 'Hi there,';
          const nudgeHtml = `<!DOCTYPE html>
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
              ${partnerName} wants to<br/>practice with you 🔥
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#666666;line-height:1.6;">
              They've already set their schedule for your <strong style="color:#111;">${pendingNative} ↔ ${pendingTarget}</strong> exchange. Set yours back so we can find a time that works for both of you.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                  <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                    Set my schedule →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
              You're receiving this because you signed up for Mutua.<br/>
              <a href="https://trymutua.com" style="color:#aaaaaa;">trymutua.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

          resend.emails.send({
            from:    'Mutua <hello@trymutua.com>',
            to:      pendingEmail,
            subject: `${partnerName} wants to practice with you 🗓️ Set your schedule`,
            html:    nudgeHtml,
          }).catch(err => console.error('[set-availability] nudge email failed:', err));
        }
      }
    }

    await db.from('matches').update(updatePayload).eq('id', m.id);
  }

  // Run the scheduler inline for all matches where both sides have availability.
  // Calling it directly (instead of via HTTP) avoids inter-function timeouts on Vercel.
  const db2 = adminClient();
  const schedulerResults: Record<string, string> = {};

  // Build a map so we can access match data inside the async scheduler loop
  const matchDataMap = new Map(matches.map(m => [m.id, m]));

  const sendSessionScheduledEmails = async (matchId: string, startIso: string) => {
    if (!EMAILS_ENABLED) return;
    const m = matchDataMap.get(matchId);
    if (!m || !m.email_a || !m.email_b) return;

    try {
      // Look up auth user IDs by email so we can query user_availability by user_id
      // (user_availability stores user_id, not session_id)
      const { data: usersData } = await db2.auth.admin.listUsers({ perPage: 1000 });
      const allUsers = usersData?.users ?? [];
      const authA = allUsers.find(u => u.email === m.email_a);
      const authB = allUsers.find(u => u.email === m.email_b);

      const [{ data: availA }, { data: availB }] = await Promise.all([
        authA ? db2.from('user_availability').select('timezone').eq('user_id', authA.id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        authB ? db2.from('user_availability').select('timezone').eq('user_id', authB.id).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const tzA = (availA as any)?.timezone ?? 'UTC';
      const tzB = (availB as any)?.timezone ?? 'UTC';

      const timeForA = formatInTimezone(startIso, tzA);
      const timeForB = formatInTimezone(startIso, tzB);

      // Generate magic links for one-click sign-in
      const makeMagicLink = async (email: string) => {
        try {
          const { data } = await db2.auth.admin.generateLink({
            type: 'magiclink', email,
            options: { redirectTo: `${APP_URL}/auth/callback` },
          });
          return data?.properties?.action_link ?? `${APP_URL}/auth/send`;
        } catch { return `${APP_URL}/auth/send`; }
      };

      const [linkA, linkB] = await Promise.all([makeMagicLink(m.email_a), makeMagicLink(m.email_b)]);

      await Promise.allSettled([
        resend.emails.send({
          from:    'Mutua <hello@trymutua.com>',
          to:      m.email_a,
          subject: `Your session with ${m.name_b ?? m.email_b.split('@')[0]} is booked 🗓️`,
          html:    sessionScheduledEmailHtml(m.name_a, m.name_b ?? m.email_b.split('@')[0], timeForA, m.native_language_a, m.native_language_b, linkA),
        }),
        resend.emails.send({
          from:    'Mutua <hello@trymutua.com>',
          to:      m.email_b,
          subject: `Your session with ${m.name_a ?? m.email_a.split('@')[0]} is booked 🗓️`,
          html:    sessionScheduledEmailHtml(m.name_b, m.name_a ?? m.email_a.split('@')[0], timeForB, m.native_language_b, m.native_language_a, linkB),
        }),
      ]);
    } catch (emailErr) {
      console.error('[set-availability] session-scheduled email failed for', matchId, emailErr);
    }
  };

  await Promise.allSettled(
    matchesToSchedule.map(async (matchId) => {
      try {
        const result = await runScheduler(matchId);
        schedulerResults[matchId] = result.state + (result.slot ? ` @ ${result.slot.start.toISOString()}` : '');
        if (result.state !== 'scheduled') {
          await db2.from('matches').update({ scheduling_state: result.state }).eq('id', matchId);
        } else if (result.slot) {
          sendSessionScheduledEmails(matchId, result.slot.start.toISOString());
        }
      } catch (err: any) {
        // Retry once on slot conflict, otherwise fall back to no_overlap
        try {
          const result = await runScheduler(matchId);
          schedulerResults[matchId] = 'retry:' + result.state + (result.slot ? ` @ ${result.slot.start.toISOString()}` : '');
          if (result.state !== 'scheduled') {
            await db2.from('matches').update({ scheduling_state: result.state }).eq('id', matchId);
          } else if (result.slot) {
            sendSessionScheduledEmails(matchId, result.slot.start.toISOString());
          }
        } catch (err2) {
          schedulerResults[matchId] = 'error:' + String(err2);
          await db2.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
          console.error('[set-availability] scheduler failed for', matchId, err);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, matchesTriggered: matches.length, matchDebug, schedulerResults });
}
