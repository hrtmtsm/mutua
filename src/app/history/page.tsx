'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { track } from '@/lib/analytics';
import { Video, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  lastDate:      string;
  scheduledFor?: string;
}

type RelationshipPhase = 'booked' | 'cooling' | 'dormant' | 'fresh' | 'no_partner';

interface RelationshipStatus {
  phase:            RelationshipPhase;
  partnerName:      string;
  daysSinceLast:    number | null;
  nextSessionAt:    Date | null;
  sessionsTogether: number;
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
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7)); // Monday
  return day;
}

function groupByPartner(sessions: SessionEntry[]): PartnerSummary[] {
  const map = new Map<string, PartnerSummary>();
  for (const s of sessions) {
    const key = s.partnerId || s.partnerName;
    if (map.has(key)) {
      const p = map.get(key)!;
      p.sessionCount++;
      p.totalDuration += s.duration;
      if (s.date > p.lastDate) p.lastDate = s.date;
    } else {
      map.set(key, {
        partnerName:   s.partnerName,
        partnerId:     s.partnerId,
        sessionCount:  1,
        totalDuration: s.duration,
        lastDate:      s.date,
        scheduledFor:  s.scheduledFor,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

function computeRelationship(sessions: SessionEntry[]): RelationshipStatus {
  // Resolve active partner name from storage
  let partnerName = '';
  const notifRaw = localStorage.getItem('mutua_last_notification');
  const notification = notifRaw ? JSON.parse(notifRaw) : null;
  if (notification?.partnerName) {
    partnerName = notification.partnerName;
  } else {
    const multiRaw = localStorage.getItem('mutua_partners');
    const matchRaw = localStorage.getItem('mutua_match');
    if (multiRaw) {
      partnerName = JSON.parse(multiRaw)[0]?.partner?.name ?? '';
    } else if (matchRaw) {
      partnerName = JSON.parse(matchRaw)?.partner?.name ?? '';
    }
  }

  if (!partnerName) return { phase: 'no_partner', partnerName: '', daysSinceLast: null, nextSessionAt: null, sessionsTogether: 0 };

  // Check for an upcoming booked session
  let nextSessionAt: Date | null = null;
  if (notification?.type === 'session_scheduled' && notification?.scheduledAt) {
    const d = new Date(notification.scheduledAt);
    if (d > new Date()) nextSessionAt = d;
  }

  // Find sessions with this partner
  const partnerSessions = sessions.filter(s => s.partnerName === partnerName);
  const sessionsTogether = partnerSessions.length;

  // Most recent session
  const sorted = [...partnerSessions].sort((a, b) => b.date.localeCompare(a.date));
  const lastDate = sorted[0] ? new Date(sorted[0].date) : null;
  const daysSinceLast = lastDate
    ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
    : null;

  if (nextSessionAt) return { phase: 'booked', partnerName, daysSinceLast, nextSessionAt, sessionsTogether };
  if (daysSinceLast === null) return { phase: 'fresh', partnerName, daysSinceLast: null, nextSessionAt: null, sessionsTogether: 0 };
  if (daysSinceLast >= 14) return { phase: 'dormant', partnerName, daysSinceLast, nextSessionAt: null, sessionsTogether };
  return { phase: 'cooling', partnerName, daysSinceLast, nextSessionAt: null, sessionsTogether };
}

function computeRhythm(sessions: SessionEntry[], freq: string): RhythmData {
  const weekGoal = frequencyToGoal(freq);
  const weekStart = getWeekStart(new Date());
  const thisWeekSessions = sessions.filter(s => new Date(s.date) >= weekStart).length;
  const thisWeekDone = thisWeekSessions >= weekGoal;

  // Count consecutive completed weeks (going backward from current)
  let weeksRunning = thisWeekDone ? 1 : 0;
  let cursor = new Date(weekStart);

  for (let i = 0; i < 52; i++) {
    const wEnd = new Date(cursor);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
    const wStart = cursor;
    const had = sessions.some(s => { const d = new Date(s.date); return d >= wStart && d < wEnd; });
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

// ── Sub-components ────────────────────────────────────────────────────────────

function PartnerAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-8 h-8 rounded-lg text-xs' : 'w-11 h-11 rounded-xl text-sm';
  return (
    <div className={`${cls} bg-stone-800 flex items-center justify-center shrink-0`}>
      <span className="font-bold text-white">{name.trim().slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

// ── Relationship module — primary ─────────────────────────────────────────────

function RelationshipModule({
  status,
  onSchedule,
  onMessage,
  onFindPartner,
}: {
  status:          RelationshipStatus;
  onSchedule:      () => void;
  onMessage:       () => void;
  onFindPartner:   () => void;
}) {
  const { phase, partnerName, daysSinceLast, nextSessionAt, sessionsTogether } = status;

  const sessionLabel = sessionsTogether === 0 ? null
    : sessionsTogether === 1 ? '1 session together'
    : `${sessionsTogether} sessions together`;

  const fmtNext = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (phase === 'no_partner') {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl px-7 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Your exchange</p>
        <p className="font-serif font-bold text-[#171717] text-xl mb-2">No active partner yet</p>
        <p className="text-sm text-stone-400 leading-relaxed">
          We'll notify you when we find your match.
        </p>
      </div>
    );
  }

  if (phase === 'booked' && nextSessionAt) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl px-7 py-6">
        <div className="flex items-center gap-3 mb-6">
          <PartnerAvatar name={partnerName} />
          <div>
            <p className="font-semibold text-[#171717] text-base leading-tight">{partnerName}</p>
            {sessionLabel && <p className="text-xs text-stone-400 mt-0.5">{sessionLabel}</p>}
          </div>
        </div>
        <p className="text-xs font-medium text-stone-400 mb-1.5">Next session</p>
        <p className="font-serif font-bold text-[#171717] text-2xl leading-tight mb-6">
          {fmtNext(nextSessionAt)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onMessage}
            className="px-4 py-2.5 border border-stone-200 text-sm text-neutral-500 font-medium rounded-xl hover:bg-stone-50 transition-colors"
          >
            Say hi 👋
          </button>
          <button className="px-5 py-2.5 btn-primary text-white text-sm rounded-xl">
            Start exchange →
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'fresh') {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl px-7 py-6">
        <div className="flex items-center gap-3 mb-5">
          <PartnerAvatar name={partnerName} />
          <div>
            <p className="font-semibold text-[#171717] text-base leading-tight">{partnerName}</p>
            <p className="text-xs text-stone-400 mt-0.5">Matched · no sessions yet</p>
          </div>
        </div>
        <p className="text-sm text-stone-500 leading-relaxed mb-5">
          Your exchange with <span className="font-medium text-neutral-700">{partnerName}</span> hasn't started yet. Book your first session.
        </p>
        <button onClick={onSchedule} className="px-5 py-2.5 btn-primary text-white text-sm rounded-xl">
          Schedule first session →
        </button>
      </div>
    );
  }

  if (phase === 'cooling') {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl px-7 py-6">
        <div className="flex items-center gap-3 mb-6">
          <PartnerAvatar name={partnerName} />
          <div>
            <p className="font-semibold text-[#171717] text-base leading-tight">{partnerName}</p>
            {sessionLabel && <p className="text-xs text-stone-400 mt-0.5">{sessionLabel}</p>}
          </div>
        </div>
        <p className="text-xs font-medium text-stone-400 mb-1.5">Last practiced together</p>
        <p className="font-serif font-bold text-[#171717] text-2xl leading-tight mb-1.5">
          {daysSinceLast} days ago
        </p>
        <p className="text-sm text-stone-400 mb-6">No next session booked.</p>
        <button onClick={onSchedule} className="px-5 py-2.5 btn-primary text-white text-sm rounded-xl">
          Schedule again →
        </button>
      </div>
    );
  }

  // dormant — mild urgency, amber border signal
  return (
    <div className="bg-white border border-amber-200 rounded-2xl px-7 py-6">
      <div className="flex items-center gap-3 mb-5">
        <PartnerAvatar name={partnerName} />
        <div>
          <p className="font-semibold text-[#171717] text-base leading-tight">{partnerName}</p>
          {sessionLabel && <p className="text-xs text-stone-400 mt-0.5">{sessionLabel}</p>}
        </div>
      </div>
      <p className="text-sm text-neutral-700 leading-relaxed mb-1">
        It's been <span className="font-semibold">{daysSinceLast} days</span> since your last exchange.
      </p>
      <p className="text-sm text-stone-400 mb-6">This connection may be fading.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={onSchedule} className="px-5 py-2.5 btn-primary text-white text-sm rounded-xl">
          Restart with {partnerName} →
        </button>
        <button
          onClick={onFindPartner}
          className="px-4 py-2.5 border border-stone-200 text-sm text-stone-400 rounded-xl hover:bg-stone-50 transition-colors"
        >
          Find a new partner
        </button>
      </div>
    </div>
  );
}

// ── Weekly rhythm — secondary ─────────────────────────────────────────────────

function WeeklyRhythm({ rhythm, onSchedule }: { rhythm: RhythmData; onSchedule: () => void }) {
  const { thisWeekSessions, thisWeekDone, weekGoal, weeksRunning } = rhythm;

  let statusNode: React.ReactNode;
  let streakText = '';

  if (thisWeekDone) {
    statusNode = <span className="text-sm font-semibold text-emerald-600">✓ Done</span>;
    if (weeksRunning > 1) streakText = `${weeksRunning} weeks running`;
  } else if (thisWeekSessions > 0) {
    statusNode = <span className="text-sm font-medium text-neutral-700">{thisWeekSessions} of {weekGoal}</span>;
    if (weeksRunning > 0) streakText = `${weeksRunning}-week rhythm at risk`;
  } else {
    statusNode = <span className="text-sm font-medium text-stone-400">Not yet</span>;
    if (weeksRunning >= 2) streakText = `${weeksRunning}-week rhythm at risk`;
    else if (weeksRunning === 1) streakText = 'keep your rhythm going';
  }

  return (
    <div className="flex items-center justify-between px-1">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1.5">This week</p>
        <div className="flex items-center gap-2 flex-wrap">
          {statusNode}
          {streakText && (
            <>
              <span className="text-stone-200 select-none">·</span>
              <span className="text-sm text-stone-400">{streakText}</span>
            </>
          )}
        </div>
      </div>
      {!thisWeekDone && (
        <button
          onClick={onSchedule}
          className="text-sm font-semibold text-[#2B8FFF] hover:text-blue-700 transition-colors shrink-0"
        >
          Schedule now →
        </button>
      )}
    </div>
  );
}

// ── Consistency graph — tertiary ──────────────────────────────────────────────

const GRAPH_WEEKS = 12;

function ConsistencyGraph({ grid }: { grid: boolean[] }) {
  const weekStart = getWeekStart(new Date());
  const gridStart = new Date(weekStart);
  gridStart.setDate(gridStart.getDate() - (GRAPH_WEEKS - 1) * 7);

  // Month label positions
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
    <div className="px-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Practice rhythm</p>
      <div className="flex gap-1.5 items-start">
        {/* Day labels — only M W F */}
        <div className="flex flex-col gap-1 pt-0.5 mr-0.5">
          {['M','','W','','F','',''].map((d, i) => (
            <div key={i} className="h-2.5 flex items-center">
              <span className="text-[9px] text-stone-300 font-medium w-2">{d}</span>
            </div>
          ))}
        </div>
        {/* Grid columns */}
        <div className="flex flex-col gap-1.5">
          {/* Month labels row */}
          <div className="flex gap-1.5 h-3 relative">
            {Array.from({ length: GRAPH_WEEKS }, (_, w) => {
              const label = monthLabels.find(m => m.col === w);
              return (
                <div key={w} className="w-2.5 relative">
                  {label && (
                    <span className="absolute left-0 text-[9px] text-stone-300 whitespace-nowrap">{label.label}</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Cells grid — 7 rows × GRAPH_WEEKS cols */}
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <div key={dayIdx} className="flex gap-1.5">
              {Array.from({ length: GRAPH_WEEKS }, (_, weekIdx) => {
                const active = grid[weekIdx * 7 + dayIdx] ?? false;
                return (
                  <div
                    key={weekIdx}
                    className={`w-2.5 h-2.5 rounded-sm ${active ? 'bg-[#2B8FFF]/70' : 'bg-stone-100'}`}
                  />
                );
              })}
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

  const [allPartners,    setAllPartners]    = useState<PartnerSummary[]>([]);
  const [relationship,   setRelationship]   = useState<RelationshipStatus | null>(null);
  const [rhythm,         setRhythm]         = useState<RhythmData | null>(null);
  const [grid,           setGrid]           = useState<boolean[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [modalPartner,   setModalPartner]   = useState<string | null>(null);
  const [recordingModal, setRecordingModal] = useState(false);

  useEffect(() => {
    const raw     = localStorage.getItem('mutua_history');
    const profile = localStorage.getItem('mutua_profile');
    const sessions: SessionEntry[] = raw ? JSON.parse(raw) : [];
    const freq = profile ? (JSON.parse(profile).practice_frequency ?? '') : '';

    setAllPartners(groupByPartner(sessions));
    setRelationship(computeRelationship(sessions));
    setRhythm(computeRhythm(sessions, freq));
    setGrid(buildConsistencyGrid(sessions, GRAPH_WEEKS));
  }, []);

  const handleSchedule = () => {
    if (relationship?.partnerName) setModalPartner(relationship.partnerName);
  };

  const hasAnySessions = grid.some(v => v);
  const historyToShow  = showAllHistory ? allPartners : allPartners.slice(0, 3);

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-xl mx-auto w-full space-y-8">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Progress</h1>

        {/* ── 1. Relationship status — primary ─────────────────── */}
        {relationship && (
          <RelationshipModule
            status={relationship}
            onSchedule={handleSchedule}
            onMessage={() => window.dispatchEvent(new Event('mutua:open-chat'))}
            onFindPartner={() => router.push('/app')}
          />
        )}

        {/* ── 2. Weekly rhythm — secondary ─────────────────────── */}
        {rhythm && (
          <WeeklyRhythm rhythm={rhythm} onSchedule={handleSchedule} />
        )}

        {/* ── 3. Consistency graph — tertiary (only if sessions exist) ── */}
        {hasAnySessions && (
          <ConsistencyGraph grid={grid} />
        )}

        {/* ── 4. History — demoted reference ───────────────────── */}
        {allPartners.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">Past exchanges</h2>
            <div>
              {historyToShow.map((p, i) => (
                <div
                  key={p.partnerId || p.partnerName}
                  className={`py-3.5 flex items-center gap-3 ${i < historyToShow.length - 1 ? 'border-b border-stone-100' : ''}`}
                >
                  <PartnerAvatar name={p.partnerName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-700 leading-tight">{p.partnerName}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Last: {formatDate(p.lastDate)} · {p.sessionCount} session{p.sessionCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => { track('recording_cta_clicked', { partner_name: p.partnerName }); setRecordingModal(true); }}
                      className="text-stone-300 hover:text-stone-500 transition-colors"
                      title="View recording"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setModalPartner(p.partnerName)}
                      className="text-xs font-semibold text-[#2B8FFF] hover:text-blue-700 transition-colors whitespace-nowrap"
                    >
                      Schedule again
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {allPartners.length > 3 && !showAllHistory && (
              <button
                onClick={() => setShowAllHistory(true)}
                className="mt-1 text-xs font-semibold text-stone-400 hover:text-neutral-700 transition-colors"
              >
                View all history →
              </button>
            )}
          </div>
        )}

      </main>

      {/* Recording modal */}
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
            <button onClick={() => setRecordingModal(false)} className="w-full py-3 bg-stone-100 hover:bg-stone-200 transition-colors text-neutral-700 font-semibold text-sm rounded-xl">
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
              <button onClick={() => setModalPartner(null)} className="flex-1 py-3 btn-primary text-white font-bold rounded-xl text-sm">
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
