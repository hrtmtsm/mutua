'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

// Intl.supportedValuesOf is ES2022 and not available on older Android browsers.
const ALL_TIMEZONES: string[] = (() => {
  try {
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    return [
      'Pacific/Honolulu','America/Anchorage','America/Los_Angeles','America/Denver',
      'America/Chicago','America/New_York','America/Sao_Paulo','Atlantic/Azores',
      'Europe/London','Europe/Paris','Europe/Berlin','Europe/Helsinki',
      'Africa/Cairo','Africa/Nairobi','Asia/Dubai','Asia/Karachi',
      'Asia/Kolkata','Asia/Dhaka','Asia/Bangkok','Asia/Shanghai',
      'Asia/Tokyo','Asia/Seoul','Australia/Sydney','Pacific/Auckland',
    ];
  }
})();

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

  // Sync when parent changes the timezone externally (e.g. via modal)
  useEffect(() => {
    if (tzProp && tzProp !== timezone) setTimezone(tzProp);
  }, [tzProp]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Overlap cells (both user + partner) are already selected — don't deselect on tap
    if (partnerSet.has(key) && selected.has(key)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isSelected = (day: number, minute: number) =>
    selected.has(`${day}-${minute}`);

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
        <div className="mb-4 flex flex-col gap-2 px-4 py-3 bg-sky-50 border border-sky-100 rounded-xl text-sm">
          <span className="text-neutral-700">
            Using your device timezone: <strong>{timezone}</strong>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setTzConfirmed(true)}
              className="px-3 py-1.5 text-xs font-semibold text-[#2B8FFF] hover:underline shrink-0"
            >
              Looks good
            </button>
            <select
              value={timezone}
              onChange={e => { setTimezone(e.target.value); setTzConfirmed(true); }}
              className="text-xs border border-sky-200 rounded-lg px-2 py-1 bg-white text-neutral-700 focus:outline-none min-w-0 flex-1"
            >
              {ALL_TIMEZONES.map(tz => (
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

      {/* Sticky day header */}
      <div className="sticky top-0 z-10 bg-white">
        <div
          className="grid bg-stone-100 border border-b-0 border-stone-200 rounded-t-2xl"
          style={{ gridTemplateColumns: `2rem repeat(7, minmax(0, 1fr))` }}
        >
          {/* Empty corner above time labels */}
          <div />
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`py-2.5 text-center text-xs font-semibold text-stone-600 ${i >= 0 ? 'border-l border-stone-200' : ''}`}>
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Time rows */}
      <div className={`border-l border-r border-b border-stone-200 rounded-b-2xl overflow-hidden ${fullHeight ? '' : 'overflow-y-auto max-h-80 scrollbar-thin'}`}>
        {TIME_SLOTS.map(({ label, shortLabel, minute }, i) => {
          const isHour = minute % 60 === 0;
          return (
            <div
              key={minute}
              className={`grid ${isHour && i > 0 ? 'border-t border-stone-200' : i > 0 ? 'border-t border-stone-100' : ''}`}
              style={{ gridTemplateColumns: `2rem repeat(7, minmax(0, 1fr))` }}
            >
              {/* Time label — only on the hour */}
              <div className="flex items-start justify-end pr-1.5 pt-0.5 shrink-0">
                {isHour && (
                  <span className="text-[9px] text-stone-400 leading-none">
                    {label.replace(':00 ', ' ').replace(' AM', 'a').replace(' PM', 'p')}
                  </span>
                )}
              </div>

              {DAY_LABELS.map((_, day) => {
                const active   = isSelected(day, minute);
                const partner  = isPartner(day, minute);
                const overlap  = active && partner;
                return (
                  <button
                    key={day}
                    onPointerDown={e => handlePointerDown(e, day, minute)}
                    onPointerEnter={e => handlePointerEnter(e, day, minute)}
                    onClick={() => handleClick(day, minute)}
                    style={active ? { borderRadius: '6px' } : undefined}
                    className={`border-l border-stone-100 py-2.5 transition-colors flex items-center justify-center ${
                      overlap
                        ? 'bg-emerald-400/50 hover:bg-emerald-400/60'
                        : active
                          ? 'bg-[#2B8FFF]/40 hover:bg-[#2B8FFF]/50'
                          : partner
                            ? 'bg-amber-200/50 hover:bg-amber-200/70'
                            : 'bg-stone-50 hover:bg-[#2B8FFF]/10'
                    }`}
                  >
                    <span className={`text-[8px] font-medium pointer-events-none select-none ${
                      overlap  ? 'text-emerald-700/60' :
                      active   ? 'text-[#1060d8]/50'  :
                      partner  ? 'text-amber-700/50'  :
                                 'text-stone-300'
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
