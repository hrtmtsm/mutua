'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { track } from '@/lib/analytics';
import { Video, X } from 'lucide-react';

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
  streak:        number;
  totalMinutes:  number;
  totalSessions: number;
  weekSessions:  number;
  weekGoal:      number;
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

  const now  = new Date();
  const mon  = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekSessions = sessions.filter(s => new Date(s.date) >= mon).length;

  const profile  = localStorage.getItem('mutua_profile');
  const freq     = profile ? (JSON.parse(profile).practice_frequency ?? '') : '';
  const weekGoal = frequencyToGoal(freq);

  return {
    streak,
    totalMinutes:  totalSecs,
    totalSessions: sessions.length,
    weekSessions,
    weekGoal,
  };
}

function weekMomentumSentence(weekSessions: number, weekGoal: number): string {
  const remaining = weekGoal - weekSessions;
  if (weekSessions >= weekGoal) return "You've hit your goal for this week.";
  if (weekSessions === 0) return "No sessions yet this week — schedule one to keep your momentum going.";
  if (remaining === 1) return "One more session and you'll hit your goal.";
  return `${remaining} more sessions to hit your goal.`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [modalPartner,    setModalPartner]    = useState<string | null>(null);
  const [recordingModal,  setRecordingModal]  = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('mutua_history');
    const sessions: SessionEntry[] = raw ? JSON.parse(raw) : [];
    setPartners(groupByPartner(sessions));
    setStats(computeStats(sessions));
  }, []);

  const weekPct = stats ? Math.min((stats.weekSessions / stats.weekGoal) * 100, 100) : 0;
  const goalReached = weekPct >= 100;

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-xl mx-auto w-full space-y-8">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Progress</h1>

        {/* ── Weekly momentum — primary module ── */}
        {stats && (
          <div className="bg-white border border-neutral-200 rounded-2xl px-7 py-6">

            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">This week</p>
                <div className="flex items-baseline gap-2">
                  <p className="font-serif font-bold text-[#171717] leading-none" style={{ fontSize: '2.5rem' }}>
                    {stats.weekSessions}
                  </p>
                  <p className="text-xl font-light text-stone-300">/ {stats.weekGoal}</p>
                </div>
                <p className="text-sm text-stone-400 mt-1">
                  session{stats.weekGoal === 1 ? '' : 's'}
                </p>
              </div>
              {goalReached && (
                <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                  Goal reached
                </span>
              )}
            </div>

            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${weekPct}%`,
                  background: goalReached ? '#10b981' : '#2B8FFF',
                }}
              />
            </div>

            <p className="text-sm text-stone-500 leading-relaxed mb-5">
              {weekMomentumSentence(stats.weekSessions, stats.weekGoal)}
            </p>

            {!goalReached && partners.length > 0 && (
              <button
                onClick={() => setModalPartner(partners[0].partnerName)}
                className="px-5 py-2.5 btn-primary text-white text-sm rounded-xl"
              >
                Schedule a session →
              </button>
            )}
          </div>
        )}

        {/* ── Supporting stats — quiet inline row ── */}
        {stats && (
          <div className="flex items-center gap-0 px-1">
            <div className="flex-1">
              <p className="font-semibold text-lg text-[#171717] leading-tight">{stats.streak}</p>
              <p className="text-xs text-stone-400 mt-0.5">Session streak</p>
            </div>
            <div className="w-px h-8 bg-stone-200 mx-6" />
            <div className="flex-1">
              <p className="font-semibold text-lg text-[#171717] leading-tight">{stats.totalSessions}</p>
              <p className="text-xs text-stone-400 mt-0.5">Total sessions</p>
            </div>
            <div className="w-px h-8 bg-stone-200 mx-6" />
            <div className="flex-1">
              <p className="font-semibold text-lg text-[#171717] leading-tight">{formatTotalTime(stats.totalMinutes)}</p>
              <p className="text-xs text-stone-400 mt-0.5">Practice time</p>
            </div>
          </div>
        )}

        {/* ── Exchange continuity ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Your exchanges</h2>

          {partners.length === 0 ? (
            <p className="text-sm text-stone-400 leading-relaxed">
              No sessions yet. Your exchange history will appear here after your first session.
            </p>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-stone-100">
              {partners.map(p => (
                <div key={p.partnerId || p.partnerName} className="px-6 py-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-stone-500">
                        {p.partnerName.trim().slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#171717] text-base leading-tight">{p.partnerName}</p>
                      <p className="text-sm text-stone-400 mt-0.5">
                        {p.sessionCount === 1
                          ? `First session · ${formatDate(p.lastDate)}`
                          : `${p.sessionCount} sessions together · Last ${formatDate(p.lastDate)}`}
                      </p>
                      {p.scheduledFor && (
                        <p className="text-xs font-medium text-emerald-600 mt-1.5">
                          Next session booked · {p.scheduledFor}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 ml-14">
                    <button
                      onClick={() => {
                        track('recording_cta_clicked', { partner_name: p.partnerName });
                        setRecordingModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 text-xs font-medium text-stone-500 rounded-xl hover:bg-stone-50 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Recording
                    </button>
                    {!p.scheduledFor && (
                      <button
                        onClick={() => setModalPartner(p.partnerName)}
                        className="px-4 py-2 btn-primary text-white text-xs font-semibold rounded-xl"
                      >
                        Schedule again →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* Recording coming soon modal */}
      {recordingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
          <div className="bg-white rounded-2xl px-6 py-6 w-full max-w-sm space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                <Video className="w-5 h-5 text-stone-400" />
              </div>
              <button onClick={() => setRecordingModal(false)} className="text-stone-400 hover:text-neutral-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <p className="font-bold text-neutral-900 text-base">Session recordings</p>
              <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                Review your sessions, read transcripts, and track your progress over time. Coming soon.
              </p>
            </div>
            <button
              onClick={() => setRecordingModal(false)}
              className="w-full py-3 bg-stone-100 hover:bg-stone-200 transition-colors text-neutral-700 font-semibold text-sm rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {modalPartner && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
          <div className="bg-white border border-stone-200 rounded-2xl px-5 py-5 w-full max-w-sm">
            <p className="font-bold text-neutral-900 mb-1">Keep the momentum going</p>
            <p className="text-sm text-stone-500 leading-relaxed">
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
