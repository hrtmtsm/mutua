import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Project a DOW+minute template into the next 7 days (UTC)
function buildSlotsFromTemplate(templateValues: number[]): { startsAt: string }[] {
  const now = new Date();
  const out: { startsAt: string }[] = [];
  const isNewFormat = templateValues.some(v => v >= 10000);

  if (isNewFormat) {
    for (const val of templateValues) {
      const dow = Math.floor(val / 10000);
      const min = val % 10000;
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setUTCDate(now.getUTCDate() + i);
        if (d.getUTCDay() === dow) {
          d.setUTCHours(Math.floor(min / 60), min % 60, 0, 0);
          out.push({ startsAt: d.toISOString() });
          break;
        }
      }
    }
  } else {
    // Legacy: expand to all 7 days
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() + i);
      for (const min of templateValues) {
        const slot = new Date(d);
        slot.setUTCHours(Math.floor(min / 60), min % 60, 0, 0);
        out.push({ startsAt: slot.toISOString() });
      }
    }
  }
  return out;
}

// Derive a DOW+minute template from a list of past UTC timestamps
function deriveTemplateFromPastSlots(pastSlots: { starts_at: string }[]): number[] {
  const vals = pastSlots.map(s => {
    const d = new Date(s.starts_at);
    return d.getUTCDay() * 10000 + d.getUTCHours() * 60 + d.getUTCMinutes();
  });
  return [...new Set(vals)];
}

export async function GET(req: NextRequest) {
  const token     = req.headers.get('authorization')?.replace('Bearer ', '');
  const matchId   = req.nextUrl.searchParams.get('matchId');
  const sessionId = req.nextUrl.searchParams.get('sessionId'); // fallback for non-auth users

  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  if (!token && !sessionId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: match } = await db
    .from('matches')
    .select('email_a, email_b, session_id_a, session_id_b')
    .eq('id', matchId)
    .single();
  if (!match) return NextResponse.json({ error: 'match not found' }, { status: 404 });

  let partnerEmail: string;

  if (token) {
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (match.email_a !== user.email && match.email_b !== user.email) {
      return NextResponse.json({ error: 'not your match' }, { status: 403 });
    }
    partnerEmail = match.email_a === user.email ? match.email_b : match.email_a;
  } else {
    if (match.session_id_a !== sessionId && match.session_id_b !== sessionId) {
      return NextResponse.json({ error: 'not your match' }, { status: 403 });
    }
    partnerEmail = match.session_id_a === sessionId ? match.email_b : match.email_a;
  }

  // Fast email → auth UUID lookup via GoTrue admin REST (avoids loading all users)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const searchRes   = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50&filter=${encodeURIComponent(partnerEmail)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const searchData  = await searchRes.json().catch(() => ({}));
  const partner     = (searchData.users ?? []).find((u: { email: string }) => u.email === partnerEmail);
  if (!partner) return NextResponse.json({ slots: [], projected: false });

  // Fetch all partner slots for this match (past + future)
  const { data: allSlots } = await db
    .from('session_slots')
    .select('starts_at')
    .eq('user_id', partner.id)
    .eq('match_id', matchId)
    .order('starts_at', { ascending: true });

  const now = new Date();
  const futureSlots = (allSlots ?? []).filter(s => new Date(s.starts_at) > now);

  // If partner has future slots, return them directly
  if (futureSlots.length > 0) {
    return NextResponse.json({
      slots: futureSlots.map(s => ({ startsAt: s.starts_at })),
      projected: false,
    });
  }

  // No future slots — try slot_template from their profile
  const partnerSessionId = match.session_id_a === sessionId ? match.session_id_b : match.session_id_a;
  let templateValues: number[] | null = null;

  // Try by email first, then session_id
  if (partnerEmail) {
    const { data: profile } = await db
      .from('profiles')
      .select('slot_template')
      .eq('email', partnerEmail)
      .maybeSingle();
    templateValues = profile?.slot_template ?? null;
  }
  if (!templateValues?.length && partnerSessionId) {
    const { data: profile } = await db
      .from('profiles')
      .select('slot_template')
      .eq('session_id', partnerSessionId)
      .maybeSingle();
    templateValues = profile?.slot_template ?? null;
  }

  // If still nothing, derive from their past submitted slots
  if (!templateValues?.length && (allSlots ?? []).length > 0) {
    templateValues = deriveTemplateFromPastSlots(allSlots!);
  }

  if (!templateValues?.length) {
    return NextResponse.json({ slots: [], projected: false });
  }

  const projected = buildSlotsFromTemplate(templateValues);
  return NextResponse.json({ slots: projected, projected: true });
}
