'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { ArrowLeft } from 'lucide-react';

interface SessionEntry {
  partnerName: string;
  partnerId:   string;
  duration:    number;
  date:        string;
  missed?:     boolean;
}

interface PartnerStats {
  partnerId:     string;
  partnerName:   string;
  sessionCount:  number;
  totalMin:      number;
  streak:        number;
  lastDate:      string;
  daysSinceLast: number;
}

interface LiveProfile {
  name:      string;
  avatarUrl: string | null;
  nativeLang: string;
  matchId:   string | null;
}

function getWeekStart(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computePartnerStats(sessions: SessionEntry[]): PartnerStats[] {
  const map = new Map<string, SessionEntry[]>();
  for (const s of sessions) {
    const key = s.partnerId || s.partnerName;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  const now = new Date();
  const stats: PartnerStats[] = [];

  for (const [key, pSessions] of map.entries()) {
    const allSorted     = [...pSessions].sort((a, b) => b.date.localeCompare(a.date));
    const completed     = allSorted.filter(s => !s.missed);
    const totalMin      = completed.reduce((s, x) => s + (x.duration ?? 0), 0);
    const lastDate      = allSorted[0].date;
    const daysSinceLast = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);

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
      partnerId: key,
      partnerName: allSorted[0].partnerName,
      sessionCount: completed.length,
      totalMin,
      streak,
      lastDate,
      daysSinceLast,
    });
  }

  return stats.sort((a, b) => {
    if (b.streak !== a.streak) return b.streak - a.streak;
    if (a.daysSinceLast !== b.daysSinceLast) return a.daysSinceLast - b.daysSinceLast;
    return b.sessionCount - a.sessionCount;
  });
}

function formatMin(min: number) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${min}m`;
}

function PartnerAvatar({ name, nativeLang, avatarUrl }: { name: string; nativeLang: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const bg = LANG_AVATAR_COLOR[nativeLang] ?? '#3b82f6';
  const initials = name.trim().slice(0, 2).toUpperCase();
  if (avatarUrl && !failed) {
    return <img src={avatarUrl} alt={name} className="w-12 h-12 rounded-2xl object-cover shrink-0" onError={() => setFailed(true)} />;
  }
  return (
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm shrink-0" style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

export default function PartnersPage() {
  const router = useRouter();
  const [stats,   setStats]   = useState<PartnerStats[]>([]);
  const [profiles, setProfiles] = useState<Record<string, LiveProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const raw     = localStorage.getItem('mutua_history');
      const mySid   = localStorage.getItem('mutua_session_id') ?? '';
      const localParsed: SessionEntry[] = raw ? JSON.parse(raw) : [];

      let merged = [...localParsed];
      if (mySid) {
        const { data: logs } = await supabase
          .from('session_logs')
          .select('partner_id, duration_secs, ended_at')
          .eq('user_id', mySid)
          .order('ended_at', { ascending: false });
        if (logs && logs.length > 0) {
          const remoteEntries: SessionEntry[] = logs.map(l => ({
            partnerName: '',
            partnerId:   l.partner_id,
            duration:    Math.round(l.duration_secs / 60),
            date:        l.ended_at,
          }));
          const seen = new Set(remoteEntries.map(e => `${e.partnerId}:${e.date.slice(0, 16)}`));
          const localOnly = localParsed.filter(e => !seen.has(`${e.partnerId}:${e.date.slice(0, 16)}`));
          merged = [...remoteEntries, ...localOnly].sort((a, b) => b.date.localeCompare(a.date));
        }
      }

      const partnerStats = computePartnerStats(merged);
      setStats(partnerStats);

      const ids = partnerStats.map(p => p.partnerId).filter(Boolean);
      if (ids.length === 0) { setLoading(false); return; }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const [{ data: profileRows }, { data: matches }] = await Promise.all([
        supabase.from('profiles').select('session_id, name, avatar_url, native_language').in('session_id', ids),
        supabase.from('matches').select('id, session_id_a, session_id_b')
          .or(ids.map(id => `session_id_a.eq.${id},session_id_b.eq.${id}`).join(',')),
      ]);

      const matchMap: Record<string, string> = {};
      for (const m of (matches ?? [])) {
        const pid = m.session_id_a === mySid ? m.session_id_b : m.session_id_a;
        if (!matchMap[pid]) matchMap[pid] = m.id;
      }

      const map: Record<string, LiveProfile> = {};
      for (const row of (profileRows ?? [])) {
        map[row.session_id] = {
          name:      row.name ?? '',
          avatarUrl: row.avatar_url ?? `${supabaseUrl}/storage/v1/object/public/avatars/${row.session_id}.jpg`,
          nativeLang: row.native_language ?? '',
          matchId:   matchMap[row.session_id] ?? null,
        };
      }
      setProfiles(map);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell>
      <main className="flex-1 max-w-2xl mx-auto w-full pb-10">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-neutral-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif font-semibold text-xl text-[#171717]">Partner streaks</h1>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400 px-6">Loading…</p>
        ) : stats.length === 0 ? (
          <p className="text-sm text-stone-400 px-6">No partners yet.</p>
        ) : (
          <div className="px-6 space-y-3">
            {stats.map((s, i) => {
              const live    = profiles[s.partnerId];
              const name    = live?.name || s.partnerName || 'Partner';
              const matchId = live?.matchId ?? null;
              return (
                <button
                  key={s.partnerId}
                  onClick={() => matchId && router.push(`/partner/${matchId}`)}
                  className="w-full bg-white border border-stone-200 rounded-2xl px-5 py-4 flex items-center gap-4 text-left hover:bg-stone-50 transition-colors disabled:cursor-default"
                  disabled={!matchId}
                >
                  {/* Rank */}
                  <span className="text-sm font-bold text-stone-300 w-5 text-center shrink-0">{i + 1}</span>

                  <PartnerAvatar
                    name={name}
                    nativeLang={live?.nativeLang ?? ''}
                    avatarUrl={live?.avatarUrl ?? null}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#171717] text-sm truncate">{name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {s.sessionCount} {s.sessionCount === 1 ? 'session' : 'sessions'}
                      {s.totalMin > 0 ? ` · ${formatMin(s.totalMin)}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-black text-xl text-[#171717]">{s.streak > 0 ? s.streak : '–'}</p>
                    <p className="text-xs text-stone-400">wk streak</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
