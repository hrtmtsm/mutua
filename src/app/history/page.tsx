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

interface MonthBucket {
  label: string;   // "Jan", "Feb" …
  count: number;   // sessions that month
}

interface WeekBucket {
  label: string;   // "Mar 17"
  count: number;
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

// Build last 12 months of session counts
function buildMonthlyData(sessions: SessionEntry[]): MonthBucket[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const monthOffset = 11 - i;
    const start = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 1);
    const count = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; }).length;
    return { label: start.toLocaleDateString('en-US', { month: 'short' }), count };
  });
}

// Build last 16 weeks of session counts
function buildWeeklyData(sessions: SessionEntry[]): WeekBucket[] {
  const weekStart = getWeekStart(new Date());
  return Array.from({ length: 16 }, (_, i) => {
    const offset = 15 - i;
    const start  = new Date(weekStart);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; }).length;
    const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { label, count };
  });
}

// ── Rhythm chart component (monthly / weekly toggle) ─────────────────────────

function RhythmChart({ sessions }: { sessions: SessionEntry[] }) {
  const [view, setView] = useState<'monthly' | 'weekly'>('monthly');
  const months = buildMonthlyData(sessions);
  const weeks  = buildWeeklyData(sessions);
  const buckets = view === 'monthly' ? months : weeks;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-7 py-6">
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">Your practice rhythm</p>
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-0.5">
          <button
            onClick={() => setView('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              view === 'monthly' ? 'bg-white text-neutral-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setView('weekly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              view === 'weekly' ? 'bg-white text-neutral-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>
      <div className="flex items-end gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {buckets.map((b, i) => {
          const filled  = b.count > 0;
          const opacity = filled ? Math.max(0.35, b.count / maxCount) : 0;
          // Show every label in monthly, every other in weekly to avoid crowding
          const showLabel = view === 'monthly' || i % 2 === 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2" style={{ minWidth: view === 'weekly' ? 28 : undefined }}>
              <div className="w-full rounded-md bg-stone-100 overflow-hidden" style={{ height: 48 }}>
                <div
                  className="w-full rounded-md transition-all duration-500"
                  style={{
                    height: filled ? `${Math.max(28, (b.count / maxCount) * 48)}px` : '0px',
                    background: `rgba(43,143,255,${opacity + 0.2})`,
                    marginTop: 'auto',
                  }}
                />
              </div>
              <span className="text-[10px] text-stone-400 font-medium whitespace-nowrap">
                {showLabel ? b.label : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const router = useRouter();

  const [partners,      setPartners]      = useState<PartnerSummary[]>([]);
  const [rhythm,        setRhythm]        = useState<RhythmData | null>(null);
  const [sessions,      setSessions]      = useState<SessionEntry[]>([]);
  const [showAll,       setShowAll]       = useState(false);
  const [scheduleModal, setScheduleModal] = useState<string | null>(null);
  const [reviewModal,   setReviewModal]   = useState<string | null>(null);

  useEffect(() => {
    const raw     = localStorage.getItem('mutua_history');
    const profile = localStorage.getItem('mutua_profile');
    const parsed: SessionEntry[] = raw ? JSON.parse(raw) : [];
    const freq = profile ? (JSON.parse(profile).practice_frequency ?? '') : '';

    setSessions(parsed);
    setPartners(groupByPartner(parsed));
    setRhythm(computeRhythm(parsed, freq));
  }, []);

  if (!rhythm) return null;

  const { thisWeekSessions, thisWeekDone, weekGoal, weeksRunning } = rhythm;
  const hasAnySessions = sessions.length > 0;
  const visiblePartners = showAll ? partners : partners.slice(0, 3);

  // Weekly rhythm supporting line
  let rhythmLine = '';
  if (thisWeekDone && weeksRunning > 1) {
    rhythmLine = `${weeksRunning} weeks running`;
  } else if (!thisWeekDone && thisWeekSessions > 0 && weekGoal > 1) {
    rhythmLine = `${thisWeekSessions} of ${weekGoal} sessions this week`;
  } else if (!thisWeekDone && weeksRunning >= 2) {
    rhythmLine = `${weeksRunning}-week rhythm at risk`;
  } else if (!thisWeekDone && weeksRunning === 1) {
    rhythmLine = 'keep your rhythm going';
  }

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">

        {/* Page title — matches Exchanges page */}
        <div>
          <h1 className="font-serif font-semibold text-2xl text-[#171717]">Progress</h1>
          <p className="text-sm text-stone-400 mt-1">
            {thisWeekDone ? 'You\'re on track this week.' : 'Keep your practice going.'}
          </p>
        </div>

        {/* ── 1. This week ─────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl px-7 py-6">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-4">This week</p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-serif font-semibold text-[#171717] text-xl leading-tight">
                {thisWeekDone ? '✓ Done' : 'Not yet'}
              </p>
              {rhythmLine && (
                <p className="text-sm text-stone-400 mt-1">{rhythmLine}</p>
              )}
            </div>
            {!thisWeekDone && (
              <button
                onClick={() => partners.length > 0 ? setScheduleModal(partners[0].partnerName) : router.push('/app')}
                className="px-5 py-2.5 btn-primary text-white text-sm rounded-xl shrink-0"
              >
                Schedule a session →
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Monthly rhythm ────────────────────────────────── */}
        {hasAnySessions && <RhythmChart sessions={sessions} />}

        {/* ── 3. Review your exchanges ─────────────────────────── */}
        {partners.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">Review your exchanges</p>

            {visiblePartners.map(p => (
              <div
                key={p.partnerId || p.partnerName}
                className="bg-white border border-stone-200 rounded-2xl px-6 py-5"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">
                      {p.partnerName.trim().slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#171717] text-base leading-tight">{p.partnerName}</p>
                    <p className="text-sm text-stone-400 mt-0.5">
                      Last: {formatDate(p.lastDate)} · {p.sessionCount} session{p.sessionCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      track('review_exchange_clicked', { partner_name: p.partnerName, session_count: p.sessionCount });
                      setReviewModal(p.partnerName);
                    }}
                    className="px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
                  >
                    Review exchange →
                  </button>
                  <button
                    onClick={() => setScheduleModal(p.partnerName)}
                    className="px-4 py-2.5 border border-stone-200 text-sm font-medium text-stone-500 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    Schedule again
                  </button>
                </div>
              </div>
            ))}

            {partners.length > 3 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="text-xs font-semibold text-stone-400 hover:text-neutral-700 transition-colors"
              >
                View all →
              </button>
            )}
          </div>
        )}

      </main>

      {/* Review modal */}
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
            <button onClick={() => setReviewModal(null)} className="w-full py-3 bg-stone-100 hover:bg-stone-200 transition-colors text-neutral-700 font-semibold text-sm rounded-xl">
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
              <button onClick={() => setScheduleModal(null)} className="flex-1 py-3 btn-primary text-white font-bold rounded-xl text-sm">
                Sounds good
              </button>
              <button onClick={() => router.push('/set-availability')} className="flex-1 py-3 border border-stone-200 bg-white text-stone-500 font-medium rounded-xl text-sm hover:bg-stone-100 transition-colors">
                Update schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
