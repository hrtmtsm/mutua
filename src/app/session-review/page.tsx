'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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

  useEffect(() => {
    // Partner name from query param (history flow) or last session
    const qPartner = searchParams.get('partner');
    if (qPartner) {
      setPartnerName(qPartner);
    } else {
      const session = localStorage.getItem('mutua_last_session');
      if (session) {
        const { duration: d, partnerName: n } = JSON.parse(session);
        setDuration(d ?? 0);
        setPartnerName(n ?? 'your partner');
      }
    }
    const streakRaw = localStorage.getItem('mutua_streak');
    if (streakRaw) setStreak(JSON.parse(streakRaw).count ?? 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10 max-w-sm mx-auto">

      <div className="w-full flex flex-col items-center text-center gap-6">

        {/* Celebration — only shown after a real session */}
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

        {/* Schedule confirmation */}
        <div className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 text-left">
          <p className="text-sm font-semibold text-neutral-900 mb-1">Keep the momentum going</p>
          <p className="text-sm text-neutral-500 leading-relaxed">
            We&rsquo;ll match you with {partnerName} again using your current schedule.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => router.push('/app')}
              className="flex-1 py-3 btn-primary text-white font-bold rounded-xl text-sm"
            >
              Sounds good
            </button>
            <button
              onClick={() => router.push('/set-availability')}
              className="flex-1 py-3 border border-stone-200 text-stone-500 font-medium rounded-xl text-sm hover:bg-stone-100 transition-colors"
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
