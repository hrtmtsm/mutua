'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { LANG_FLAGS } from '@/lib/constants';
import { ArrowLeftRight } from 'lucide-react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionEntry {
  partnerName:  string;
  partnerId:    string;
  duration:     number;
  date:         string;
  missed?:      boolean;
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

// ── GitHub-style consistency grid ────────────────────────────────────────────

const WEEKS = 20; // ~5 months visible
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// 4-level intensity: 0 = empty, 1 = light, 2 = medium, 3 = strong
const INTENSITY_COLORS = ['#E5E5E5', '#BFDBFE', '#60A5FA', '#1D4ED8'];

const GREETINGS: Record<string, string> = {
  spanish: 'Hola 👋', french: 'Bonjour 👋', japanese: 'こんにちは 👋',
  portuguese: 'Olá 👋', german: 'Hallo 👋', italian: 'Ciao 👋',
  korean: '안녕하세요 👋', mandarin: '你好 👋', chinese: '你好 👋', arabic: 'مرحبا 👋',
};

interface DayData    { count: number; totalDuration: number; partners: string[]; }
interface TooltipPos { key: string; x: number; y: number; }

const SHIFT      = 4;   // ~1 month per arrow click
const MAX_OFFSET = 260; // up to 5 years back

function RhythmChart({ sessions, targetLang }: { sessions: SessionEntry[]; targetLang: string }) {
  const [tooltip,    setTooltip]    = useState<TooltipPos | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = present, positive = further back

  // Aggregate per-day
  const dayMap = new Map<string, DayData>();
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    const d = dayMap.get(key);
    if (d) {
      d.count++;
      d.totalDuration += s.duration ?? 0;
      if (!d.partners.includes(s.partnerName)) d.partners.push(s.partnerName);
    } else {
      dayMap.set(key, { count: 1, totalDuration: s.duration ?? 0, partners: [s.partnerName] });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Shift the window back by weekOffset weeks
  const windowEnd = getWeekStart(today);
  windowEnd.setDate(windowEnd.getDate() - weekOffset * 7);
  const gridStart = new Date(windowEnd);
  gridStart.setDate(gridStart.getDate() - (WEEKS - 1) * 7);

  const grid: { date: Date; key: string }[][] = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      return { date, key: date.toISOString().slice(0, 10) };
    })
  );

  const monthLabels: { col: number; label: string }[] = [];
  let lastLabeledYear = -1;
  grid.forEach((week, wi) => {
    const firstDay = week[0].date;
    if (wi === 0 || firstDay.getDate() <= 7) {
      const month = firstDay.toLocaleDateString('en-US', { month: 'short' });
      const year  = firstDay.getFullYear();
      // Show year on Jan or whenever the year changes within the view
      const showYear = year !== lastLabeledYear && (firstDay.getMonth() === 0 || wi === 0);
      if (showYear) lastLabeledYear = year;
      const label = showYear ? `${month} '${String(year).slice(2)}` : month;
      monthLabels.push({ col: wi, label });
    }
  });

  // Per-month totals for visible months
  const monthTotals = monthLabels.map(ml => {
    const ref   = grid[ml.col][0].date;
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const min   = sessions
      .filter(s => { const d = new Date(s.date); return d >= start && d < end; })
      .reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const count = sessions.filter(s => { const d = new Date(s.date); return d >= start && d < end; }).length;
    return { ...ml, min, count };
  });

  const visibleTotal = monthTotals.reduce((sum, m) => sum + m.min, 0);

  const tooltipData = tooltip ? (dayMap.get(tooltip.key) ?? null) : null;
  const greeting    = GREETINGS[targetLang.toLowerCase()] ?? '';

  const canGoBack    = weekOffset < MAX_OFFSET;
  const canGoForward = weekOffset > 0;

  // Arrow button style
  const arrowCls = "flex items-center justify-center w-7 h-7 rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 transition-colors shrink-0";

  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-4 py-5">

      {/* ← grid → */}
      <div className="flex items-center gap-1">
        {/* Left arrow */}
        <button
          onClick={() => { setWeekOffset(o => Math.min(o + SHIFT, MAX_OFFSET)); setTooltip(null); }}
          disabled={!canGoBack}
          className={`${arrowCls} ${!canGoBack ? 'opacity-20 pointer-events-none' : ''}`}
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Day labels + grid */}
        <div className="flex gap-1.5 flex-1 min-w-0">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-1.5 shrink-0 mt-5">
            {DAY_LABELS.map((l, i) => (
              <div key={i} className="flex items-center" style={{ height: 'calc((100% - 6px * 6) / 7)' }}>
                <span className="text-[10px] text-stone-400 font-medium w-3 text-right leading-none">
                  {i % 2 === 0 ? l : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Grid columns */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {/* Month labels */}
            <div className="h-9" style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: '6px' }}>
              {grid.map((_, wi) => {
                const ml = monthLabels.find(m => m.col === wi);
                return (
                  <div key={wi} className="flex items-center overflow-visible">
                    {ml && <span className="text-[10px] text-stone-400 font-medium whitespace-nowrap">{ml.label}</span>}
                  </div>
                );
              })}
            </div>

            {/* Day cells */}
            {Array.from({ length: 7 }, (_, di) => (
              <div key={di} style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: '6px' }}>
                {grid.map((week, wi) => {
                  const { date, key } = week[di];
                  const isFuture = date > today;
                  const data     = isFuture ? null : (dayMap.get(key) ?? null);
                  let intensity  = 0;
                  if (data) {
                    const dur = data.totalDuration;
                    if      (dur >= 30)       intensity = 3;
                    else if (dur >= 15)       intensity = 2;
                    else if (dur >  0)        intensity = 1;
                    else if (data.count >= 3) intensity = 3;
                    else if (data.count >= 2) intensity = 2;
                    else                      intensity = 1;
                  }
                  return (
                    <div
                      key={wi}
                      className="rounded-[3px] aspect-square"
                      style={{ background: INTENSITY_COLORS[intensity], cursor: data ? 'default' : undefined }}
                      onMouseEnter={e => { if (data) setTooltip({ key, x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}

            {/* Per-month totals row — always rendered to hold height */}
            <div className="mt-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: '6px' }}>
              {grid.map((_, wi) => {
                const mt = monthTotals.find(m => m.col === wi);
                const label = mt && mt.min > 0 ? `${mt.min}m` : mt && mt.count > 0 ? `${mt.count}×` : '';
                return (
                  <div key={wi} className="h-4 overflow-visible">
                    {label && (
                      <span className="text-[10px] text-stone-400 whitespace-nowrap">{label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => { setWeekOffset(o => Math.max(0, o - SHIFT)); setTooltip(null); }}
          disabled={!canGoForward}
          className={`${arrowCls} ${!canGoForward ? 'opacity-20 pointer-events-none' : ''}`}
          aria-label="Go forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Total — always rendered to hold height */}
      <p className="text-xs text-stone-400 mt-2 text-right h-4">
        {visibleTotal > 0 ? `${visibleTotal} min total` : ''}
      </p>

      {/* Tooltip */}
      {tooltip && tooltipData && (
        <div
          className="fixed z-50 bg-white border border-stone-200 rounded-xl px-3 py-3 pointer-events-none min-w-[120px]"
          style={{ left: tooltip.x + 14, top: tooltip.y - 80, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
        >
          {/* Date */}
          <p className="font-semibold text-neutral-800 text-xs mb-2">
            {new Date(tooltip.key + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>

          {/* Partner avatars */}
          <div className="flex items-center gap-1 mb-2">
            {tooltipData.partners.slice(0, 4).map((name, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center shrink-0"
                style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i, position: 'relative' }}
              >
                <span className="text-[9px] font-bold text-white leading-none">
                  {name.trim().slice(0, 2).toUpperCase()}
                </span>
              </div>
            ))}
            {tooltipData.partners.length > 4 && (
              <span className="text-[10px] text-stone-400 ml-1">+{tooltipData.partners.length - 4}</span>
            )}
          </div>

          {/* Duration */}
          <p className="text-[11px] text-stone-400">
            {tooltipData.totalDuration > 0
              ? `${tooltipData.totalDuration} min`
              : `${tooltipData.count} session${tooltipData.count !== 1 ? 's' : ''}`}
          </p>

          {/* Language greeting */}
          {greeting && <p className="text-[10px] text-stone-300 mt-1">{greeting}</p>}
        </div>
      )}
    </div>
  );
}

function PartnerAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0">
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-white">{name.trim().slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

function SessionCard({
  displayName, avatarUrl, nativeLang, myLang,
  sessionDate, duration, missed, matchId, onReview, onSchedule,
}: {
  displayName:  string;
  avatarUrl:    string | null;
  nativeLang:   string;
  myLang:       string;
  sessionDate:  string;
  duration:     number;
  missed?:      boolean;
  matchId:      string | null;
  onReview:     () => void;
  onSchedule:   () => void;
}) {
  const router = useRouter();
  const [showOverflow, setShowOverflow] = useState(false);

  const dateLabel = new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const durationLabel = duration > 0 ? `${duration} min` : null;

  return (
    <div className={`bg-white border rounded-2xl px-6 py-5 ${missed ? 'border-stone-200 opacity-70' : 'border-stone-200'}`}>
      {missed && (
        <div className="mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-400">
            Missed :(
          </span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <PartnerAvatar name={displayName} avatarUrl={avatarUrl} />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#171717] text-base leading-tight truncate">{displayName}</p>
          {nativeLang && myLang && (
            <div className="flex items-center gap-1 mt-0.5 text-sm text-stone-400">
              <span>{LANG_FLAGS[nativeLang] ?? ''} {nativeLang}</span>
              <ArrowLeftRight size={11} className="shrink-0" />
              <span>{LANG_FLAGS[myLang] ?? ''} {myLang}</span>
            </div>
          )}
          <p className="text-xs text-stone-400 mt-0.5">
            {dateLabel}{durationLabel ? ` · ${durationLabel}` : ''}
          </p>
        </div>

        {/* Three-dot menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowOverflow(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/>
            </svg>
          </button>
          {showOverflow && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
              <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-lg border border-stone-100 py-1 w-36 text-sm">
                {matchId && (
                  <button
                    onClick={() => { setShowOverflow(false); router.push(`/partner/${matchId}`); }}
                    className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50"
                  >
                    View profile
                  </button>
                )}
                <button
                  onClick={() => { setShowOverflow(false); window.dispatchEvent(new Event('mutua:open-chat')); }}
                  className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50"
                >
                  Say hi 👋
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {!missed && (
          <button onClick={onReview} className="px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl">
            Review session →
          </button>
        )}
        <button onClick={onSchedule} className={`px-4 py-2.5 text-sm font-semibold rounded-xl ${missed ? 'btn-primary text-white' : 'border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors'}`}>
          Schedule again
        </button>
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
  const [targetLang,    setTargetLang]    = useState('');
  const [showAll,       setShowAll]       = useState(false);
  const [scheduleModal, setScheduleModal] = useState<string | null>(null);
  const [reviewModal,   setReviewModal]   = useState<string | null>(null);
  const [myLang,        setMyLang]        = useState('');
  // Live partner profiles keyed by partnerId
  const [liveProfiles,  setLiveProfiles]  = useState<Record<string, {
    name:       string;
    avatarUrl:  string | null;
    nativeLang: string;
    matchId:    string | null;
  }>>({});

  useEffect(() => {
    const raw     = localStorage.getItem('mutua_history');
    const profile = localStorage.getItem('mutua_profile');
    const parsed: SessionEntry[] = raw ? JSON.parse(raw) : [];
    const prof = profile ? JSON.parse(profile) : {};
    const freq = prof.practice_frequency ?? '';

    setSessions(parsed);
    const grouped = groupByPartner(parsed);
    setPartners(grouped);
    setRhythm(computeRhythm(parsed, freq));
    setTargetLang(prof.target_language ?? '');
    setMyLang(prof.native_language ?? '');

    // Fetch live name + avatar for each partner from Supabase
    const ids = grouped.map(p => p.partnerId).filter(Boolean);
    if (ids.length === 0) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const mySid = localStorage.getItem('mutua_session_id') ?? '';

    // Fetch partner profiles + their match IDs in parallel
    Promise.all([
      supabase.from('profiles').select('session_id, name, avatar_url, native_language').in('session_id', ids),
      supabase.from('matches').select('id, session_id_a, session_id_b')
        .or(ids.map(id => `session_id_a.eq.${id},session_id_b.eq.${id}`).join(',')),
    ]).then(([{ data: profiles }, { data: matches }]) => {
      if (!profiles) return;
      // Build partnerId → matchId lookup
      const matchMap: Record<string, string> = {};
      for (const m of (matches ?? [])) {
        const partnerId = m.session_id_a === mySid ? m.session_id_b : m.session_id_a;
        if (!matchMap[partnerId]) matchMap[partnerId] = m.id;
      }
      const map: Record<string, { name: string; avatarUrl: string | null; nativeLang: string; matchId: string | null }> = {};
      for (const row of profiles) {
        const avatarUrl = row.avatar_url
          ?? `${supabaseUrl}/storage/v1/object/public/avatars/${row.session_id}.jpg`;
        map[row.session_id] = {
          name:       row.name ?? '',
          avatarUrl,
          nativeLang: row.native_language ?? '',
          matchId:    matchMap[row.session_id] ?? null,
        };
      }
      setLiveProfiles(map);
    });
  }, []);

  if (!rhythm) return null;

  const { thisWeekSessions, thisWeekDone, weekGoal, weeksRunning } = rhythm;
  const hasAnySessions = sessions.length > 0;
  // Sessions sorted newest-first for the card list
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const visibleSessions = showAll ? sortedSessions : sortedSessions.slice(0, 5);


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
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-500">This week</p>
        <div className="bg-white border border-stone-200 rounded-2xl px-7 py-6">
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
        </div>

        {/* ── 2. Practice rhythm ───────────────────────────────── */}
        {hasAnySessions && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-500">Recent practice</p>
            <RhythmChart sessions={sessions} targetLang={targetLang} />
          </div>
        )}

        {/* ── 3. Your exchanges ────────────────────────────────── */}
        {sortedSessions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-500">Your exchanges</p>
            <div className="space-y-3">

            {visibleSessions.map((s, i) => {
              const live        = liveProfiles[s.partnerId];
              const displayName = live?.name || s.partnerName;
              const avatarUrl   = live?.avatarUrl ?? null;
              const nativeLang  = live?.nativeLang ?? '';
              const matchId     = live?.matchId ?? null;
              return (
                <SessionCard
                  key={`${s.partnerId}-${s.date}-${i}`}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                  nativeLang={nativeLang}
                  myLang={myLang}
                  sessionDate={s.date}
                  duration={s.duration}
                  missed={s.missed}
                  matchId={matchId}
                  onReview={() => { track('review_session_clicked', { partner_name: displayName }); setReviewModal(displayName); }}
                  onSchedule={() => setScheduleModal(s.partnerName)}
                />
              );
            })}

            {sortedSessions.length > 5 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="text-xs font-semibold text-stone-400 hover:text-neutral-700 transition-colors"
              >
                View all {sortedSessions.length} sessions →
              </button>
            )}
            </div>
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
