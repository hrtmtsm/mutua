'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/Sidebar';
import { CheckCircle2 } from 'lucide-react';

export default function SessionConfirmedPage() {
  const router = useRouter();
  const [partnerName,   setPartnerName]   = useState('Your partner');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    const partner = localStorage.getItem('mutua_current_partner');
    const time    = localStorage.getItem('mutua_scheduled_time');

    if (!partner || !time) { router.replace('/match-result'); return; }

    setPartnerName(JSON.parse(partner).name ?? 'Your partner');
    setScheduledTime(time);
  }, [router]);

  if (!scheduledTime) return null;

  return (
    <div className="min-h-screen flex flex-col bg-white">

      <TopNav />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="max-w-md w-full space-y-6 text-center">

          {/* Check mark */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#2B8FFF]" />
            </div>
          </div>

          {/* Confirmation text */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2B8FFF]">
              Session scheduled
            </p>
            <p className="font-serif font-black text-2xl text-neutral-900 leading-snug">
              Your first practice with {partnerName} is set for
            </p>
            <p className="font-serif font-black text-3xl text-[#2B8FFF]">
              {scheduledTime}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => router.push('/pre-session')}
              className="w-full py-4 btn-primary text-white font-bold text-base rounded-xl shadow-md"
            >
              Go to session room →
            </button>
            <button
              onClick={() => router.push('/session-schedule')}
              className="w-full py-3 border border-stone-200 bg-white text-neutral-600 font-semibold text-sm rounded-xl hover:border-stone-300 transition-all"
            >
              Change time
            </button>
            <button
              onClick={() => router.push('/app')}
              className="w-full py-2 text-stone-400 hover:text-neutral-700 text-sm font-medium transition-colors"
            >
              ← Back to sessions
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
