'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
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

interface PartnerStats {
  partnerId:    string;
  partnerName:  string;
  sessionCount: number;
  totalMin:     number;
  streak:       number;   // consecutive weeks with ≥1 session
  lastDate:     string;   // ISO
  daysSinceLast: number;
}

function computePartnerStats(sessions: SessionEntry[]): PartnerStats[] {
  // Group ALL sessions (including missed) so every partner appears
  const map = new Map<string, SessionEntry[]>();
  for (const s of sessions) {
    const key = s.partnerId || s.partnerName;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  const now = new Date();
  const stats: PartnerStats[] = [];

  for (const [key, pSessions] of map.entries()) {
    const allSorted       = [...pSessions].sort((a, b) => b.date.localeCompare(a.date));
    const completed       = allSorted.filter(s => !s.missed);
    const totalMin        = completed.reduce((s, x) => s + (x.duration ?? 0), 0);
    // recency from any session (including missed — it still means contact was attempted)
    const lastDate        = allSorted[0].date;
    const daysSinceLast   = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);

    // Streak based only on completed sessions
    const weekKeys = new Set(completed.map(s => localKey(getWeekStart(new Date(s.date)))));
    let streak = 0;
    const cursor = getWeekStart(new Date());
    for (let i = 0; i < 52; i++) {
      const k = localKey(cursor);
      if (weekKeys.has(k)) {
        streak++;
        cursor.setDate(cursor.getDate() - 7);
      } else {
        if (i === 0) { cursor.setDate(cursor.getDate() - 7); continue; }
        break;
      }
    }

    stats.push({
      partnerId:    key,
      partnerName:  allSorted[0].partnerName,
      sessionCount: completed.length,
      totalMin,
      streak,
      lastDate,
      daysSinceLast,
    });
  }

  // Sort: highest streak → most recent → deepest history
  return stats.sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    if (a.daysSinceLast !== b.daysSinceLast) return a.daysSinceLast - b.daysSinceLast;
    return b.sessionCount - a.sessionCount;
  });
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

interface DayData    { count: number; totalDuration: number; partners: string[]; partnerIds: string[]; }
interface TooltipPos { key: string; x: number; y: number; }

const SHIFT      = 4;   // ~1 month per arrow click
const MAX_OFFSET = 260; // up to 5 years back

function TooltipAvatar({ name, avatarUrl, nativeLang, index }: { name: string; avatarUrl: string | null; nativeLang: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const bg = LANG_AVATAR_COLOR[nativeLang] ?? '#3b82f6';
  const initials = name.trim().split(/\s+/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden shrink-0 border-2 border-white flex items-center justify-center relative"
      style={{ marginLeft: index > 0 ? -8 : 0, zIndex: 4 - index, backgroundColor: bg }}
    >
      <span className="text-[9px] font-bold text-white leading-none">{initials}</span>
      {avatarUrl && !failed && (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover absolute inset-0"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function RhythmChart({ sessions, targetLang, liveProfiles }: {
  sessions: SessionEntry[];
  targetLang: string;
  liveProfiles: Record<string, { name: string; avatarUrl: string | null; nativeLang: string; matchId: string | null }>;
}) {
  const [tooltip,    setTooltip]    = useState<TooltipPos | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = present, positive = further back
  const [weeks,      setWeeks]      = useState(20);

  useEffect(() => {
    const update = () => setWeeks(window.innerWidth < 640 ? 8 : 20);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Aggregate per-day
  const dayMap = new Map<string, DayData>();
  for (const s of sessions) {
    const key = localKey(new Date(s.date));
    const d = dayMap.get(key);
    if (d) {
      d.count++;
      d.totalDuration += s.duration ?? 0;
      if (!d.partners.includes(s.partnerName)) d.partners.push(s.partnerName);
      if (s.partnerId && !d.partnerIds.includes(s.partnerId)) d.partnerIds.push(s.partnerId);
    } else {
      dayMap.set(key, { count: 1, totalDuration: s.duration ?? 0, partners: [s.partnerName], partnerIds: s.partnerId ? [s.partnerId] : [] });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Shift the window back by weekOffset weeks
  const windowEnd = getWeekStart(today);
  windowEnd.setDate(windowEnd.getDate() - weekOffset * 7);
  const gridStart = new Date(windowEnd);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

  const grid: { date: Date; key: string }[][] = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      return { date, key: localKey(date) };
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
          onClick={() => { setWeekOffset(o => Math.min(o + (weeks <= 8 ? 4 : SHIFT), MAX_OFFSET)); setTooltip(null); }}
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
            <div className="h-9" style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: '6px' }}>
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
              <div key={di} style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: '6px' }}>
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
            <div className="mt-1" style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: '6px' }}>
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
          onClick={() => { setWeekOffset(o => Math.max(0, o - (weeks <= 8 ? 4 : SHIFT))); setTooltip(null); }}
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
          <div className="flex items-center mb-2">
            {tooltipData.partnerIds.slice(0, 4).map((pid, i) => {
              const live = liveProfiles[pid];
              const name = live?.name ?? tooltipData.partners[i] ?? '?';
              const avatarUrl = live?.avatarUrl ?? null;
              const nativeLang = live?.nativeLang ?? '';
              return (
                <TooltipAvatar key={i} name={name} avatarUrl={avatarUrl} nativeLang={nativeLang} index={i} />
              );
            })}
            {tooltipData.partners.length > 4 && (
              <span className="text-[10px] text-stone-400 ml-2">+{tooltipData.partners.length - 4}</span>
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

function PartnerRelationshipCard({ stats, live }: {
  stats: PartnerStats;
  live?: { name: string; avatarUrl: string | null; nativeLang: string; matchId: string | null };
}) {
  const name       = live?.name || stats.partnerName;
  const avatarUrl  = live?.avatarUrl ?? null;
  const nativeLang = live?.nativeLang ?? '';

  // Status label — one per card max, priority: consistent > new > fading > none
  let status: { emoji: string; label: string; cls: string } | null = null;
  if (stats.streak >= 2) {
    status = { emoji: '🔥', label: 'Most consistent', cls: 'text-orange-500' };
  } else if (stats.sessionCount <= 2 && stats.daysSinceLast <= 14) {
    status = { emoji: '🆕', label: 'Recently started', cls: 'text-blue-500' };
  } else if (stats.daysSinceLast >= 14) {
    status = { emoji: '🌱', label: 'Fading', cls: 'text-stone-400' };
  }

  // Strongest relationship fact line
  const factLine = stats.streak >= 2
    ? `${stats.streak} weeks in a row · ${stats.sessionCount} sessions together`
    : `${stats.sessionCount} session${stats.sessionCount !== 1 ? 's' : ''} together`;

  // Recency line
  let recencyLine: string;
  if (stats.daysSinceLast === 0)      recencyLine = 'Last talked today';
  else if (stats.daysSinceLast === 1) recencyLine = 'Last talked yesterday';
  else                                recencyLine = `Last talked ${stats.daysSinceLast} days ago`;

  const fading = stats.daysSinceLast >= 14;

  return (
    <div className={`bg-white border border-stone-200 rounded-2xl px-4 py-4 flex items-center gap-3 transition-opacity ${fading && !status?.label.includes('consistent') ? 'opacity-60' : ''}`}>
      <PartnerAvatar name={name} avatarUrl={avatarUrl} nativeLang={nativeLang} />
      <div className="flex-1 min-w-0">
        {status && (
          <p className={`text-[11px] font-semibold mb-0.5 ${status.cls}`}>
            {status.emoji} {status.label}
          </p>
        )}
        <p className="font-semibold text-[#171717] text-sm truncate">{name}</p>
        <p className="text-xs text-stone-500 mt-0.5">{factLine}</p>
        <p className="text-xs text-stone-400 mt-0.5">{recencyLine}</p>
      </div>
    </div>
  );
}

function PartnerAvatar({ name, avatarUrl, nativeLang }: { name: string; avatarUrl: string | null; nativeLang?: string }) {
  const [failed, setFailed] = useState(false);
  const bg = LANG_AVATAR_COLOR[nativeLang ?? ''] ?? '#3b82f6';
  const initials = name.trim().split(/\s+/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center relative"
      style={{ backgroundColor: bg }}
    >
      <span className="text-sm font-bold text-white">{initials}</span>
      {avatarUrl && !failed && (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          style={{ position: 'absolute', inset: 0 }}
          onError={() => setFailed(true)}
        />
      )}
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
        <PartnerAvatar name={displayName} avatarUrl={avatarUrl} nativeLang={nativeLang} />

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
  const [scheduleModal, setScheduleModal] = useState<{ name: string; partnerId: string } | null>(null);
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
  const partnerStats = computePartnerStats(sessions);
  // Sessions sorted newest-first for the card list
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const visibleSessions = showAll ? sortedSessions : sortedSessions.slice(0, 5);


  // Best partner for relationship-based copy (highest streak, then most recent)
  const topPartner      = partnerStats[0] ?? null;
  const topPartnerName  = topPartner ? (liveProfiles[topPartner.partnerId]?.name || topPartner.partnerName) : null;
  const topStreak       = topPartner?.streak ?? 0;
  const hasStreak       = topStreak >= 2;

  // Weekly check-in copy
  let weekHeadline: string;
  let weekSubline: string | null = null;
  let weekCta: string | null     = null;

  if (thisWeekDone) {
    weekHeadline = 'You practiced this week';
    if (hasStreak && topPartnerName) {
      weekSubline = `🔥 ${weeksRunning > 1 ? `${weeksRunning} weeks` : 'Going'} in a row with ${topPartnerName}`;
    }
  } else if (hasStreak && topPartnerName) {
    weekHeadline = 'You haven\'t practiced yet this week';
    weekSubline  = `Don't break your streak with ${topPartnerName} 🔥`;
    weekCta      = `Schedule with ${topPartnerName} →`;
  } else if (!hasAnySessions) {
    weekHeadline = 'You haven\'t practiced yet this week';
    weekCta      = 'Let\'s get your first session in →';
  } else {
    weekHeadline = 'You haven\'t practiced yet this week';
    weekCta      = 'Schedule a session →';
  }

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">

        {/* Page title — matches Exchanges page */}
        <div>
          <h1 className="font-serif font-semibold text-2xl text-[#171717]">Progress</h1>
          <p className="text-sm text-stone-400 mt-1">
            {thisWeekDone ? 'Your exchange is going well.' : 'Keep your exchange going.'}
          </p>
        </div>

        {/* ── 1. This week ─────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-500">This week</p>
          <div className="bg-white border border-stone-200 rounded-2xl px-7 py-6">
            <p className="font-semibold text-[#171717] text-base leading-snug">
              {weekHeadline}
            </p>
            {weekSubline && (
              <p className="text-sm text-stone-500 mt-1">{weekSubline}</p>
            )}
            {weekCta && (
              <button
                onClick={() => {
                  if (hasStreak && topPartner) setScheduleModal({ name: topPartner.partnerName, partnerId: topPartner.partnerId });
                  else if (partners.length > 0) setScheduleModal({ name: partners[0].partnerName, partnerId: partners[0].partnerId });
                  else router.push('/app');
                }}
                className="mt-4 px-5 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl"
              >
                {weekCta}
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Practice rhythm ───────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-500">Recent practice</p>
          <RhythmChart sessions={sessions} targetLang={targetLang} liveProfiles={liveProfiles} />
        </div>

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
                  onSchedule={() => setScheduleModal({ name: s.partnerName, partnerId: s.partnerId })}
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
      {scheduleModal && (() => {
        const live        = liveProfiles[scheduleModal.partnerId];
        const name        = live?.name || scheduleModal.name;
        const avatarUrl   = live?.avatarUrl ?? null;
        const nativeLang  = live?.nativeLang ?? '';
        return (
          <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
            <div className="bg-white border border-stone-200 rounded-2xl px-5 py-5 w-full max-w-sm relative">
              {/* Close button */}
              <button
                onClick={() => setScheduleModal(null)}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Partner avatar */}
              <div className="flex justify-center mb-4">
                <PartnerAvatar name={name} avatarUrl={avatarUrl} nativeLang={nativeLang} />
              </div>

              <p className="font-bold text-neutral-900 mb-1 text-center">Keep the momentum going</p>
              <p className="text-sm text-stone-500 leading-relaxed text-center">
                We'll match you with {name} again using your current schedule.
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
        );
      })()}
    </AppShell>
  );
}
