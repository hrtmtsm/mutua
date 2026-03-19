'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

// spec: day_of_week 0=Mon … 6=Sun
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Full 24 hours, 30-min steps
const TIME_SLOTS: { label: string; shortLabel: string; minute: number }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const h12   = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm  = h >= 12 ? 'PM' : 'AM';
    const mStr  = String(m).padStart(2, '0');
    TIME_SLOTS.push({
      label:      `${h12}:${mStr} ${ampm}`,
      shortLabel: `${h12}:${mStr}`,
      minute:     h * 60 + m,
    });
  }
}

export interface AvailabilitySlot {
  day_of_week:  number;  // 0=Mon … 6=Sun
  start_minute: number;  // minutes from midnight
}

interface Props {
  initial?:             AvailabilitySlot[];
  timezone?:            string;
  onChange:             (slots: AvailabilitySlot[], timezone: string) => void;
  onSave?:              (slots: AvailabilitySlot[], timezone: string) => Promise<void>;
  saving?:              boolean;
  fullHeight?:          boolean;
  partnerSlots?:        AvailabilitySlot[];
  hideTimezoneNotice?:  boolean; // let parent render timezone UI outside the scroll area
  hideLegend?:          boolean; // let parent render the legend outside the scroll area
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPicker({ initial = [], timezone: tzProp, onChange, onSave, saving, fullHeight, partnerSlots, hideTimezoneNotice, hideLegend }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(
    initial.map(s => `${s.day_of_week}-${s.start_minute}`)
  ));
  const [timezone, setTimezone] = useState(tzProp ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [tzConfirmed, setTzConfirmed] = useState(!!tzProp);

  // Notify parent whenever selection changes
  useEffect(() => {
    const slots = Array.from(selected).map(key => {
      const [day, min] = key.split('-').map(Number);
      return { day_of_week: day, start_minute: min };
    });
    onChange(slots, timezone);
  }, [selected, timezone]); // eslint-disable-line react-hooks/exhaustive-deps

  const partnerSet = useMemo(
    () => new Set((partnerSlots ?? []).map(s => `${s.day_of_week}-${s.start_minute}`)),
    [partnerSlots],
  );
  const isPartner = (day: number, minute: number) => partnerSet.has(`${day}-${minute}`);

  const toggle = (day: number, minute: number) => {
    const key = `${day}-${minute}`;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isSelected = (day: number, minute: number) =>
    selected.has(`${day}-${minute}`);

  // Day navigation — two fixed pages: Mon–Thu (page 0) and Fri–Sun (page 1)
  const [page, setPage] = useState(0);
  const visibleDays = page === 0 ? [0, 1, 2, 3] : [4, 5, 6];
  const swipeStartX = useRef<number | null>(null);
  const handleSwipeStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX; };
  const handleSwipeEnd   = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (dx < -40 && page === 0) setPage(1);
    if (dx >  40 && page === 1) setPage(0);
    swipeStartX.current = null;
  };

  // Drag-to-select (mouse only — touch uses onClick so scroll works)
  const [dragging, setDragging] = useState<'add' | 'remove' | null>(null);
  const mouseHandled = useRef(false);

  const handlePointerDown = (e: React.PointerEvent, day: number, minute: number) => {
    if (e.pointerType !== 'mouse') return; // touch: let onClick handle it
    mouseHandled.current = true;
    const key = `${day}-${minute}`;
    const mode = selected.has(key) ? 'remove' : 'add';
    setDragging(mode);
    toggle(day, minute);
  };
  const handlePointerEnter = (e: React.PointerEvent, day: number, minute: number) => {
    if (e.pointerType !== 'mouse' || !dragging) return;
    const key = `${day}-${minute}`;
    setSelected(prev => {
      const next = new Set(prev);
      dragging === 'add' ? next.add(key) : next.delete(key);
      return next;
    });
  };
  // Touch tap: onClick only fires if the finger didn't scroll
  const handleClick = (day: number, minute: number) => {
    if (mouseHandled.current) { mouseHandled.current = false; return; }
    toggle(day, minute);
  };

  return (
    <div
      className="select-none"
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {/* Timezone notice — only rendered if parent hasn't taken over */}
      {!hideTimezoneNotice && !tzConfirmed && (
        <div className="mb-4 flex items-center justify-between gap-4 px-4 py-3 bg-sky-50 border border-sky-100 rounded-xl text-sm">
          <span className="text-neutral-700">
            Using your device timezone: <strong>{timezone}</strong>
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setTzConfirmed(true)}
              className="px-3 py-1.5 text-xs font-semibold text-[#2B8FFF] hover:underline"
            >
              Looks good
            </button>
            <select
              value={timezone}
              onChange={e => { setTimezone(e.target.value); setTzConfirmed(true); }}
              className="text-xs border border-sky-200 rounded-lg px-2 py-1 bg-white text-neutral-700 focus:outline-none"
            >
              {Intl.supportedValuesOf('timeZone').map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {!hideTimezoneNotice && tzConfirmed && (
        <p className="text-xs text-stone-600 mb-4">
          Times shown in {timezone}.{' '}
          <button className="underline text-[#2B8FFF]" onClick={() => setTzConfirmed(false)}>Change</button>
        </p>
      )}

      {/* Sticky day header — swipeable left/right to switch pages */}
      <div className="sticky top-0 z-10 bg-white">
        <div
          className="relative grid border border-b-0 border-stone-200 rounded-t-2xl bg-stone-100"
          style={{ gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)` }}
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
        >
          {visibleDays.map((dayIdx, i) => (
            <div key={dayIdx} className={`py-2.5 text-center text-xs font-semibold text-stone-600 ${i > 0 ? 'border-l border-stone-200' : ''}`}>
              {DAY_LABELS[dayIdx]}
            </div>
          ))}
          {/* Subtle edge fade to hint at more pages */}
          {page === 0 && <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-stone-200/60 to-transparent rounded-tr-2xl pointer-events-none" />}
          {page === 1 && <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-stone-200/60 to-transparent rounded-tl-2xl pointer-events-none" />}
        </div>
        {/* Page dots */}
        <div className="flex justify-center gap-1.5 py-1">
          <button onClick={() => setPage(0)} className={`w-1.5 h-1.5 rounded-full transition-colors ${page === 0 ? 'bg-stone-400' : 'bg-stone-200'}`} />
          <button onClick={() => setPage(1)} className={`w-1.5 h-1.5 rounded-full transition-colors ${page === 1 ? 'bg-stone-400' : 'bg-stone-200'}`} />
        </div>
      </div>

      {/* Time rows */}
      <div className={`border-l border-r border-b border-stone-200 rounded-b-2xl overflow-hidden ${fullHeight ? '' : 'overflow-y-auto max-h-80 scrollbar-thin'}`}>
        {TIME_SLOTS.map(({ shortLabel, minute }, i) => {
          const isHour = minute % 60 === 0;
          return (
            <div
              key={minute}
              className={`grid ${isHour && i > 0 ? 'border-t border-stone-200' : i > 0 ? 'border-t border-stone-100' : ''}`}
              style={{ gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)` }}
            >
              {visibleDays.map((day, colIdx) => {
                const active  = isSelected(day, minute);
                const partner = isPartner(day, minute);
                const overlap = active && partner;
                return (
                  <button
                    key={day}
                    onPointerDown={e => handlePointerDown(e, day, minute)}
                    onPointerEnter={e => handlePointerEnter(e, day, minute)}
                    onClick={() => handleClick(day, minute)}
                    style={active ? { borderRadius: '6px' } : undefined}
                    className={`${colIdx > 0 ? 'border-l border-stone-100' : ''} py-3 transition-colors flex items-center justify-center ${
                      overlap  ? 'bg-emerald-400/50 hover:bg-emerald-400/60'
                      : active  ? 'bg-[#2B8FFF]/40 hover:bg-[#2B8FFF]/50'
                      : partner ? 'bg-amber-200/50 hover:bg-amber-200/70'
                                : 'bg-stone-50 hover:bg-[#2B8FFF]/10'
                    }`}
                  >
                    <span className={`text-[9px] font-medium pointer-events-none select-none ${
                      active ? 'text-[#1060d8]' : partner ? 'text-amber-700' : 'text-stone-400'
                    }`}>
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {!hideLegend && partnerSlots && partnerSlots.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#2B8FFF]/40 inline-block" />
            You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-300/50 inline-block" />
            Partner
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-400/50 inline-block" />
            Overlap
          </span>
        </div>
      )}

      {selected.size === 0 && (
        <p className="text-xs text-stone-400 mt-2 text-center">Tap or drag to select your free times</p>
      )}

      {onSave && (
        <button
          onClick={() => {
            const slots = Array.from(selected).map(key => {
              const [day, min] = key.split('-').map(Number);
              return { day_of_week: day, start_minute: min };
            });
            onSave(slots, timezone);
          }}
          disabled={saving || selected.size === 0}
          className="mt-4 w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? 'Saving...' : 'Save availability →'}
        </button>
      )}
    </div>
  );
}
