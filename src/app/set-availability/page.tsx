'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AvailabilityPicker from '@/components/AvailabilityPicker';
import type { AvailabilitySlot } from '@/components/AvailabilityPicker';
import TopNav from '@/components/Sidebar';

export default function SetAvailabilityPage() {
  const router = useRouter();
  const [slots,       setSlots]       = useState<AvailabilitySlot[]>([]);
  const [timezone,    setTimezone]    = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [partnerName, setPartnerName] = useState('your partner');

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
            Scheduling with {partnerName}
          </p>
          <h1 className="font-serif font-black text-2xl text-neutral-900">When are you usually free?</h1>
          <p className="text-sm text-stone-500 mt-1.5">
            We'll match your schedule with {partnerName}'s and automatically find the best time — you only set this once.
          </p>
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
            />
          )}
        </div>

      </div>

      {/* Sticky save button — always visible */}
      <div className="shrink-0 px-6 pt-3 pb-6 bg-white border-t border-stone-100 max-w-2xl mx-auto w-full">
        <button
          onClick={handleSave}
          disabled={saving || slots.length === 0}
          className="w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? 'Matching schedules...' : 'Match our schedules →'}
        </button>
      </div>
    </div>
  );
}
