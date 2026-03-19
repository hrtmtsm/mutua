'use client';

import { useState, useEffect } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

// spec: day_of_week 0=Mon … 6=Sun
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Full 24 hours, 30-min steps
const TIME_SLOTS: { label: string; minute: number }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    TIME_SLOTS.push({
      label:  `${h12}:${String(m).padStart(2, '0')} ${ampm}`,
      minute: h * 60 + m,
    });
  }
}

export interface AvailabilitySlot {
  day_of_week:  number;  // 0=Mon … 6=Sun
  start_minute: number;  // minutes from midnight
}

interface Props {
  initial?:   AvailabilitySlot[];
  timezone?:  string;
  onChange:   (slots: AvailabilitySlot[], timezone: string) => void;
  onSave?:    (slots: AvailabilitySlot[], timezone: string) => Promise<void>;
  saving?:    boolean;
  fullHeight?: boolean;  // if true, show all rows without scroll cap
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailabilityPicker({ initial = [], timezone: tzProp, onChange, onSave, saving, fullHeight }: Props) {
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

  // Drag-to-select
  const [dragging, setDragging] = useState<'add' | 'remove' | null>(null);
  const handlePointerDown = (day: number, minute: number) => {
    const key = `${day}-${minute}`;
    const mode = selected.has(key) ? 'remove' : 'add';
    setDragging(mode);
    toggle(day, minute);
  };
  const handlePointerEnter = (day: number, minute: number) => {
    if (!dragging) return;
    const key = `${day}-${minute}`;
    setSelected(prev => {
      const next = new Set(prev);
      dragging === 'add' ? next.add(key) : next.delete(key);
      return next;
    });
  };

  return (
    <div
      className="select-none"
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      {/* Timezone notice */}
      {!tzConfirmed && (
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
      {tzConfirmed && (
        <p className="text-xs text-stone-400 mb-4">
          Times shown in {timezone}.{' '}
          <button className="underline" onClick={() => setTzConfirmed(false)}>Change</button>
        </p>
      )}

      {/* Grid */}
      <div className="border border-stone-200 rounded-2xl overflow-hidden">
        {/* Day header row */}
        <div
          className="grid bg-stone-50 border-b border-stone-200"
          style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}
        >
          <div />
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold text-stone-500 border-l border-stone-100">
              {d}
            </div>
          ))}
        </div>

        {/* Time rows — scrollable */}
        <div className={fullHeight ? '' : 'overflow-y-auto max-h-80 scrollbar-thin'}>
          {TIME_SLOTS.map(({ label, minute }, i) => {
            const prevMinute = i > 0 ? TIME_SLOTS[i - 1].minute : null;
            const nextMinute = i < TIME_SLOTS.length - 1 ? TIME_SLOTS[i + 1].minute : null;
            return (
              <div
                key={minute}
                className={`grid border-stone-50 ${i < TIME_SLOTS.length - 1 ? 'border-b' : ''}`}
                style={{ gridTemplateColumns: `64px repeat(7, 1fr)` }}
              >
                {/* Time label — only on the hour */}
                <div className="flex items-center px-3">
                  {minute % 60 === 0 && (
                    <span className="text-[10px] text-stone-400 whitespace-nowrap">{label}</span>
                  )}
                </div>
                {DAY_LABELS.map((_, day) => {
                  const active   = isSelected(day, minute);
                  const aboveOn  = prevMinute !== null && isSelected(day, prevMinute);
                  const belowOn  = nextMinute !== null && isSelected(day, nextMinute);
                  const roundTop    = active && !aboveOn;
                  const roundBottom = active && !belowOn;
                  const radius = [
                    roundTop    ? '6px' : '0',
                    roundTop    ? '6px' : '0',
                    roundBottom ? '6px' : '0',
                    roundBottom ? '6px' : '0',
                  ].join(' ');
                  return (
                    <button
                      key={day}
                      onPointerDown={() => handlePointerDown(day, minute)}
                      onPointerEnter={() => handlePointerEnter(day, minute)}
                      style={active ? { borderRadius: radius } : undefined}
                      className={`border-l border-stone-100 py-2.5 transition-colors touch-none ${
                        active
                          ? 'bg-[#2B8FFF] hover:bg-[#1a7de8]'
                          : 'hover:bg-[#2B8FFF]/10'
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-2 text-center">
        {selected.size === 0
          ? 'Tap or drag to select your free times'
          : `${selected.size} slot${selected.size === 1 ? '' : 's'} selected`}
      </p>

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
