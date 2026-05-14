/**
 * POST /api/get-partner-timezones
 * Body: { sessionIds: string[] }
 *
 * Returns a map of sessionId → IANA timezone string for the given session IDs.
 * Uses service role to look up email → auth user_id → user_availability.timezone.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const { sessionIds } = await request.json().catch(() => ({}));
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json({});
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Resolve session_ids → emails via profiles
  const { data: profiles } = await db
    .from('profiles')
    .select('session_id, email')
    .in('session_id', sessionIds);

  if (!profiles?.length) return NextResponse.json({});

  const emails = profiles.map(p => p.email).filter(Boolean);

  // Resolve emails → auth user_ids
  const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
  const allUsers = usersData?.users ?? [];
  const emailToUserId: Record<string, string> = {};
  for (const u of allUsers) {
    if (u.email && emails.includes(u.email)) {
      emailToUserId[u.email] = u.id;
    }
  }

  const userIds = Object.values(emailToUserId);
  if (!userIds.length) return NextResponse.json({});

  // Fetch timezones from user_availability
  const { data: avail } = await db
    .from('user_availability')
    .select('user_id, timezone')
    .in('user_id', userIds);

  const userIdToTimezone: Record<string, string> = {};
  for (const row of avail ?? []) {
    if (row.user_id && row.timezone) userIdToTimezone[row.user_id] = row.timezone;
  }

  // Build sessionId → timezone result
  const result: Record<string, string> = {};
  for (const p of profiles) {
    const userId = emailToUserId[p.email];
    const tz = userId ? userIdToTimezone[userId] : undefined;
    if (tz) result[p.session_id] = tz;
  }

  return NextResponse.json(result);
}
