/**
 * GET /api/cron/reset-past-sessions
 * Called daily at 02:00 UTC by Vercel Cron (vercel.json).
 * Resets matches where scheduled_at has passed so users can rebook.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'mutua-dev';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

export async function GET() {
  const authHeader = headers().get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${APP_URL}/api/admin/reset-past-sessions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ secret: ADMIN_SECRET }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: true, ...data });
}
