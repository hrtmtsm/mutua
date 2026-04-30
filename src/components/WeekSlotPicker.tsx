'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const START_HOUR = 1;
const END_HOUR   = 24;

const TIME_ROWS: { label: string; minuteOfDay: number }[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) {
  for (const m of [0, 30]) {
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'pm' : 'am';
    const mStr = String(m).padStart(2, '0');
    TIME_ROWS.push({ label: `${h12}:${mStr}${ampm}`, minuteOfDay: h * 60 + m });
  }
}

const DAY_SHORT   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionSlot {
  startsAt: string; // ISO UTC string
}

interface Props {
  timezone:      string;
  partnerSlots?: SessionSlot[];
  initialSlots?: SessionSlot[];
  onChange:      (slots: SessionSlot[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNext7Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

function slotToUTC(day: Date, minuteOfDay: number, timezone: string): string {
  try {
    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone, ...opts }).format(d);
    const year  = fmt(day, { year:  'numeric' });
    const month = fmt(day, { month: '2-digit' });
    const date  = fmt(day, { day:   '2-digit' });
    const h     = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
    const mn    = String(minuteOfDay % 60).padStart(2, '0');
    const localStr = `${year}-${month}-${date}T${h}:${mn}:00`;
    const assumed  = new Date(localStr + 'Z');
    const displayed = assumed.toLocaleString('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).replace(', ', 'T');
    const offset = assumed.getTime() - new Date(displayed + 'Z').getTime();
    return new Date(assumed.getTime() + offset).toISOString();
  } catch {
    return new Date(day).toISOString();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekSlotPicker({ timezone, partnerSlots, initialSlots, onChange }: Props) {
  const days = useMemo(() => getNext7Days(), []);

  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!initialSlots?.length) return new Set();
    // Map initial UTC slots back to dayIdx-minute keys for this week
    const set = new Set<string>();
    for (const slot of initialSlots) {
      const d = new Date(slot.startsAt);
      const localStr = d.toLocaleString('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
      const [datePart, timePart] = localStr.replace(', ', 'T').split('T');
      const [hh, mm] = timePart.split(':').map(Number);
      const minuteOfDay = hh * 60 + mm;
      // Find which dayIdx this date corresponds to
      const slotDate = datePart; // YYYY-MM-DD
      const dayIdx = days.findIndex(day => {
        const dayStr = day.toLocaleDateString('en-CA', { timeZone: timezone });
        return dayStr === slotDate;
      });
      if (dayIdx !== -1) set.add(`${dayIdx}-${minuteOfDay}`);
    }
    return set;
  });
  const [dragging,     setDragging] = useState<'add' | 'remove' | null>(null);
  const [dayOffset,    setDayOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(7);
  const mouseHandled = useRef(false);

  // Notify parent of initial pre-populated slots so parent state isn't empty
  useEffect(() => {
    if (selected.size > 0) {
      const slots: SessionSlot[] = Array.from(selected).map(k => {
        const [di, min] = k.split('-').map(Number);
        return { startsAt: slotToUTC(days[di], min, timezone) };
      });
      onChange(slots);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Responsive: 3 cols on narrow screens, 7 on wide
  useEffect(() => {
    const update = () => setVisibleCount(window.innerWidth < 640 ? 3 : 7);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Reset offset when switching between mobile/desktop
  useEffect(() => {
    setDayOffset(0);
  }, [visibleCount]);

  const visibleDays = days.slice(dayOffset, dayOffset + visibleCount);
  const canPrev     = dayOffset > 0;
  const canNext     = dayOffset + visibleCount < days.length;

  // Current-time line — in the selected timezone
  const getNowMinute = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(now);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10);
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return h * 60 + m;
  };
  const [nowMinute, setNowMinute] = useState<number>(getNowMinute);
  useEffect(() => {
    const id = setInterval(() => setNowMinute(getNowMinute()), 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone]);
  const totalGridMinutes = (END_HOUR - START_HOUR) * 60;
  const nowOffsetMinutes = nowMinute - START_HOUR * 60;
  const nowPct           = (nowOffsetMinutes / totalGridMinutes) * 100;
  const showNowLine      = nowPct >= 0 && nowPct <= 100;

  const partnerSet = useMemo(() => {
    if (!partnerSlots?.length) return new Set<string>();
    return new Set(partnerSlots.map(s => new Date(s.startsAt).getTime().toString()));
  }, [partnerSlots]);

  const makeKey    = (dayIdx: number, minute: number) => `${dayIdx}-${minute}`;
  const isSelected = (dayIdx: number, minute: number) => selected.has(makeKey(dayIdx, minute));
  const isPartner  = (dayIdx: number, minute: number) => {
    const utc = slotToUTC(days[dayIdx], minute, timezone);
    return partnerSet.has(new Date(utc).getTime().toString());
  };

  const notifyParent = (next: Set<string>) => {
    const slots: SessionSlot[] = Array.from(next).map(k => {
      const [di, min] = k.split('-').map(Number);
      return { startsAt: slotToUTC(days[di], min, timezone) };
    });
    onChange(slots);
  };

  const toggle = (dayIdx: number, minute: number) => {
    const key = makeKey(dayIdx, minute);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      notifyParent(next);
      return next;
    });
  };

  const handlePointerDown = (e: React.PointerEvent, dayIdx: number, minute: number) => {
    if (e.pointerType !== 'mouse') return;
    mouseHandled.current = true;
    const key  = makeKey(dayIdx, minute);
    const mode = selected.has(key) ? 'remove' : 'add';
    setDragging(mode);
    toggle(dayIdx, minute);
  };

  const handlePointerEnter = (e: React.PointerEvent, dayIdx: number, minute: number) => {
    if (e.pointerType !== 'mouse' || !dragging) return;
    const key = makeKey(dayIdx, minute);
    setSelected(prev => {
      const next = new Set(prev);
      dragging === 'add' ? next.add(key) : next.delete(key);
      notifyParent(next);
      return next;
    });
  };

  const handleClick = (dayIdx: number, minute: number) => {
    if (mouseHandled.current) { mouseHandled.current = false; return; }
    toggle(dayIdx, minute);
  };

  const colTemplate = `3.5rem repeat(${visibleCount}, minmax(0, 1fr))`;

  return (
    <div
      className="select-none"
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {/* Day header */}
      <div className="sticky top-0 z-10 bg-white">
        <div
          className="grid bg-stone-100 border border-b-0 border-stone-200 rounded-t-2xl"
          style={{ gridTemplateColumns: colTemplate }}
        >
          {/* Time-label cell — doubles as prev arrow on mobile */}
          <div className="flex items-center justify-center">
            {canPrev && visibleCount < 7 && (
              <button
                onClick={() => setDayOffset(o => o - 1)}
                className="p-1 text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          {visibleDays.map((day, i) => {
            const isLast = canNext && visibleCount < 7 && i === visibleDays.length - 1;
            return (
              <div key={i} className={`border-l border-stone-200 flex items-center ${isLast ? 'pr-1' : ''}`}>
                <div className="flex-1 py-2 text-center">
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{DAY_SHORT[day.getDay()]}</p>
                  <p className="text-xs font-bold text-neutral-700">{MONTH_SHORT[day.getMonth()]} {day.getDate()}</p>
                </div>
                {isLast && (
                  <button
                    onClick={() => setDayOffset(o => o + 1)}
                    className="p-1 text-stone-400 hover:text-stone-700 transition-colors shrink-0"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time rows */}
      <div className="relative border-l border-r border-b border-stone-200 rounded-b-2xl overflow-hidden overflow-y-auto max-h-[60vh]">
        {/* Now line */}
        {showNowLine && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none"
            style={{ top: `${nowPct}%` }}
          >
            <div className="flex items-center" style={{ paddingLeft: '3.5rem' }}>
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          </div>
        )}

        {TIME_ROWS.map(({ label, minuteOfDay }, rowIdx) => {
          const isHour = minuteOfDay % 60 === 0;
          return (
            <div
              key={minuteOfDay}
              className={`grid ${rowIdx > 0 ? (isHour ? 'border-t border-stone-200' : 'border-t border-stone-100') : ''}`}
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div className="flex items-start justify-end pr-2 pt-0.5 shrink-0">
                {isHour && <span className="text-[11px] text-stone-600 leading-none">{label}</span>}
              </div>
              {visibleDays.map((_, localIdx) => {
                const dayIdx  = dayOffset + localIdx;
                const active  = isSelected(dayIdx, minuteOfDay);
                const partner = isPartner(dayIdx, minuteOfDay);
                const overlap = active && partner;
                const filled  = active || partner;

                const colorClass = overlap  ? 'bg-emerald-400/50' :
                                   active   ? 'bg-[#2B8FFF]/40'   :
                                   partner  ? 'bg-amber-200/50'   : '';

                return (
                  <button
                    key={dayIdx}
                    onPointerDown={e => handlePointerDown(e, dayIdx, minuteOfDay)}
                    onPointerEnter={e => handlePointerEnter(e, dayIdx, minuteOfDay)}
                    onClick={() => handleClick(dayIdx, minuteOfDay)}
                    className={`border-l border-stone-100 py-4 relative transition-colors ${
                      filled ? '' : 'bg-stone-50 hover:bg-[#2B8FFF]/10'
                    }`}
                  >
                    {filled && (
                      <span className={`absolute inset-x-0.5 inset-y-0.5 rounded-md ${colorClass}`} />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {partnerSlots && partnerSlots.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#2B8FFF]/40 inline-block" />You</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-300/50 inline-block" />Partner</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400/50 inline-block" />Overlap</span>
        </div>
      )}

      {selected.size === 0 && (
        <p className="text-xs text-stone-400 mt-2 text-center">Tap any block to mark when you're free this week</p>
      )}
    </div>
  );
}
