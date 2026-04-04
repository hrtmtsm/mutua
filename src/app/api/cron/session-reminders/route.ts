/**
 * GET /api/cron/session-reminders
 * Called daily at 10:00 UTC by Vercel Cron (vercel.json).
 * Sends reminder emails for sessions starting in the next 24 hours.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

export async function GET() {
  // Vercel signs cron requests with CRON_SECRET in the Authorization header
  const authHeader = headers().get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${APP_URL}/api/admin/send-session-reminders`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ secret: ADMIN_SECRET, hoursAhead: 24 }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
