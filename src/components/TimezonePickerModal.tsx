'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Globe, X } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getOffsetString(tz: string, now: Date): string {
  try {
    // Diff between local representation in tz vs UTC
    const tzStr  = now.toLocaleString('en-US', { timeZone: tz,    hour12: false });
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const diff = (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
    const sign = diff >= 0 ? '+' : '-';
    const h = Math.floor(Math.abs(diff) / 60);
    const m = Math.abs(diff) % 60;
    return m > 0
      ? `GMT${sign}${h}:${String(m).padStart(2, '0')}`
      : `GMT${sign}${h}`;
  } catch {
    return 'GMT+0';
  }
}

function getCurrentTime(tz: string, now: Date): string {
  try {
    return now.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

function getLongName(tz: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'long',
    }).formatToParts(now);
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

function getRegion(tz: string): string {
  // "America/New_York" → "New York", "Asia/Kolkata" → "Kolkata"
  const parts = tz.split('/');
  return (parts[parts.length - 1] ?? tz).replace(/_/g, ' ');
}

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

// ── Types ──────────────────────────────────────────────────────────────────────

interface TZEntry {
  tz:         string;
  longName:   string;
  region:     string;
  time:       string;
  offset:     string;
  offsetMins: number; // for sorting
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  current:  string;
  onSelect: (tz: string) => void;
  onClose:  () => void;
}

export default function TimezonePickerModal({ current, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  // Build entries once on mount (clock frozen at open time is fine)
  const entries = useMemo<TZEntry[]>(() => {
    const now = new Date();
    return ALL_TIMEZONES.map(tz => {
      const tzStr  = now.toLocaleString('en-US', { timeZone: tz,    hour12: false });
      const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
      const offsetMins = (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
      return {
        tz,
        longName:   getLongName(tz, now),
        region:     getRegion(tz),
        time:       getCurrentTime(tz, now),
        offset:     getOffsetString(tz, now),
        offsetMins,
      };
    }).sort((a, b) => a.offsetMins - b.offsetMins);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.tz.toLowerCase().includes(q) ||
      e.longName.toLowerCase().includes(q) ||
      e.region.toLowerCase().includes(q) ||
      e.offset.toLowerCase().includes(q)
    );
  }, [entries, query]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in slide-in-from-bottom duration-250">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-[#2B8FFF] text-sm font-medium"
          >
            ‹ Back
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <input
            autoFocus
            type="text"
            placeholder="Time zone"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-stone-100 rounded-xl text-neutral-800 placeholder-stone-400 focus:outline-none"
            style={{ fontSize: '16px' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map(entry => {
          const active = entry.tz === current;
          return (
            <button
              key={entry.tz}
              onClick={() => { onSelect(entry.tz); onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-stone-50 transition-colors ${
                active ? 'bg-blue-50' : 'hover:bg-stone-50'
              }`}
            >
              <Globe className={`w-5 h-5 shrink-0 ${active ? 'text-[#2B8FFF]' : 'text-stone-400'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight truncate ${active ? 'text-[#2B8FFF]' : 'text-neutral-800'}`}>
                  {entry.longName}
                </p>
                <p className="text-xs text-stone-400 mt-0.5 truncate">
                  {entry.region}
                </p>
                <p className="text-xs text-stone-400">
                  {entry.time} ({entry.offset})
                </p>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-stone-400 py-16">No results for "{query}"</p>
        )}
      </div>
    </div>
  );
}
