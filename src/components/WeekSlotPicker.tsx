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

const DAY_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionSlot {
  startsAt: string; // ISO UTC string
}

interface Props {
  timezone:          string;
  partnerSlots?:     SessionSlot[];
  initialSlots?:     SessionSlot[];
  blockedSlots?:     SessionSlot[];
  onChange:          (slots: SessionSlot[]) => void;
  onTimezoneChange?: () => void;
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

function getUTCOffsetMinutes(d: Date, tz: string): number {
  try {
    const str = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' }).format(d);
    const m = str.match(/GMT([+-])(\d{1,2}):(\d{2})/);
    if (!m) return 0;
    const sign = m[1] === '+' ? 1 : -1;
    return sign * (parseInt(m[2]) * 60 + parseInt(m[3]));
  } catch { return 0; }
}

function slotToUTC(day: Date, minuteOfDay: number, timezone: string): string {
  try {
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(day);
    const [y, mo, d] = localDate.split('-').map(Number);
    const h = Math.floor(minuteOfDay / 60);
    const m = minuteOfDay % 60;
    const fakeUTC = new Date(Date.UTC(y, mo - 1, d, h, m, 0));
    const offset1 = getUTCOffsetMinutes(fakeUTC, timezone);
    const pass1   = new Date(fakeUTC.getTime() - offset1 * 60_000);
    const offset2 = getUTCOffsetMinutes(pass1, timezone);
    return new Date(fakeUTC.getTime() - offset2 * 60_000).toISOString();
  } catch {
    return new Date(day).toISOString();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekSlotPicker({ timezone, partnerSlots, initialSlots, blockedSlots, onChange, onTimezoneChange }: Props) {
  const days = useMemo(() => getNext7Days(), []);

  const slotsToKeys = (slots: SessionSlot[]): Set<string> => {
    const set = new Set<string>();
    for (const slot of slots) {
      const d = new Date(slot.startsAt);
      const offsetMin    = getUTCOffsetMinutes(d, timezone);
      const localMs      = d.getTime() + offsetMin * 60_000;
      const minuteOfDay  = Math.floor(localMs / 60_000) % (24 * 60);
      const localDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d);
      const dayIdx = days.findIndex(day =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(day) === localDateStr
      );
      if (dayIdx !== -1) set.add(`${dayIdx}-${minuteOfDay}`);
    }
    return set;
  };

  const [selected,     setSelected]     = useState<Set<string>>(() =>
    initialSlots?.length ? slotsToKeys(initialSlots) : new Set()
  );
  const [dragging,     setDragging]     = useState<'add' | 'remove' | null>(null);
  const [dayOffset,    setDayOffset]    = useState(0);
  const [visibleCount, setVisibleCount] = useState(7);
  const mouseHandled = useRef(false);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const hasScrolled  = useRef(false);

  // Sync when initialSlots loads async
  useEffect(() => {
    if (!initialSlots?.length) return;
    const keys = slotsToKeys(initialSlots);
    setSelected(keys);
    onChange(Array.from(keys).map(k => {
      const [di, min] = k.split('-').map(Number);
      return { startsAt: slotToUTC(days[di], min, timezone) };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlots]);

  // Scroll to earliest relevant slot on initial load
  useEffect(() => {
    if (hasScrolled.current || !scrollRef.current) return;
    const candidates = [
      ...(partnerSlots ?? []),
      ...Array.from(selected).map(k => {
        const [di, min] = k.split('-').map(Number);
        return { startsAt: slotToUTC(days[di], min, timezone) };
      }),
    ];
    if (!candidates.length) return;
    const earliest  = candidates.reduce((a, b) => a.startsAt < b.startsAt ? a : b);
    const tzDate    = new Date(new Date(earliest.startsAt).toLocaleString('en-US', { timeZone: timezone }));
    const minute    = tzDate.getHours() * 60 + tzDate.getMinutes();
    const rowIndex  = TIME_ROWS.findIndex(r => r.minuteOfDay === minute);
    if (rowIndex < 0) return;
    const approxPillH = 36;
    scrollRef.current.scrollTo({
      top: Math.max(0, rowIndex * approxPillH - scrollRef.current.clientHeight / 3),
      behavior: 'smooth',
    });
    hasScrolled.current = true;
  }, [partnerSlots, selected, timezone]);

  // Responsive columns
  useEffect(() => {
    const update = () => setVisibleCount(window.innerWidth < 640 ? 3 : 7);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => { setDayOffset(0); }, [visibleCount]);

  const visibleDays = days.slice(dayOffset, dayOffset + visibleCount);
  const canPrev     = dayOffset > 0;
  const canNext     = dayOffset + visibleCount < days.length;

  const partnerSet = useMemo(() => {
    if (!partnerSlots?.length) return new Set<string>();
    return new Set(partnerSlots.map(s => new Date(s.startsAt).getTime().toString()));
  }, [partnerSlots]);

  const blockedSet = useMemo(() => {
    if (!blockedSlots?.length) return new Set<string>();
    return new Set(blockedSlots.map(s => new Date(s.startsAt).getTime().toString()));
  }, [blockedSlots]);

  const makeKey    = (di: number, min: number) => `${di}-${min}`;
  const isSel      = (di: number, min: number) => selected.has(makeKey(di, min));
  const isPart     = (di: number, min: number) => partnerSet.has(new Date(slotToUTC(days[di], min, timezone)).getTime().toString());
  const isBlocked  = (di: number, min: number) => blockedSet.has(new Date(slotToUTC(days[di], min, timezone)).getTime().toString());

  const notifyParent = (next: Set<string>) => {
    onChange(Array.from(next).map(k => {
      const [di, min] = k.split('-').map(Number);
      return { startsAt: slotToUTC(days[di], min, timezone) };
    }));
  };

  const toggle = (di: number, min: number) => {
    if (isBlocked(di, min)) return;
    const key = makeKey(di, min);
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      notifyParent(next);
      return next;
    });
  };

  const handlePointerDown = (e: React.PointerEvent, di: number, min: number) => {
    if (e.pointerType !== 'mouse') return;
    mouseHandled.current = true;
    const mode = selected.has(makeKey(di, min)) ? 'remove' : 'add';
    setDragging(mode);
    toggle(di, min);
  };

  const handlePointerEnter = (e: React.PointerEvent, di: number, min: number) => {
    if (e.pointerType !== 'mouse' || !dragging) return;
    const key = makeKey(di, min);
    setSelected(prev => {
      const next = new Set(prev);
      dragging === 'add' ? next.add(key) : next.delete(key);
      notifyParent(next);
      return next;
    });
  };

  const handleClick = (di: number, min: number) => {
    if (mouseHandled.current) { mouseHandled.current = false; return; }
    toggle(di, min);
  };

  return (
    <div
      className="select-none flex flex-col h-full"
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {/* Day headers with inline nav arrows */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setDayOffset(o => o - 1)}
          disabled={!canPrev}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 disabled:invisible transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          className="flex-1 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}
        >
          {visibleDays.map((day, i) => (
            <div key={i} className="text-center">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">
                {visibleCount <= 3 ? DAY_FULL[day.getDay()] : DAY_SHORT[day.getDay()]}
              </p>
              <p className="text-sm font-bold text-neutral-800 mt-0.5">{day.getMonth() + 1}/{day.getDate()}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setDayOffset(o => o + 1)}
          disabled={!canNext}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 disabled:invisible transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-stone-200 mb-3" />

      {/* Legend */}
      <div className="flex items-center gap-5 mb-2 text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#2B8FFF] inline-block" />You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 inline-block" />Partner
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" />Overlap
        </span>
      </div>

      {/* Timezone */}
      <div className="flex items-center gap-1.5 text-xs text-stone-400 mb-4">
        <span>
          In your time zone,{' '}
          <span className="font-semibold text-neutral-600">{timezone.replace(/_/g, ' ')}</span>
          {' '}
          <span>
            (GMT{(() => {
              const off = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? '';
              return off.replace('GMT', '') || '+0:00';
            })()})
          </span>
        </span>
        {onTimezoneChange && (
          <button onClick={onTimezoneChange} className="text-[#2B8FFF] font-medium hover:underline ml-1">Change</button>
        )}
      </div>

      {/* Time pill grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}
        >
          {TIME_ROWS.map(({ label, minuteOfDay }) =>
            visibleDays.map((_, localIdx) => {
              const di      = dayOffset + localIdx;
              const blocked = isBlocked(di, minuteOfDay);
              const active  = !blocked && isSel(di, minuteOfDay);
              const partner = isPart(di, minuteOfDay);
              const overlap = active && partner;

              const cls = blocked
                ? 'bg-stone-50 text-stone-300 cursor-not-allowed border-stone-100'
                : overlap
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
                : active
                ? 'bg-[#2B8FFF] border-[#2B8FFF] text-white font-semibold shadow-sm'
                : partner
                ? 'bg-amber-50 border-amber-200 text-amber-600'
                : 'bg-white border-stone-200 text-stone-500 hover:border-[#2B8FFF] hover:text-[#2B8FFF] hover:bg-blue-50';

              if (blocked) {
                return (
                  <div
                    key={`${di}-${minuteOfDay}`}
                    className={`rounded-lg py-2.5 text-center text-xs border ${cls}`}
                  >
                    {label}
                  </div>
                );
              }

              return (
                <button
                  key={`${di}-${minuteOfDay}`}
                  onPointerDown={e => handlePointerDown(e, di, minuteOfDay)}
                  onPointerEnter={e => handlePointerEnter(e, di, minuteOfDay)}
                  onClick={() => handleClick(di, minuteOfDay)}
                  className={`rounded-lg py-2.5 text-center text-xs border transition-colors ${cls}`}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Hint */}
      {selected.size === 0 && (
        <p className="text-xs text-stone-400 mt-3 text-center">Tap any slot to mark when you're free</p>
      )}
    </div>
  );
}
