'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';

const OPTIONS = [
  { id: 'technical',  label: 'Technical issues' },
  { id: 'topics',     label: 'Ran out of things to say' },
  { id: 'nervous',    label: 'Felt nervous' },
  { id: 'nothing',    label: 'Nothing, it was great!' },
];

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

export default function SessionReviewPage() {
  const router = useRouter();
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [duration,    setDuration]    = useState(0);
  const [partnerName, setPartnerName] = useState('your partner');
  const [matchId,     setMatchId]     = useState<string | null>(null);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [partnerId,   setPartnerId]   = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('mutua_last_session');
    if (raw) {
      const { duration: d, partnerName: n, matchId: mid, partnerId: pid } = JSON.parse(raw);
      setDuration(d ?? 0);
      setPartnerName(n ?? 'your partner');
      setMatchId(mid ?? null);
      setPartnerId(pid ?? null);
    }
    setUserId(localStorage.getItem('mutua_session_id'));
  }, []);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (id === 'nothing') {
        return next.has('nothing') ? new Set() : new Set(['nothing']);
      }
      next.delete('nothing');
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDone() {
    track('session_feedback', {
      friction:     Array.from(selected),
      partner_name: partnerName,
      duration_secs: duration,
      match_id:     matchId,
    });

    // Fire-and-forget rematch
    if (matchId && userId && partnerId) {
      fetch('/api/rematch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId, userId, partnerId }),
      }).catch(() => {});
    }

    router.replace('/app');
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Duration */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-5xl">🔥</span>
          <p className="text-5xl font-black text-neutral-900">{formatDuration(duration)}</p>
          <p className="text-sm text-neutral-400">of practice with {partnerName}</p>
        </div>

        {/* Question */}
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold text-neutral-900 text-center">What held you back today?</p>
          <div className="flex flex-col gap-2">
            {OPTIONS.map(opt => {
              const active = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className={`w-full px-4 py-3.5 rounded-xl border text-sm font-medium text-left transition-colors ${
                    active
                      ? 'bg-[#2B8FFF] border-[#2B8FFF] text-white'
                      : 'bg-white border-stone-200 text-neutral-700 hover:bg-stone-50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Done */}
        <button
          onClick={handleDone}
          className="w-full py-3.5 btn-primary text-white font-bold rounded-xl text-sm"
        >
          Done
        </button>

      </div>
    </div>
  );
}
