/**
 * GET /api/cron/nudge-waiting
 * Called every 2 days at 10:00 UTC by Vercel Cron (vercel.json).
 * Nudges the person who hasn't set their schedule yet when their partner already has (pending_a/b).
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

  const res = await fetch(`${APP_URL}/api/admin/send-nudges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: ADMIN_SECRET, state: 'pending_ab' }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: true, ...data });
}
