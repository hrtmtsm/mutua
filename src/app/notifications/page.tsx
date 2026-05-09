'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/Sidebar';

export default function NotificationsPage() {
  const router = useRouter();
  const [scheduleState, setScheduleState] = useState<string | null>(null);
  const [partnerName,   setPartnerName]   = useState('your partner');
  const [matchId,       setMatchId]       = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) { setLoading(false); return; }

    async function load() {
      const { data: match } = await supabase
        .from('matches')
        .select('id, scheduling_state, name_a, name_b, session_id_a, session_id_b')
        .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!match) { setLoading(false); return; }
      setMatchId(match.id);
      setScheduleState(match.scheduling_state ?? null);

      const isA = match.session_id_a === sessionId;
      const partnerSid = isA ? match.session_id_b : match.session_id_a;
      const fallback = isA ? (match.name_b ?? 'your partner') : (match.name_a ?? 'your partner');

      const { data: prof } = await supabase
        .from('profiles').select('name').eq('session_id', partnerSid).maybeSingle();
      setPartnerName(prof?.name ?? fallback);

      localStorage.removeItem('mutua_unread_notification');
      if (match.scheduling_state) {
        localStorage.setItem('mutua_last_seen_sched_state', match.scheduling_state);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-stone-100 flex items-center gap-3 px-4 h-14 shrink-0">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 text-stone-400 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-serif font-bold text-xl text-neutral-900">Notifications</span>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : scheduleState === 'scheduled' ? (
          <button
            onClick={() => router.push('/exchanges')}
            className="w-full flex items-start gap-3 p-4 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 transition-colors text-left"
          >
            <span className="text-xl mt-0.5">📅</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Session scheduled</p>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                Your session with {partnerName} has been confirmed. Tap to view →
              </p>
            </div>
          </button>
        ) : scheduleState === 'computing' ? (
          <div className="flex items-start gap-3 p-4 bg-white border border-stone-200 rounded-2xl">
            <span className="text-xl mt-0.5">🔍</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Finding a time</p>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                We're matching your availability with {partnerName}.
              </p>
            </div>
          </div>
        ) : scheduleState === 'no_overlap' ? (
          <button
            onClick={() => matchId && router.push(`/set-availability?matchId=${matchId}&schedulingState=pending_both`)}
            className="w-full flex items-start gap-3 p-4 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 transition-colors text-left"
          >
            <span className="text-xl mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">No overlapping times</p>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                Update your availability so we can find a slot with {partnerName}.
              </p>
            </div>
          </button>
        ) : (scheduleState === 'pending_a' || scheduleState === 'pending_b' || scheduleState === 'pending_both') ? (
          <div className="flex items-start gap-3 p-4 bg-white border border-stone-200 rounded-2xl">
            <span className="text-xl mt-0.5">🕐</span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Waiting on availability</p>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                We're waiting to find a new time with {partnerName}.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-neutral-900 mb-1">No notifications</p>
            <p className="text-xs text-stone-400 leading-relaxed">
              We'll let you know when your session is confirmed.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
