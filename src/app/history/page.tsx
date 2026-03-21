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

interface Stats {
  streak:       number;
  totalMinutes: number;
  totalSessions: number;
  partners:     number;
  weekSessions: number;
  weekGoal:     number;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m} min`;
}

function formatTotalTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return `${totalSeconds}s`;
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

function frequencyToGoal(freq: string): number {
  if (freq.includes('twice') || freq.includes('2')) return 2;
  if (freq.includes('three') || freq.includes('3') || freq.includes('daily')) return 3;
  return 1;
}

function computeStats(sessions: SessionEntry[]): Stats {
  const streakRaw = localStorage.getItem('mutua_streak');
  const streak = streakRaw ? (JSON.parse(streakRaw).count ?? 0) : 0;

  const totalSecs = sessions.reduce((acc, s) => acc + s.duration, 0);
  const partners  = new Set(sessions.map(s => s.partnerId || s.partnerName)).size;

  // Sessions this calendar week (Mon–Sun)
  const now  = new Date();
  const mon  = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekSessions = sessions.filter(s => new Date(s.date) >= mon).length;

  const profile = localStorage.getItem('mutua_profile');
  const freq    = profile ? (JSON.parse(profile).practice_frequency ?? '') : '';
  const weekGoal = frequencyToGoal(freq);

  return {
    streak,
    totalMinutes: totalSecs,
    totalSessions: sessions.length,
    partners,
    weekSessions,
    weekGoal,
  };
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-4 px-2 bg-white border border-stone-200 rounded-2xl">
      <p className="font-black text-xl text-neutral-500 leading-none">{value}</p>
      <p className="text-[10px] font-semibold text-stone-400 mt-1 text-center leading-tight">{label}</p>
    </div>
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [partners, setPartners]     = useState<PartnerSummary[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [modalPartner, setModalPartner] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('mutua_history');
    const sessions: SessionEntry[] = raw ? JSON.parse(raw) : [];
    setPartners(groupByPartner(sessions));
    setStats(computeStats(sessions));
  }, []);

  const weekPct = stats ? Math.min((stats.weekSessions / stats.weekGoal) * 100, 100) : 0;

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-6">
        <h1 className="font-serif font-black text-2xl text-neutral-500">Progress</h1>

        {/* ── Stats row ── */}
        {stats && (
          <div className="flex gap-3">
            <StatCard value={`${stats.streak}`}  label={`Session${stats.streak === 1 ? '' : 's'} streak`} />
            <StatCard value={formatTotalTime(stats.totalMinutes)} label="Total practice" />
            <StatCard value={`${stats.totalSessions}`} label="Sessions" />
            <StatCard value={`${stats.partners}`} label="Partners" />
          </div>
        )}

        {/* ── Weekly goal ── */}
        {stats && (
          <div className="px-5 py-4 space-y-3 bg-white border border-stone-200 rounded-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-500">This week</p>
              <p className="text-xs font-semibold text-stone-400">
                {stats.weekSessions} / {stats.weekGoal} session{stats.weekGoal === 1 ? '' : 's'}
              </p>
            </div>
            <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${weekPct}%`,
                  background: weekPct >= 100 ? '#22c55e' : '#2B8FFF',
                }}
              />
            </div>
            {weekPct >= 100 ? (
              <p className="text-xs text-green-600 font-semibold">Goal reached this week!</p>
            ) : (
              <p className="text-xs text-stone-400">
                {stats.weekGoal - stats.weekSessions} more session{stats.weekGoal - stats.weekSessions === 1 ? '' : 's'} to hit your goal
              </p>
            )}
          </div>
        )}

        {/* ── History ── */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">History</h2>

          {partners.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center mt-10">
              No sessions yet. Start practicing to build your history.
            </p>
          ) : (
            <div className="space-y-3">
              {partners.map(p => (
                <div
                  key={p.partnerId || p.partnerName}
                  className="px-5 py-4 space-y-3 bg-white border border-stone-200 rounded-2xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-neutral-500 text-base">{p.partnerName}</p>
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
                    <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-white">
                        {p.partnerName.trim().slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {p.scheduledFor && (
                    <p className="text-xs text-[#2B8FFF] bg-[#2B8FFF]/8 px-3 py-1 rounded-full inline-block">
                      Scheduled: {p.scheduledFor}
                    </p>
                  )}

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
        </div>

      </main>

      {/* Schedule modal */}
      {modalPartner && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
          <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-5 w-full max-w-sm">
            <p className="font-bold text-neutral-500 mb-1">Keep the momentum going</p>
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
