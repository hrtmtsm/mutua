'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from '@/lib/analytics';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

function SessionReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromHistory  = searchParams.has('partner');

  const [duration,    setDuration]    = useState(0);
  const [partnerName, setPartnerName] = useState('your partner');
  const [streak,      setStreak]      = useState(0);
  const [matchId,     setMatchId]     = useState<string | null>(null);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [partnerId,   setPartnerId]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    const qPartner = searchParams.get('partner');
    if (qPartner) {
      setPartnerName(qPartner);
    } else {
      const session = localStorage.getItem('mutua_last_session');
      if (session) {
        const { duration: d, partnerName: n, matchId: mid, partnerId: pid } = JSON.parse(session);
        setDuration(d ?? 0);
        setPartnerName(n ?? 'your partner');
        setMatchId(mid ?? null);
        setPartnerId(pid ?? null);
      }
    }
    setUserId(localStorage.getItem('mutua_session_id'));
    const streakRaw = localStorage.getItem('mutua_streak');
    if (streakRaw) setStreak(JSON.parse(streakRaw).count ?? 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRematch(goToSchedule: boolean) {
    track('rematch_requested', { partner_name: partnerName, go_to_schedule: goToSchedule });
    setLoading(true);
    try {
      if (matchId && userId && partnerId) {
        await fetch('/api/rematch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, userId, partnerId }),
        });
      }
    } catch { /* ignore — still navigate */ }
    setLoading(false);
    router.push(goToSchedule ? '/set-availability' : '/app');
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10 max-w-sm mx-auto">

      <div className="w-full flex flex-col items-center text-center gap-6">

        {!fromHistory && (
          <div className="flex flex-col items-center gap-3">
            <span className="text-6xl">🔥</span>
            <div>
              <p className="text-5xl font-black text-neutral-900">{formatDuration(duration)}</p>
              <p className="text-sm text-neutral-400 mt-2">of practice with {partnerName}</p>
            </div>
            {streak > 1 && (
              <p className="text-sm font-semibold text-[#2B8FFF] bg-[#2B8FFF]/8 px-4 py-1.5 rounded-full">
                {streak}-day streak 🎉
              </p>
            )}
          </div>
        )}

        <div className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 text-left">
          <p className="text-sm font-semibold text-neutral-900 mb-1">Keep the momentum going</p>
          <p className="text-sm text-neutral-500 leading-relaxed">
            We&rsquo;ll match you with {partnerName} again once they confirm too.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleRematch(false)}
              disabled={loading}
              className="flex-1 py-3 btn-primary text-white font-bold rounded-xl text-sm disabled:opacity-50"
            >
              Sounds good
            </button>
            <button
              onClick={() => handleRematch(true)}
              disabled={loading}
              className="flex-1 py-3 border border-stone-200 text-stone-500 font-medium rounded-xl text-sm hover:bg-stone-100 transition-colors disabled:opacity-50"
            >
              Update schedule
            </button>
          </div>
        </div>

        {!fromHistory && (
          <button
            onClick={() => router.push('/app')}
            className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            Find another partner
          </button>
        )}

      </div>
    </div>
  );
}

export default function SessionReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SessionReviewInner />
    </Suspense>
  );
}
