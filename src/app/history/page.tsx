'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { track } from '@/lib/analytics';
import { X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionEntry {
  partnerName:  string;
  partnerId:    string;
  duration:     number;
  date:         string;
}

interface PartnerSummary {
  partnerName:  string;
  partnerId:    string;
  sessionCount: number;
  lastDate:     string;
}

interface RhythmData {
  thisWeekSessions: number;
  thisWeekDone:     boolean;
  weekGoal:         number;
  weeksRunning:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function frequencyToGoal(freq: string): number {
  if (freq.includes('twice') || freq.includes('2')) return 2;
  if (freq.includes('three') || freq.includes('3') || freq.includes('daily')) return 3;
  return 1;
}

function getWeekStart(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function groupByPartner(sessions: SessionEntry[]): PartnerSummary[] {
  const map = new Map<string, PartnerSummary>();
  for (const s of sessions) {
    const key = s.partnerId || s.partnerName;
    if (map.has(key)) {
      const p = map.get(key)!;
      p.sessionCount++;
      if (s.date > p.lastDate) p.lastDate = s.date;
    } else {
      map.set(key, { partnerName: s.partnerName, partnerId: s.partnerId, sessionCount: 1, lastDate: s.date });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function computeRhythm(sessions: SessionEntry[], freq: string): RhythmData {
  const weekGoal  = frequencyToGoal(freq);
  const weekStart = getWeekStart(new Date());
  const thisWeekSessions = sessions.filter(s => new Date(s.date) >= weekStart).length;
  const thisWeekDone = thisWeekSessions >= weekGoal;

  let weeksRunning = thisWeekDone ? 1 : 0;
  let cursor = new Date(weekStart);
  for (let i = 0; i < 52; i++) {
    const wEnd = new Date(cursor);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
    const had = sessions.some(s => { const d = new Date(s.date); return d >= cursor && d < wEnd; });
    if (!had) break;
    weeksRunning++;
  }

  return { thisWeekSessions, thisWeekDone, weekGoal, weeksRunning };
}

function buildConsistencyGrid(sessions: SessionEntry[], weeks = 12): boolean[] {
  const sessionDates = new Set(sessions.map(s => new Date(s.date).toDateString()));
  const weekStart = getWeekStart(new Date());
  const gridStart = new Date(weekStart);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return sessionDates.has(d.toDateString());
  });
}

// ── Consistency graph ─────────────────────────────────────────────────────────

const GRAPH_WEEKS = 24;

function ConsistencyGraph({ grid }: { grid: boolean[] }) {
  const weekStart = getWeekStart(new Date());
  const gridStart = new Date(weekStart);
  gridStart.setDate(gridStart.getDate() - (GRAPH_WEEKS - 1) * 7);

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < GRAPH_WEEKS; w++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + w * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: w, label: d.toLocaleDateString('en-US', { month: 'short' }) });
      lastMonth = m;
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Your practice rhythm</p>
      <div className="flex gap-1.5 items-start">
        {/* Day labels — M W F only */}
        <div className="flex flex-col gap-1.5 pt-0.5 mr-1">
          {['M','','W','','F','',''].map((label, i) => (
            <div key={i} className="h-3.5 flex items-center">
              <span className="text-[10px] text-stone-300 font-medium w-2">{label}</span>
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex flex-col gap-1.5">
          {/* Month labels */}
          <div className="flex gap-1.5 h-3.5">
            {Array.from({ length: GRAPH_WEEKS }, (_, w) => {
              const label = monthLabels.find(m => m.col === w);
              return (
                <div key={w} className="w-3.5 relative">
                  {label && <span className="absolute left-0 text-[10px] text-stone-300 whitespace-nowrap">{label.label}</span>}
                </div>
              );
            })}
          </div>
          {/* Cells */}
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div key={dayIdx} className="flex gap-1.5">
              {Array.from({ length: GRAPH_WEEKS }, (_, weekIdx) => (
                <div
                  key={weekIdx}
                  className={`w-3.5 h-3.5 rounded-sm ${
                    grid[weekIdx * 7 + dayIdx] ? 'bg-[#2B8FFF]/65' : 'bg-stone-100'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();

  const [partners,       setPartners]       = useState<PartnerSummary[]>([]);
  const [rhythm,         setRhythm]         = useState<RhythmData | null>(null);
  const [grid,           setGrid]           = useState<boolean[]>([]);
  const [showAll,        setShowAll]        = useState(false);
  const [scheduleModal,  setScheduleModal]  = useState<string | null>(null);
  const [reviewModal,    setReviewModal]    = useState<string | null>(null);

  useEffect(() => {
    const raw     = localStorage.getItem('mutua_history');
    const profile = localStorage.getItem('mutua_profile');
    const sessions: SessionEntry[] = raw ? JSON.parse(raw) : [];
    const freq = profile ? (JSON.parse(profile).practice_frequency ?? '') : '';

    setPartners(groupByPartner(sessions));
    setRhythm(computeRhythm(sessions, freq));
    setGrid(buildConsistencyGrid(sessions, GRAPH_WEEKS));
  }, []);

  if (!rhythm) return null;

  const { thisWeekSessions, thisWeekDone, weekGoal, weeksRunning } = rhythm;
  const hasAnySessions = grid.some(v => v);
  const visiblePartners = showAll ? partners : partners.slice(0, 3);

  // Weekly rhythm text
  let rhythmLine = '';
  if (thisWeekDone) {
    rhythmLine = weeksRunning > 1 ? `${weeksRunning} weeks running` : '';
  } else if (thisWeekSessions > 0) {
    rhythmLine = weekGoal > 1 ? `${thisWeekSessions} of ${weekGoal} this week` : '';
  } else if (weeksRunning >= 2) {
    rhythmLine = `${weeksRunning}-week rhythm at risk`;
  } else if (weeksRunning === 1) {
    rhythmLine = 'keep your rhythm going';
  }

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full">

        {/* Page title — quiet */}
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-10">Progress</p>

        {/* ── 1. Weekly Momentum — HERO ──────────────────────────── */}
        <section className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">This week</p>

          {/* Primary status — large serif */}
          <p
            className="font-serif font-bold text-[#171717] leading-none mb-2"
            style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)' }}
          >
            {thisWeekDone ? '✓ Done' : 'Not yet'}
          </p>

          {/* Secondary rhythm line */}
          {rhythmLine && (
            <p className="text-base text-stone-400">{rhythmLine}</p>
          )}

          {/* CTA — only when week is not complete */}
          {!thisWeekDone && (
            <button
              onClick={() => partners.length > 0 ? setScheduleModal(partners[0].partnerName) : router.push('/app')}
              className="mt-5 px-5 py-2.5 btn-primary text-white text-sm rounded-xl"
            >
              Schedule a session →
            </button>
          )}
        </section>

        {/* ── 2. Consistency graph — secondary ──────────────────── */}
        {hasAnySessions && (
          <section className="mb-14">
            <ConsistencyGraph grid={grid} />
          </section>
        )}

        {/* ── 3. Review your exchanges ───────────────────────────── */}
        {partners.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">Review your exchanges</p>
            <div>
              {visiblePartners.map((p, i) => (
                <div
                  key={p.partnerId || p.partnerName}
                  className={`py-4 flex items-center gap-3 ${i < visiblePartners.length - 1 ? 'border-b border-stone-100' : ''}`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-stone-500">
                      {p.partnerName.trim().slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-700 leading-tight">{p.partnerName}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Last: {formatDate(p.lastDate)} · {p.sessionCount} session{p.sessionCount === 1 ? '' : 's'}
                    </p>
                  </div>

                  {/* CTAs */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Primary: Review — tracked */}
                    <button
                      onClick={() => {
                        track('review_exchange_clicked', { partner_name: p.partnerName, session_count: p.sessionCount });
                        setReviewModal(p.partnerName);
                      }}
                      className="text-xs font-semibold text-[#2B8FFF] hover:text-blue-700 transition-colors whitespace-nowrap"
                    >
                      Review exchange →
                    </button>
                    {/* Secondary: Schedule */}
                    <button
                      onClick={() => setScheduleModal(p.partnerName)}
                      className="text-xs font-medium text-stone-400 hover:text-neutral-600 transition-colors whitespace-nowrap"
                    >
                      Schedule again
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {partners.length > 3 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-2 text-xs font-semibold text-stone-400 hover:text-neutral-700 transition-colors"
              >
                View all →
              </button>
            )}
          </section>
        )}

      </main>

      {/* Review exchange modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
          <div className="bg-white rounded-2xl px-6 py-6 w-full max-w-sm space-y-4">
            <div className="flex items-start justify-between">
              <p className="font-bold text-neutral-900 text-base">Review with {reviewModal}</p>
              <button onClick={() => setReviewModal(null)} className="text-stone-400 hover:text-neutral-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-stone-500 leading-relaxed">
              Session summaries, transcripts, and notes are on the way. You'll be able to review each exchange in detail soon.
            </p>
            <button
              onClick={() => setReviewModal(null)}
              className="w-full py-3 bg-stone-100 hover:bg-stone-200 transition-colors text-neutral-700 font-semibold text-sm rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
          <div className="bg-white border border-stone-200 rounded-2xl px-5 py-5 w-full max-w-sm">
            <p className="font-bold text-neutral-900 mb-1">Keep the momentum going</p>
            <p className="text-sm text-stone-500 leading-relaxed">
              We'll match you with {scheduleModal} again using your current schedule.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setScheduleModal(null)}
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
