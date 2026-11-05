'use client';
import {authorizedFetch} from '@/lib/practice';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/Sidebar';
import { useLocale } from '@/components/LocaleProvider';
import type { DictionaryKey } from '@/lib/i18n/dictionary';

// ── Helpers ────────────────────────────────────────────────────────────────
const DAY_KEYS: DictionaryKey[] = [
  'weekday.sun', 'weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat',
];
const MONTH_KEYS: DictionaryKey[] = [
  'month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun',
  'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec',
];

function fmtLabel(date: Date, hour: number, min: number, t: (key: DictionaryKey) => string) {
  const h12  = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const m    = String(min).padStart(2, '0');
  return `${t(DAY_KEYS[date.getDay()])}, ${t(MONTH_KEYS[date.getMonth()])} ${date.getDate()} · ${h12}:${m} ${ampm}`;
}

function fmtTime(hour: number, min: number) {
  const h12  = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(min).padStart(2,'0')} ${ampm}`;
}

/** Next N days starting tomorrow */
function getNextDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

/** 30-min slots from startHour to endHour */
function getTimeSlots(startHour = 8, endHour = 22) {
  const slots: { hour: number; min: number }[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push({ hour: h, min: 0 });
    slots.push({ hour: h, min: 30 });
  }
  return slots;
}

function generateSuggestedSlots(t: (key: DictionaryKey) => string): string[] {
  const slots: string[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  cursor.setSeconds(0); cursor.setMilliseconds(0);
  while (slots.length < 4) {
    const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
    slots.push(fmtLabel(cursor, isWeekend ? 10 : 19, 0, t));
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SessionSchedulePage() {
  const { t } = useLocale();
  const router = useRouter();
  const [partnerName, setPartnerName] = useState(t('setAvailability.yourPartnerFallback'));
  const [slots,       setSlots]       = useState<string[]>([]);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [showGrid,    setShowGrid]    = useState(false);
  const [confirmed,   setConfirmed]   = useState(false);
  const [picked,      setPicked]      = useState<Set<string>>(new Set());

  const days      = getNextDays(7);
  const timeSlots = getTimeSlots(8, 22);

  useEffect(() => {
    const stored = localStorage.getItem('mutua_session_slots');
    setSlots(stored ? JSON.parse(stored) : generateSuggestedSlots(t));
    const partner = localStorage.getItem('mutua_current_partner');
    if (partner) {
      const { name } = JSON.parse(partner);
      if (name) setPartnerName(name);
    }
  }, []);

  const togglePick = (label: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const confirm = (labels: string[]) => {
    const primary = labels[0];
    setSelected(primary);
    const history = JSON.parse(localStorage.getItem('mutua_history') ?? '[]');
    if (history[0]) { history[0].scheduledFor = primary; localStorage.setItem('mutua_history', JSON.stringify(history)); }
    localStorage.setItem('mutua_scheduled_time', primary);

    // Confirm session in DB + notify partner (fire-and-forget)
    const matchId      = localStorage.getItem('mutua_match_id');
    const partnerEmail = localStorage.getItem('mutua_partner_email');
    const myProfile    = localStorage.getItem('mutua_profile');
    const myName       = myProfile ? (JSON.parse(myProfile).name ?? '') : '';
    if (matchId && partnerEmail) {
      authorizedFetch('/api/confirm-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          partnerEmail,
          partnerName:   partnerName,
          scheduledTime: primary,
          confirmerName: myName,
        }),
      }).catch(() => {});
    }

    setConfirmed(true);
    setTimeout(() => router.push('/app'), 1800);
  };

  if (confirmed) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 py-8">
            <p className="text-4xl">✅</p>
            <p className="font-bold text-lg text-neutral-900">{t('sessionSchedule.noted')}</p>
            <p className="text-sm text-neutral-400">
              {t('sessionSchedule.reminderBody').replace('{partner}', partnerName).replace('{time}', selected?.toLowerCase() ?? '')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopNav />

      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="max-w-2xl w-full space-y-6">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400 mb-1">
              {t('sessionSchedule.scheduleWith').replace('{partner}', partnerName)}
            </p>
            <p className="font-black text-2xl text-neutral-900">{t('sessionSchedule.whenWorks')}</p>
          </div>

          {/* ── Suggested slots ── */}
          {!showGrid && (
            <div className="space-y-2">
              {slots.map(slot => (
                <button
                  key={slot}
                  onClick={() => confirm([slot])}
                  className="w-full text-left px-5 py-4 rounded-xl border border-stone-200 bg-white hover:border-[#2B8FFF] transition-all flex items-center justify-between"
                >
                  <span className="font-semibold text-base text-neutral-900">{slot}</span>
                  <div className="w-4 h-4 rounded-full border-2 border-stone-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── Custom grid picker (multi-select) ── */}
          {showGrid ? (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">{t('sessionSchedule.selectMultiple').replace('{partner}', partnerName)}</p>
              <div className="border border-stone-200 rounded-2xl overflow-hidden">
                {/* Day headers */}
                <div className="grid border-b border-stone-100" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
                  <div className="px-3 py-3" />
                  {days.map(d => (
                    <div key={d.toISOString()} className="px-2 py-3 text-center border-l border-stone-100">
                      <p className="text-xs font-semibold text-neutral-500">{t(DAY_KEYS[d.getDay()])}</p>
                      <p className="text-xs text-stone-400">{d.getDate()}/{d.getMonth()+1}</p>
                    </div>
                  ))}
                </div>

                {/* Time slots — scrollable */}
                <div className="overflow-y-auto max-h-72">
                  {timeSlots.map(({ hour, min }) => (
                    <div
                      key={`${hour}-${min}`}
                      className="grid border-b border-stone-50 last:border-0"
                      style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}
                    >
                      <div className="px-3 flex items-center">
                        {min === 0 && <span className="text-xs text-stone-400">{fmtTime(hour, 0)}</span>}
                      </div>
                      {days.map(d => {
                        const label = fmtLabel(d, hour, min, t);
                        const isSelected = picked.has(label);
                        return (
                          <button
                            key={d.toISOString()}
                            onClick={() => togglePick(label)}
                            className={`border-l border-stone-100 py-2 text-xs transition-colors ${
                              isSelected
                                ? 'bg-[#2B8FFF] text-white font-semibold'
                                : 'text-stone-400 hover:bg-[#2B8FFF]/8 hover:text-[#2B8FFF]'
                            }`}
                          >
                            {fmtTime(hour, min)}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm multi-select */}
              {picked.size > 0 && (
                <button
                  onClick={() => confirm(Array.from(picked))}
                  className="w-full py-3 btn-primary text-white font-bold rounded-xl"
                >
                  {(picked.size > 1 ? t('sessionSchedule.sendOptionsPlural') : t('sessionSchedule.sendOptionsSingular')).replace('{n}', String(picked.size)).replace('{partner}', partnerName)}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowGrid(true)}
              className="w-full text-center text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              {t('sessionSchedule.pickAnotherTime')}
            </button>
          )}

          <button
            onClick={() => router.push('/app')}
            className="w-full text-center text-xs text-neutral-300 hover:text-neutral-400 transition-colors"
          >
            {t('sessionSchedule.scheduleLater')}
          </button>

        </div>
      </main>
    </div>
  );
}
