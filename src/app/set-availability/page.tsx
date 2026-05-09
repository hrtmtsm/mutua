'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TopNav from '@/components/Sidebar';
import TimezonePickerModal from '@/components/TimezonePickerModal';
import WeekSlotPicker, { type SessionSlot } from '@/components/WeekSlotPicker';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from '@/components/PartnerCard';

// ── Template helpers ───────────────────────────────────────────────────────────
// Encode as dow*10000+minuteOfDay so we remember which specific days were chosen.
// Values <1440 are the old minute-only format (expand to all 7 days for compat).

function getUTCOffsetMinutes(d: Date, tz: string): number {
  try {
    const str = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).format(d);
    const m = str.match(/GMT([+-])(\d{1,2}):(\d{2})/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    return sign * (parseInt(m[2]) * 60 + parseInt(m[3]));
  } catch { return 0; }
}

function getLocalDow(d: Date, tz: string): number {
  const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const [y, mo, day] = localDateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, day)).getUTCDay();
}

function encodeTemplateSlots(futureSlots: SessionSlot[], tz: string): number[] {
  const vals = futureSlots.map(s => {
    const d = new Date(s.startsAt);
    const offsetMin = getUTCOffsetMinutes(d, tz);
    const localMs   = d.getTime() + offsetMin * 60_000;
    const min       = Math.floor(localMs / 60_000) % (24 * 60);
    const dow       = getLocalDow(d, tz);
    return dow * 10000 + min;
  });
  return [...new Set(vals)];
}

function makeSlot(d: Date, minuteOfDay: number, tz: string): SessionSlot {
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const [y, mo, day] = localDate.split('-').map(Number);
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const fakeUTC = new Date(Date.UTC(y, mo - 1, day, h, m, 0));
  // Two-pass to handle DST edge cases
  const offset1 = getUTCOffsetMinutes(fakeUTC, tz);
  const pass1   = new Date(fakeUTC.getTime() - offset1 * 60_000);
  const offset2 = getUTCOffsetMinutes(pass1, tz);
  return { startsAt: new Date(fakeUTC.getTime() - offset2 * 60_000).toISOString() };
}

function buildSlotsFromTemplate(templateValues: number[], tz: string): SessionSlot[] {
  const now = new Date();
  const out: SessionSlot[] = [];
  const isNewFormat = templateValues.some(v => v >= 10000);

  if (isNewFormat) {
    // DOW-encoded: find the matching day in the next 7 days
    for (const val of templateValues) {
      const dow = Math.floor(val / 10000);
      const min = val % 10000;
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        if (getLocalDow(d, tz) === dow) { out.push(makeSlot(d, min, tz)); break; }
      }
    }
  } else {
    // Legacy minute-only: expand to all 7 days
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      for (const min of templateValues) out.push(makeSlot(d, min, tz));
    }
  }
  return out;
}

function SetAvailabilityInner() {
  const router          = useRouter();
  const searchParams    = useSearchParams();
  const matchId         = searchParams.get('matchId');
  const schedulingState = searchParams.get('schedulingState');

  const [slots,        setSlots]        = useState<SessionSlot[]>([]);
  const [partnerSlots,    setPartnerSlots]    = useState<SessionSlot[]>([]);
  const [partnerProjected, setPartnerProjected] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<SessionSlot[]>([]);
  const [timezone,     setTimezone]     = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Initialize from localStorage immediately — slots appear on first render, no network wait
  const [initialSlots, setInitialSlots] = useState<SessionSlot[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('mutua_slot_template');
      if (!raw) return [];
      const vals: number[] = JSON.parse(raw);
      if (!vals?.length) return [];
      return buildSlotsFromTemplate(vals, Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch { return []; }
  });
  const [showTzSelect, setShowTzSelect] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [result,       setResult]       = useState<{ state: string; scheduledAt?: string | null } | null>(null);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [partnerName,      setPartnerName]      = useState('your partner');
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
  const [partnerNativeLang, setPartnerNativeLang] = useState('');

  useEffect(() => {
    // Try localStorage first
    const raw = localStorage.getItem('mutua_current_partner');
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p.name)            setPartnerName(p.name);
        if (p.avatar_url)      setPartnerAvatarUrl(p.avatar_url);
        if (p.native_language) setPartnerNativeLang(p.native_language);
      } catch {}
    }
    const direct = localStorage.getItem('mutua_scheduling_partner');
    if (direct) setPartnerName(direct);

    // Also try to fetch fresh avatar from DB if matchId is available
    if (matchId) {
      const sid = localStorage.getItem('mutua_session_id') ?? '';
      supabase
        .from('matches')
        .select('session_id_a, session_id_b')
        .eq('id', matchId)
        .maybeSingle()
        .then(({ data: m }) => {
          if (!m) return;
          const partnerId = m.session_id_a === sid ? m.session_id_b : m.session_id_a;
          supabase
            .from('profiles')
            .select('name, avatar_url, native_language')
            .eq('session_id', partnerId)
            .maybeSingle()
            .then(({ data: prof }) => {
              if (!prof) return;
              if (prof.name)            setPartnerName(prof.name);
              if (prof.avatar_url)      setPartnerAvatarUrl(prof.avatar_url);
              if (prof.native_language) setPartnerNativeLang(prof.native_language);
            });
        });
    }
  }, [matchId]);

  // Load slots: my submitted slots for this match, partner slots, then template as fallback
  useEffect(() => {
    async function loadAll() {
      const { data: { session } } = await supabase.auth.getSession();
      const sid = localStorage.getItem('mutua_session_id') ?? '';
      const headers: Record<string, string> = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      // 1. My own previously submitted slots (takes priority over template)
      let gotMySlots = false;
      if (matchId) {
        const myUrl = `/api/get-my-slots?matchId=${encodeURIComponent(matchId)}&sessionId=${encodeURIComponent(sid)}`;
        const myRes = await fetch(myUrl, { headers }).catch(() => null);
        if (myRes?.ok) {
          const data = await myRes.json();
          // Only use previously submitted slots if at least one is still in the future
          const now = new Date();
          const futureSlots = (data.slots ?? []).filter((s: { startsAt: string }) => new Date(s.startsAt) > now);
          if (futureSlots.length) { setInitialSlots(futureSlots); gotMySlots = true; }
        }
      }

      // 2. Template fallback — only if no submitted slots exist for this match
      if (!gotMySlots) {
        try {
          let templateMinutes: number[] | null = null;
          if (sid) {
            const { data: profile } = await supabase.from('profiles').select('slot_template').eq('session_id', sid).maybeSingle();
            templateMinutes = profile?.slot_template ?? null;
          }
          if (!templateMinutes?.length && session?.user?.email) {
            const { data: p2 } = await supabase.from('profiles').select('slot_template').eq('email', session.user.email).maybeSingle();
            templateMinutes = p2?.slot_template ?? null;
          }
          // Fallback to localStorage (works without DB migration, same-device)
          if (!templateMinutes?.length) {
            const local = localStorage.getItem('mutua_slot_template');
            if (local) try { templateMinutes = JSON.parse(local); } catch {}
          }
          if (templateMinutes?.length) {
            // Fetch already-confirmed sessions to exclude taken slots
            const confirmedRes = await fetch(
              `/api/get-confirmed-sessions?sessionId=${encodeURIComponent(sid)}`,
              { headers }
            ).catch(() => null);
            const confirmedData = confirmedRes?.ok ? await confirmedRes.json() : {};
            const takenTimes = new Set<number>(
              (confirmedData.sessions ?? []).map((s: { startsAt: string }) =>
                new Date(s.startsAt).getTime()
              )
            );

            const result = buildSlotsFromTemplate(templateMinutes, timezone)
              .filter(s => !takenTimes.has(new Date(s.startsAt).getTime()));
            setInitialSlots(result);
          }
        } catch {}
      }

      // 3. Confirmed sessions → blocked slots (always fetch, independent of template)
      const confirmedRes2 = await fetch(
        `/api/get-confirmed-sessions?sessionId=${encodeURIComponent(sid)}`,
        { headers }
      ).catch(() => null);
      if (confirmedRes2?.ok) {
        const confirmedData2 = await confirmedRes2.json();
        if (confirmedData2.sessions?.length) {
          setBlockedSlots(confirmedData2.sessions.map((s: { startsAt: string }) => ({ startsAt: s.startsAt })));
        }
      }

      // 4. Partner slots (independent of above)
      if (matchId) {
        const partnerUrl = `/api/get-partner-slots?matchId=${encodeURIComponent(matchId)}&sessionId=${encodeURIComponent(sid)}`;
        const partnerRes = await fetch(partnerUrl, { headers }).catch(() => null);
        if (partnerRes?.ok) {
          const data = await partnerRes.json();
          if (data.slots?.length) {
            setPartnerSlots(data.slots);
            setPartnerProjected(data.projected === true);
          }
        }
      }
    }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const handleSave = async () => {
    if (!matchId || slots.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const { data: { session } } = await supabase.auth.getSession();

    // Filter out past slots before submitting
    const now = new Date();
    const futureSlots = slots.filter(s => new Date(s.startsAt) > now);
    if (futureSlots.length === 0) {
      setSaving(false);
      setSaveError('All selected times are in the past. Please pick times later this week.');
      return;
    }

    const res = await fetch('/api/set-session-slots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ matchId, slots: futureSlots, sessionId: localStorage.getItem('mutua_session_id') ?? '' }),
    }).catch(() => null);

    if (!res) {
      setSaving(false);
      setSaveError('Network error. Please try again.');
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      setSaveError(data.error ?? 'Something went wrong. Please try again.');
      return;
    }

    setResult(data);
    // Save day-of-week + time pattern for reuse across partners
    try {
      const unique = encodeTemplateSlots(futureSlots, timezone);
      localStorage.setItem('mutua_slot_template', JSON.stringify(unique));
      const sid = localStorage.getItem('mutua_session_id') ?? '';
      if (session?.user?.email) {
        await supabase.from('profiles').update({ slot_template: unique }).eq('email', session.user.email);
      } else if (sid) {
        await supabase.from('profiles').update({ slot_template: unique }).eq('session_id', sid);
      }
    } catch {}

    setSaving(false);
    setSaved(true);
  };

  const handleCancel = async () => {
    if (!matchId) return;
    setCancelling(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/cancel-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ matchId }),
    });
    setCancelling(false);
    window.location.href = '/app';
  };

  const overlapCount = slots.filter(s =>
    partnerSlots.some(p => p.startsAt === s.startsAt)
  ).length;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Desktop nav only */}
      <div className="hidden md:block"><TopNav /></div>

      {/* Mobile compact header */}
      <div className="md:hidden shrink-0 flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-stone-100">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-stone-100 transition-colors text-neutral-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar name={partnerName} lang={partnerNativeLang} avatarUrl={partnerAvatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="font-bold text-base text-neutral-900 leading-tight truncate">{partnerName}</p>
          <p className="text-xs text-stone-400">
            {schedulingState === 'scheduled' ? 'Rescheduling a session' : 'Scheduling a session'}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full px-6">
        <div className="pt-6 pb-4 shrink-0">
          {/* Desktop back + partner identity */}
          <button
            onClick={() => router.back()}
            className="hidden md:flex items-center gap-1.5 text-sm text-stone-400 hover:text-neutral-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="hidden md:flex items-center gap-3 mb-4">
            <Avatar name={partnerName} lang={partnerNativeLang} avatarUrl={partnerAvatarUrl} size="md" />
            <div>
              <p className="font-bold text-lg text-neutral-900 leading-tight">{partnerName}</p>
              <p className="text-sm text-stone-400">
                {schedulingState === 'scheduled' ? 'Rescheduling a session' : 'Scheduling a session'}
              </p>
            </div>
          </div>

          {partnerSlots.length > 0 && overlapCount > 0 && (
            <p className="text-sm text-stone-500 mt-1.5">
              {`You have ${overlapCount} overlapping slot${overlapCount > 1 ? 's' : ''} with ${partnerName}. Hit save to lock it in!`}
            </p>
          )}
        </div>

        {/* Legend */}
        {partnerSlots.length > 0 && (
          <div className="shrink-0 flex items-center justify-center gap-4 pb-2 text-xs text-stone-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#2B8FFF]/40 inline-block" />You</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-300/50 inline-block" />Partner</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400/50 inline-block" />Overlap</span>
          </div>
        )}

        {/* Picker */}
        <div className="flex-1 overflow-y-auto pb-4">
          <WeekSlotPicker
            timezone={timezone}
            partnerSlots={partnerSlots}
            initialSlots={initialSlots}
            blockedSlots={blockedSlots}
            onChange={setSlots}
            onTimezoneChange={() => setShowTzSelect(true)}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-6 pt-3 pb-6 bg-white border-t border-stone-100 max-w-2xl mx-auto w-full">
        {saved ? (
          <div className="space-y-3">
            {result?.state === 'scheduled' ? (
              <p className="text-sm text-center text-emerald-600 font-semibold">
                Session booked! Check your email for details.
              </p>
            ) : (
              <p className="text-sm text-stone-500 text-center leading-relaxed">
                Got it! We'll notify <span className="font-semibold text-neutral-900">{partnerName}</span> to pick their times.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { window.location.href = '/app'; }}
                className="flex-1 py-3 btn-primary text-white font-bold text-sm rounded-xl"
              >
                {result?.state === 'scheduled' ? 'View session →' : 'Sounds good'}
              </button>
              <button
                onClick={() => { setSaved(false); setResult(null); setSaveError(null); }}
                className="flex-1 py-3 border border-stone-200 text-stone-500 font-medium text-sm rounded-xl hover:bg-stone-100 transition-colors"
              >
                Update times
              </button>
            </div>
          </div>
        ) : (
          <>
            {saveError && (
              <p className="text-xs text-rose-500 text-center mb-2">{saveError}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving || cancelling || slots.length === 0 || !matchId}
              className="w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none"
            >
              {saving ? 'Saving...' : slots.length > 0 ? 'Set schedule →' : 'Tap slots above to continue'}
            </button>

            {schedulingState === 'scheduled' && matchId && (
              <button
                onClick={handleCancel}
                disabled={saving || cancelling}
                className="w-full mt-3 text-sm text-stone-400 hover:text-rose-500 transition-colors disabled:opacity-40"
              >
                {cancelling ? 'Cancelling...' : "Actually, I can't make it :("}
              </button>
            )}
          </>
        )}
      </div>

      {showTzSelect && (
        <TimezonePickerModal
          current={timezone}
          onSelect={tz => setTimezone(tz)}
          onClose={() => setShowTzSelect(false)}
        />
      )}
    </div>
  );
}

export default function SetAvailabilityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SetAvailabilityInner />
    </Suspense>
  );
}
