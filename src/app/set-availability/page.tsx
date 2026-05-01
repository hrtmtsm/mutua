'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TopNav from '@/components/Sidebar';
import TimezonePickerModal from '@/components/TimezonePickerModal';
import WeekSlotPicker, { type SessionSlot } from '@/components/WeekSlotPicker';
import { ArrowLeft } from 'lucide-react';

function SetAvailabilityInner() {
  const router          = useRouter();
  const searchParams    = useSearchParams();
  const matchId         = searchParams.get('matchId');
  const schedulingState = searchParams.get('schedulingState');

  const [slots,        setSlots]        = useState<SessionSlot[]>([]);
  const [partnerSlots, setPartnerSlots] = useState<SessionSlot[]>([]);
  const [timezone,     setTimezone]     = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Initialize from localStorage immediately — slots appear on first render, no network wait
  const [initialSlots, setInitialSlots] = useState<SessionSlot[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('mutua_slot_template');
      if (!raw) return [];
      const mins: number[] = JSON.parse(raw);
      if (!mins?.length) return [];
      const tz  = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const out: SessionSlot[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        for (const min of mins) {
          const h  = String(Math.floor(min / 60)).padStart(2, '0');
          const mn = String(min % 60).padStart(2, '0');
          const dp = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
          const assumed   = new Date(`${dp}T${h}:${mn}:00Z`);
          const displayed = assumed.toLocaleString('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(', ', 'T');
          const offset    = assumed.getTime() - new Date(displayed + 'Z').getTime();
          out.push({ startsAt: new Date(assumed.getTime() + offset).toISOString() });
        }
      }
      return out;
    } catch { return []; }
  });
  const [showTzSelect, setShowTzSelect] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [result,       setResult]       = useState<{ state: string; scheduledAt?: string | null } | null>(null);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [partnerName,  setPartnerName]  = useState('your partner');

  useEffect(() => {
    const direct = localStorage.getItem('mutua_scheduling_partner');
    if (direct) { setPartnerName(direct); return; }
    const raw = localStorage.getItem('mutua_current_partner');
    if (raw) {
      try { const p = JSON.parse(raw); if (p.name) setPartnerName(p.name); } catch {}
    }
  }, []);

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
            const tz  = timezone;
            const now = new Date();

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

            const result: SessionSlot[] = [];
            for (let i = 1; i <= 7; i++) {
              const d = new Date(now);
              d.setDate(now.getDate() + i);
              for (const min of templateMinutes) {
                const h  = String(Math.floor(min / 60)).padStart(2, '0');
                const mn = String(min % 60).padStart(2, '0');
                const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
                const assumed  = new Date(`${datePart}T${h}:${mn}:00Z`);
                const displayed = assumed.toLocaleString('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(', ', 'T');
                const offset = assumed.getTime() - new Date(displayed + 'Z').getTime();
                const slotUtc = new Date(assumed.getTime() + offset);
                // Skip slots already booked with another partner
                if (!takenTimes.has(slotUtc.getTime())) {
                  result.push({ startsAt: slotUtc.toISOString() });
                }
              }
            }
            setInitialSlots(result);
          }
        } catch {}
      }

      // 3. Partner slots (independent of above)
      if (matchId) {
        const partnerUrl = `/api/get-partner-slots?matchId=${encodeURIComponent(matchId)}&sessionId=${encodeURIComponent(sid)}`;
        const partnerRes = await fetch(partnerUrl, { headers }).catch(() => null);
        if (partnerRes?.ok) {
          const data = await partnerRes.json();
          if (data.slots?.length) setPartnerSlots(data.slots);
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
    // Save time-of-day pattern to profile for cross-device reuse
    try {
      const tz = timezone;
      const minutes = futureSlots.map(s => {
        const localStr = new Date(s.startsAt).toLocaleString('en-CA', {
          timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const [hh, mm] = localStr.split(':').map(Number);
        return hh * 60 + mm;
      });
      const unique = [...new Set(minutes)];
      // Always save to localStorage for same-device reuse (works without migration)
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
      <TopNav />

      <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full px-6">
        <div className="pt-6 pb-4 shrink-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-neutral-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
            {schedulingState === 'scheduled' ? `Rescheduling with ${partnerName}` : `Scheduling with ${partnerName}`}
          </p>
          <h1 className="font-serif font-black text-2xl text-neutral-900">
            When are you free this week?
          </h1>
          <p className="text-sm text-stone-500 mt-1.5">
            {partnerSlots.length > 0
              ? overlapCount > 0
                ? `You have ${overlapCount} overlapping slot${overlapCount > 1 ? 's' : ''} with ${partnerName}. Hit save to lock it in!`
                : `${partnerName}'s free times are highlighted — tap slots that overlap to find a shared window.`
              : `Tap blocks when you're free. We'll match your times with ${partnerName}'s and book automatically.`
            }
          </p>

          {/* Timezone row */}
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-600">
            <span>
              <strong>{timezone.replace(/_/g, ' ')}</strong>
              {' · '}
              {new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            <button onClick={() => setShowTzSelect(true)} className="text-[#2B8FFF] underline">Change</button>
          </div>
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
            onChange={setSlots}
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
