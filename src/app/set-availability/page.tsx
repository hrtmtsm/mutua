'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AvailabilityPicker from '@/components/AvailabilityPicker';
import type { AvailabilitySlot } from '@/components/AvailabilityPicker';
import TopNav from '@/components/Sidebar';
import TimezonePickerModal from '@/components/TimezonePickerModal';
import { ArrowLeft } from 'lucide-react';

function SetAvailabilityInner() {
  const router = useRouter();
  const searchParams   = useSearchParams();
  const matchId        = searchParams.get('matchId');
  const schedulingState = searchParams.get('schedulingState');
  const showPartner    = !!matchId;

  const [slots,        setSlots]        = useState<AvailabilitySlot[]>([]);
  const [timezone,     setTimezone]     = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showTzSelect, setShowTzSelect] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [partnerName,  setPartnerName]  = useState('your partner');
  const [partnerSlots, setPartnerSlots] = useState<AvailabilitySlot[]>([]);

  // Read partner name synchronously on mount
  useEffect(() => {
    const direct = localStorage.getItem('mutua_scheduling_partner');
    if (direct) { setPartnerName(direct); return; }
    const raw = localStorage.getItem('mutua_current_partner');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.name) setPartnerName(parsed.name);
      } catch { /* ignore malformed data */ }
    }
  }, []);

  // Load existing availability if any
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/get-availability', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => null);
        if (res?.ok) {
          const av = await res.json();
          if (av.slots?.length) setSlots(av.slots);
          if (av.timezone)      setTimezone(av.timezone);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  // Fetch partner slots when in no_overlap state
  useEffect(() => {
    if (!showPartner || !matchId) return;
    async function loadPartner() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `/api/get-partner-availability?matchId=${encodeURIComponent(matchId!)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      ).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        if (data.slots?.length) setPartnerSlots(data.slots);
      }
    }
    loadPartner();
  }, [matchId, showPartner]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    // Signal session page to immediately show 'Finding a match' on load
    localStorage.setItem('mutua_just_saved_availability', 'true');
    await fetch('/api/set-availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ slots, timezone }),
    }).catch(() => null);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <TopNav />

      {/* Scrollable content area */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full px-6">

        <div className="pt-6 pb-4 shrink-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-neutral-900 transition-colors mb-6 self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">
            {schedulingState === 'scheduled' ? `Rescheduling with ${partnerName}` : `Scheduling with ${partnerName}`}
          </p>
          <h1 className="font-serif font-black text-2xl text-neutral-900">
            {schedulingState === 'scheduled' ? 'Update your free times' : 'When are you usually free?'}
          </h1>
          <p className="text-sm text-stone-500 mt-1.5">
            {schedulingState === 'scheduled'
              ? `Your current session will be replaced. Your partner's free times are highlighted — add slots that overlap to find a new time.`
              : showPartner
                ? (() => {
                    const overlapCount = slots.filter(s =>
                      partnerSlots.some(p => p.day_of_week === s.day_of_week && p.start_minute === s.start_minute)
                    ).length;
                    return overlapCount > 0
                      ? `You have ${overlapCount} overlapping slot${overlapCount > 1 ? 's' : ''} with ${partnerName}. Hit save to lock it in!`
                      : `Your schedules don't overlap yet. Partner's free times are highlighted — add slots that line up to find a shared window.`;
                  })()
                : `We'll match your schedule with ${partnerName}'s and automatically find the best time — you only set this once.`}
          </p>

          {/* Timezone row — fixed, never scrolls */}
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-600">
            <span>
              <strong>{timezone.replace('_', ' ')}</strong>
              {' · '}
              {new Date().toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
            <button onClick={() => setShowTzSelect(true)} className="text-[#2B8FFF] underline">Change</button>
          </div>
        </div>

        {/* Legend — fixed, never scrolls */}
        {partnerSlots.length > 0 && (
          <div className="shrink-0 flex items-center justify-center gap-4 pb-2 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#2B8FFF]/40 inline-block" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-300/50 inline-block" />
              Partner
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-400/50 inline-block" />
              Overlap
            </span>
          </div>
        )}

        {/* Grid — scrolls independently */}
        <div className="flex-1 overflow-y-auto pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AvailabilityPicker
              initial={slots}
              timezone={timezone}
              onChange={(s, tz) => { setSlots(s); setTimezone(tz); }}
              fullHeight
              hideTimezoneNotice
              hideLegend
              partnerSlots={partnerSlots.length > 0 ? partnerSlots : undefined}
            />
          )}
        </div>

      </div>

      {/* Sticky bottom — save button or post-save confirmation */}
      <div className="shrink-0 px-6 pt-3 pb-6 bg-white border-t border-stone-100 max-w-2xl mx-auto w-full">
        {saved ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-500 text-center leading-relaxed">
              We'll match you with <span className="font-semibold text-neutral-900">{partnerName}</span> using your schedule.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { window.location.href = '/app'; }}
                className="flex-1 py-3 btn-primary text-white font-bold text-sm rounded-xl"
              >
                Sounds good
              </button>
              <button
                onClick={() => setSaved(false)}
                className="flex-1 py-3 border border-stone-200 text-stone-500 font-medium text-sm rounded-xl hover:bg-stone-100 transition-colors"
              >
                Update schedule
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saving || cancelling || slots.length === 0}
              className="w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <span>
                  {schedulingState === 'scheduled' ? 'Find a new time' : 'Match our schedules'}
                  {slots.length > 0 && (
                    <span className="font-normal opacity-80"> · {slots.length} slots</span>
                  )}
                  {' →'}
                </span>
              )}
            </button>

            {schedulingState === 'scheduled' && matchId && (
              <button
                onClick={handleCancel}
                disabled={saving || cancelling}
                className="w-full mt-3 text-sm text-stone-400 hover:text-rose-500 transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
