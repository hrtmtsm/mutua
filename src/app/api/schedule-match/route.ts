/**
 * POST /api/schedule-match
 * Body: { matchId: string }
 *
 * Runs the availability scheduler for a given match.
 * Called server-side when:
 *  - A user saves availability
 *  - A match is created (if both users already have availability)
 *  - A user requests reschedule
 *
 * Returns: { state, scheduledAt? }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runScheduler } from '@/lib/scheduler';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { matchId } = body as { matchId?: string };

  if (!matchId) {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  }

  try {
    const result = await runScheduler(matchId);

    // Update scheduling_state on the match for non-booking transitions
    if (result.state !== 'scheduled') {
      const db = adminClient();
      await db
        .from('matches')
        .update({ scheduling_state: result.state })
        .eq('id', matchId);
    }

    return NextResponse.json({
      state:       result.state,
      scheduledAt: result.slot?.start.toISOString() ?? null,
    });
  } catch (err: any) {
    if (err.message?.startsWith('slot_conflict')) {
      // Retry once more then give up
      try {
        const result = await runScheduler(matchId);
        return NextResponse.json({
          state:       result.state,
          scheduledAt: result.slot?.start.toISOString() ?? null,
        });
      } catch {
        // Retry failed — resolve out of computing so match never gets stuck
        const db = adminClient();
        await db.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
        return NextResponse.json({ error: 'slot_conflict_retry_failed' }, { status: 409 });
      }
    }
    // Always resolve out of 'computing' so the match never gets stuck
    const db = adminClient();
    await db.from('matches').update({ scheduling_state: 'no_overlap' }).eq('id', matchId);
    console.error('[schedule-match]', err);
    return NextResponse.json({ error: err.message ?? 'internal_error' }, { status: 500 });
  }
}
