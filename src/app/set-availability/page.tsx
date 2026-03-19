'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AvailabilityPicker from '@/components/AvailabilityPicker';
import type { AvailabilitySlot } from '@/components/AvailabilityPicker';
import TopNav from '@/components/Sidebar';

function SetAvailabilityInner() {
  const router = useRouter();
  const searchParams   = useSearchParams();
  const matchId        = searchParams.get('matchId');
  const schedulingState = searchParams.get('schedulingState');
  const showPartner    = schedulingState === 'no_overlap' || schedulingState === 'scheduled';

  const [slots,        setSlots]        = useState<AvailabilitySlot[]>([]);
  const [timezone,     setTimezone]     = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showTzSelect, setShowTzSelect] = useState(false);
  const [saving,       setSaving]       = useState(false);
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
      const parsed = JSON.parse(raw);
      if (parsed.name) setPartnerName(parsed.name);
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
    router.back();
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/set-availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ slots, timezone }),
    });
    setSaving(false);
    router.back();
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
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
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
                ? `Your schedules don't overlap yet. Partner's free times are highlighted — add slots that line up to find a shared window.`
                : `We'll match your schedule with ${partnerName}'s and automatically find the best time — you only set this once.`}
          </p>

          {/* Timezone row — fixed, never scrolls */}
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-600">
            {showTzSelect ? (
              <>
                <select
                  value={timezone}
                  onChange={e => { setTimezone(e.target.value); setShowTzSelect(false); }}
                  className="border border-stone-200 rounded-lg px-2 py-1 bg-white text-neutral-700 focus:outline-none text-xs"
                >
                  {Intl.supportedValuesOf('timeZone').map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <button onClick={() => setShowTzSelect(false)} className="text-stone-400 hover:text-stone-600">Cancel</button>
              </>
            ) : (
              <>
                <span>Times in <strong>{timezone}</strong></span>
                <button onClick={() => setShowTzSelect(true)} className="text-[#2B8FFF] underline">Change</button>
              </>
            )}
          </div>
        </div>

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
              partnerSlots={partnerSlots.length > 0 ? partnerSlots : undefined}
            />
          )}
        </div>

      </div>

      {/* Sticky save button — always visible */}
      <div className="shrink-0 px-6 pt-3 pb-6 bg-white border-t border-stone-100 max-w-2xl mx-auto w-full">
        <button
          onClick={handleSave}
          disabled={saving || cancelling || slots.length === 0}
          className="w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {saving ? (
            <span>{schedulingState === 'scheduled' ? 'Finding a new time...' : 'Matching schedules...'}</span>
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
      </div>
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
