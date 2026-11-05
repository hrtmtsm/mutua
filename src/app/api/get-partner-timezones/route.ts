/**
 * POST /api/get-partner-timezones
 * Body: { sessionIds: string[] }
 *
 * Returns a map of sessionId → IANA timezone string for the given session IDs.
 * Uses service role to look up email → auth user_id → user_availability.timezone.
 */

import { NextResponse } from 'next/server';
import {requireAuth} from '@/lib/presenceAuth';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const auth=await requireAuth(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
  const { sessionIds } = await request.json().catch(() => ({}));
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json({});
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const memberships=await auth.rpcDb.from('matches').select('session_id_a,session_id_b');
  const allowed=new Set((memberships.data||[]).flatMap(m=>[m.session_id_a,m.session_id_b]));
  const safeIds=sessionIds.filter(id=>typeof id==='string'&&allowed.has(id)).slice(0,100);
  if(!safeIds.length)return NextResponse.json({});
  // Only matched partners can disclose their timezone.
  const { data: profiles } = await db
    .from('profiles')
    .select('session_id, email')
    .in('session_id', safeIds);

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
