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

  useEffect(() => {
    const raw = localStorage.getItem('mutua_history');
    if (raw) setPartners(groupByPartner(JSON.parse(raw)));
  }, []);

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
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
                className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 space-y-3"
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
                  <div className="w-10 h-10 rounded-full bg-[#2B8FFF]/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#2B8FFF]">
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

                {/* CTA */}
                <button
                  onClick={() => router.push('/session-schedule')}
                  className="w-full py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
                >
                  Schedule next session
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
