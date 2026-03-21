'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';

interface SessionEntry {
  partnerName:  string;
  partnerId:    string;
  duration:     number;
  date:         string;
  scheduledFor?: string;
}

interface PartnerSummary {
  partnerName:   string;
  partnerId:     string;
  sessionCount:  number;
  totalDuration: number;
  lastDuration:  number;
  lastDate:      string;
  scheduledFor?: string;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m} min`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function groupByPartner(sessions: SessionEntry[]): PartnerSummary[] {
  const map = new Map<string, PartnerSummary>();
  for (const s of sessions) {
    const key = s.partnerId || s.partnerName;
    if (map.has(key)) {
      const p = map.get(key)!;
      p.sessionCount++;
      p.totalDuration += s.duration;
      // sessions are newest-first so first entry = last session
    } else {
      map.set(key, {
        partnerName:   s.partnerName,
        partnerId:     s.partnerId,
        sessionCount:  1,
        totalDuration: s.duration,
        lastDuration:  s.duration,
        lastDate:      s.date,
        scheduledFor:  s.scheduledFor,
      });
    }
  }
  return Array.from(map.values());
}

export default function HistoryPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [modalPartner, setModalPartner] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('mutua_history');
    if (raw) setPartners(groupByPartner(JSON.parse(raw)));
  }, []);

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full bg-[#f4f4f4]">
        <h1 className="font-serif font-black text-2xl text-neutral-900 mb-6">History</h1>

        {partners.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center mt-20">
            No sessions yet. Start practicing to build your history.
          </p>
        ) : (
          <div className="space-y-3">
            {partners.map(p => (
              <div
                key={p.partnerId || p.partnerName}
                className="px-5 py-4 space-y-3" style={{
                  background: 'linear-gradient(#ffffff4d 0%, #f8f8f899 100%)',
                  backdropFilter: 'blur(5px)',
                  WebkitBackdropFilter: 'blur(5px)',
                  border: '2px solid #f8f8f8',
                  borderRadius: '30px',
                  boxShadow: 'inset 10px -9px 22px 4px #0000000d',
                }}
              >
                {/* Partner info */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-neutral-900 text-base">{p.partnerName}</p>
                    {p.sessionCount > 1 ? (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Practiced together {p.sessionCount} times
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400 mt-0.5">First session</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Last session: {formatDuration(p.lastDuration)} · {formatDate(p.lastDate)}
                    </p>
                  </div>

                  {/* Initials avatar */}
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-white">
                      {p.partnerName.trim().slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Scheduled tag */}
                {p.scheduledFor && (
                  <p className="text-xs text-[#2B8FFF] bg-[#2B8FFF]/8 px-3 py-1 rounded-full inline-block">
                    Scheduled: {p.scheduledFor}
                  </p>
                )}

                {/* CTA — only show when not yet scheduled */}
                {!p.scheduledFor && (
                  <button
                    onClick={() => setModalPartner(p.partnerName)}
                    className="w-full py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
                  >
                    Schedule next session
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      {/* Schedule modal */}
      {modalPartner && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
          <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-5 w-full max-w-sm">
            <p className="font-bold text-neutral-900 mb-1">Keep the momentum going</p>
            <p className="text-sm text-neutral-500 leading-relaxed">
              We'll match you with {modalPartner} again using your current schedule.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalPartner(null)}
                className="flex-1 py-3 btn-primary text-white font-bold rounded-xl text-sm"
              >
                Sounds good
              </button>
              <button
                onClick={() => router.push('/set-availability')}
                className="flex-1 py-3 border border-stone-200 bg-white text-stone-500 font-medium rounded-xl text-sm hover:bg-stone-100 transition-colors"
              >
                Update schedule
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
