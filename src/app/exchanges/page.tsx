'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchesBySessionId } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import type { SavedPartner } from '@/lib/types';
import { track } from '@/lib/analytics';
import AppShell from '@/components/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'scheduling' | 'past';

interface SchedulingCard {
  matchId: string;
  partnerId: string;
  name: string;
  nativeLang: string;
  learningLang: string;
  avatarUrl: string | null;
  schedulingState: string;
  iAmA: boolean;
  goal: string;
  commStyle: string;
  frequency: string;
}

interface UpcomingCard {
  matchId: string;
  partnerId: string;
  name: string;
  nativeLang: string;
  learningLang: string;
  avatarUrl: string | null;
  scheduledAt: string;
  goal: string;
  commStyle: string;
  frequency: string;
  iAmA: boolean;
}

interface PastCard {
  logId: string;
  partnerId: string;
  name: string;
  nativeLang: string;
  learningLang: string;
  avatarUrl: string | null;
  durationSecs: number;
  endedAt: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, lang, avatarUrl }: { name: string; lang: string; avatarUrl?: string | null }) {
  const bg = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const [failed, setFailed] = useState(false);
  const initials = (() => {
    const p = name.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.trim().slice(0, 2)).toUpperCase();
  })();
  return (
    <div style={{ backgroundColor: bg }} className="w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-lg shrink-0 overflow-hidden relative">
      <span className="select-none">{initials}</span>
      {avatarUrl && !failed && (
        <img src={avatarUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">
      {label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function needsMyAction(state: string, iAmA: boolean): boolean {
  if (state === 'pending_both') return true;
  if (state === 'pending_a')    return iAmA;
  if (state === 'pending_b')    return !iAmA;
  return false;
}

function isJoinable(scheduledAt: string, now: number): boolean {
  const t = new Date(scheduledAt).getTime();
  return (t - now) <= 30 * 60 * 1000 && (now - t) <= 60 * 60 * 1000;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  return m > 0 ? `${m}m` : `${secs}s`;
}

// ── Segment control ───────────────────────────────────────────────────────────

function SegmentControl({ tabs, active, onChange }: {
  tabs: { id: Tab; label: string; count: number }[];
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            active === t.id
              ? 'bg-white shadow-sm text-[#171717]'
              : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
        </button>
      ))}
    </div>
  );
}

// ── Scheduling card ───────────────────────────────────────────────────────────

function SchedulingCard({ card, onSetAvailability }: { card: SchedulingCard; onSetAvailability: () => void }) {
  const iNeedToAct = needsMyAction(card.schedulingState, card.iAmA);
  const nativeFlag   = LANG_FLAGS[card.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[card.learningLang] ?? '';

  const statusLine =
    card.schedulingState === 'no_overlap'  ? 'No overlap found — try different times' :
    card.schedulingState === 'computing'   ? 'Finding a time that works...' :
    iNeedToAct                             ? "Set your availability to find a time" :
                                             "Waiting for them to set availability";

  const ctaLabel =
    card.schedulingState === 'no_overlap'  ? 'Try different times →' :
    iNeedToAct                             ? 'Set availability →' :
                                             null;

  const chips = [card.goal, card.commStyle, card.frequency].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 px-5 pt-5 pb-5">
      <div className="flex items-start gap-4">
        <Avatar name={card.name} lang={card.nativeLang} avatarUrl={card.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#171717] text-lg leading-tight truncate">{card.name}</p>
          <div className="flex items-center gap-1 text-sm text-stone-400 mt-0.5">
            <span>{nativeFlag} {card.nativeLang}</span>
            <span className="text-stone-300 mx-0.5">↔</span>
            <span>{learningFlag} {card.learningLang}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-stone-500 mt-4 leading-relaxed">{statusLine}</p>

      {chips.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-stone-400 mb-2">In common</p>
          <div className="flex flex-wrap gap-2">
            {chips.map(c => <Chip key={c} label={c} />)}
          </div>
        </div>
      )}

      {ctaLabel && (
        <button
          onClick={onSetAvailability}
          className="mt-4 px-4 py-3 btn-primary text-white text-sm font-semibold rounded-xl"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ── Upcoming card ─────────────────────────────────────────────────────────────

function UpcomingCard({
  card,
  onJoin,
  onReschedule,
  onViewProfile,
}: {
  card: UpcomingCard;
  onJoin: () => void;
  onReschedule: () => void;
  onViewProfile: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [showOverflow, setShowOverflow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const sessionDate   = new Date(card.scheduledAt);
  const sessionPassed = now - sessionDate.getTime() > 60 * 60 * 1000;
  const isLive        = isJoinable(card.scheduledAt, now);
  const msUntil       = sessionDate.getTime() - now;
  const isSoon        = !isLive && msUntil > 0 && msUntil <= 60 * 60 * 1000;
  const nativeFlag    = LANG_FLAGS[card.nativeLang]   ?? '';
  const learningFlag  = LANG_FLAGS[card.learningLang] ?? '';
  const dateLine      = sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeLine      = sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const statusPill = sessionPassed
    ? { label: 'Missed :(', cls: 'bg-stone-100 text-stone-500' }
    : isLive   ? { label: '● Live now',      cls: 'bg-emerald-50 text-emerald-600' }
    : isSoon   ? { label: '● Starting soon', cls: 'bg-amber-50 text-amber-600' }
    :            { label: 'Upcoming',         cls: 'bg-blue-50 text-blue-600' };

  const chips = [card.goal, card.commStyle, card.frequency].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 px-5 pt-5 pb-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={card.name} lang={card.nativeLang} avatarUrl={card.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#171717] text-lg leading-tight truncate">{card.name}</p>
          <div className="flex items-center gap-1 text-sm text-stone-400 mt-0.5">
            <span>{nativeFlag} {card.nativeLang}</span>
            <span className="text-stone-300 mx-0.5">↔</span>
            <span>{learningFlag} {card.learningLang}</span>
          </div>
        </div>
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
              <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-lg border border-stone-100 py-1 w-44 text-sm">
                <button onClick={() => { setShowOverflow(false); onViewProfile(); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">View profile</button>
                <button onClick={() => { setShowOverflow(false); window.dispatchEvent(new CustomEvent('mutua:open-chat', { detail: { matchId: card.matchId } })); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Say hi</button>
                <button onClick={() => { setShowOverflow(false); onReschedule(); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Reschedule</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status + date */}
      <div className="mt-4">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusPill.cls}`}>
          {statusPill.label}
        </span>
        <p className="font-semibold text-[#171717] text-base mt-2">{dateLine}</p>
        <p className="text-sm text-stone-500 mt-0.5">{timeLine}</p>
      </div>

      {chips.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-stone-400 mb-2">In common</p>
          <div className="flex flex-wrap gap-2">
            {chips.map(c => <Chip key={c} label={c} />)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('mutua:open-chat', { detail: { matchId: card.matchId } }))}
          className="px-4 py-3 border border-stone-200 bg-white text-sm text-neutral-500 font-medium rounded-xl hover:bg-stone-50 transition-colors"
        >
          Say hi
        </button>
        <button
          onClick={sessionPassed ? onReschedule : onJoin}
          className="px-5 py-3 btn-primary text-white text-sm font-semibold rounded-xl"
        >
          {sessionPassed ? 'Reschedule →' : isLive ? 'Join now →' : 'Start exchange →'}
        </button>
      </div>
    </div>
  );
}

// ── Past card ─────────────────────────────────────────────────────────────────

function PastCard({ card, onReschedule }: { card: PastCard; onReschedule: () => void }) {
  const nativeFlag   = LANG_FLAGS[card.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[card.learningLang] ?? '';
  const date = new Date(card.endedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(card.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="bg-white rounded-2xl border border-stone-200 px-5 pt-5 pb-5">
      <div className="flex items-start gap-4">
        <Avatar name={card.name} lang={card.nativeLang} avatarUrl={card.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#171717] text-lg leading-tight truncate">{card.name}</p>
          <div className="flex items-center gap-1 text-sm text-stone-400 mt-0.5">
            <span>{nativeFlag} {card.nativeLang}</span>
            <span className="text-stone-300 mx-0.5">↔</span>
            <span>{learningFlag} {card.learningLang}</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="font-semibold text-[#171717] text-base">{date}</p>
        <p className="text-sm text-stone-500 mt-0.5">{time} · {fmtDuration(card.durationSecs)}</p>
      </div>

      <button
        onClick={onReschedule}
        className="mt-4 px-4 py-3 border border-stone-200 bg-white text-sm text-neutral-600 font-medium rounded-xl hover:bg-stone-50 transition-colors"
      >
        Schedule again →
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExchangesPage() {
  const router = useRouter();
  const [sessionId,  setSessionId]  = useState<string | null>(null);
  const [myNativeLang, setMyNativeLang] = useState('');
  const [scheduling, setScheduling] = useState<SchedulingCard[]>([]);
  const [upcoming,   setUpcoming]   = useState<UpcomingCard[]>([]);
  const [past,       setPast]       = useState<PastCard[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<Tab>('upcoming');

  const load = useCallback(async (sid: string) => {
    const now = Date.now();

    // Fetch user's own native language for Past card display
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('native_language')
      .eq('session_id', sid)
      .maybeSingle();
    const myLang = myProfile?.native_language ?? '';
    setMyNativeLang(myLang);

    const matches = await getMatchesBySessionId(sid);

    // Batch fetch partner profiles
    const partnerIds = matches.map(m => m.session_id_a === sid ? m.session_id_b : m.session_id_a);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('session_id, name, avatar_url, native_language')
      .in('session_id', partnerIds);
    const profileMap: Record<string, { name: string; avatarUrl: string | null; nativeLang: string }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.session_id] = { name: p.name ?? '', avatarUrl: p.avatar_url ?? null, nativeLang: p.native_language ?? '' };
    }

    const schedCards: SchedulingCard[] = [];
    const upCards: UpcomingCard[]      = [];

    for (const m of matches) {
      const isA        = m.session_id_a === sid;
      const partnerId  = isA ? m.session_id_b : m.session_id_a;
      const prof       = profileMap[partnerId];
      const name       = prof?.name || (isA ? (m.name_b ?? 'Partner') : (m.name_a ?? 'Partner'));
      const nativeLang   = isA ? (m.native_language_b ?? '') : (m.native_language_a ?? '');
      const learningLang = isA ? (m.native_language_a ?? '') : (m.native_language_b ?? '');

      if (
        m.scheduling_state === 'scheduled' && m.scheduled_at &&
        now - new Date(m.scheduled_at).getTime() <= 60 * 60 * 1000
      ) {
        upCards.push({
          matchId: m.id, partnerId, name,
          nativeLang, learningLang,
          avatarUrl:   prof?.avatarUrl ?? null,
          scheduledAt: m.scheduled_at,
          goal:        m.goal ?? '',
          commStyle:   m.comm_style ?? '',
          frequency:   m.practice_frequency ?? '',
          iAmA: isA,
        });
      } else if (['pending_both','pending_a','pending_b','computing','no_overlap'].includes(m.scheduling_state ?? '')) {
        schedCards.push({
          matchId: m.id, partnerId, name,
          nativeLang, learningLang,
          avatarUrl:       prof?.avatarUrl ?? null,
          schedulingState: m.scheduling_state!,
          iAmA: isA,
          goal:      m.goal ?? '',
          commStyle: m.comm_style ?? '',
          frequency: m.practice_frequency ?? '',
        });
      }
    }

    upCards.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    setScheduling(schedCards);
    setUpcoming(upCards);

    // Past — from session_logs
    const { data: logs } = await supabase
      .from('session_logs')
      .select('id, partner_id, duration_secs, ended_at')
      .eq('user_id', sid)
      .order('ended_at', { ascending: false })
      .limit(20);

    if (logs && logs.length > 0) {
      const pastPartnerIds = [...new Set(logs.map(l => l.partner_id).filter(Boolean))];
      const { data: pastProfiles } = await supabase
        .from('profiles')
        .select('session_id, name, avatar_url, native_language')
        .in('session_id', pastPartnerIds);
      const pastMap: Record<string, { name: string; avatarUrl: string | null; nativeLang: string }> = {};
      for (const p of pastProfiles ?? []) {
        pastMap[p.session_id] = { name: p.name ?? '', avatarUrl: p.avatar_url ?? null, nativeLang: p.native_language ?? '' };
      }
      setPast(logs.map(l => ({
        logId:        l.id,
        partnerId:    l.partner_id,
        name:         pastMap[l.partner_id]?.name || 'Partner',
        nativeLang:   myLang,
        learningLang: pastMap[l.partner_id]?.nativeLang || '',
        avatarUrl:    pastMap[l.partner_id]?.avatarUrl ?? null,
        durationSecs: l.duration_secs,
        endedAt:      l.ended_at,
      })));
    }
  }, []);

  useEffect(() => {
    const sid = localStorage.getItem('mutua_session_id');
    if (!sid) { router.replace('/onboarding'); return; }
    setSessionId(sid);
    load(sid).finally(() => setLoading(false));
  }, [router, load]);

  // Auto-select first non-empty tab after load
  useEffect(() => {
    if (loading) return;
    if (upcoming.length > 0)   setActiveTab('upcoming');
    else if (scheduling.length > 0) setActiveTab('scheduling');
    else if (past.length > 0)  setActiveTab('past');
  }, [loading, upcoming.length, scheduling.length, past.length]);

  useEffect(() => {
    if (!sessionId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') load(sessionId); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sessionId, load]);

  const handleJoin = (card: UpcomingCard) => {
    track('session_join_clicked', { partner_name: card.name, match_id: card.matchId });
    const savedPartner: SavedPartner = {
      partner_id:         card.partnerId,
      name:               card.name,
      native_language:    card.nativeLang as SavedPartner['native_language'],
      learning_language:  card.learningLang as SavedPartner['learning_language'],
      goal:               card.goal as SavedPartner['goal'],
      comm_style:         card.commStyle as SavedPartner['comm_style'],
      practice_frequency: card.frequency as SavedPartner['practice_frequency'],
      saved_at:           new Date().toISOString(),
      match_id:           card.matchId,
      avatar_url:         card.avatarUrl,
    };
    localStorage.setItem('mutua_current_partner', JSON.stringify(savedPartner));
    router.push('/pre-session');
  };

  const handleReschedule = (matchId: string, name: string, state?: string) => {
    track('reschedule_clicked', { match_id: matchId });
    localStorage.setItem('mutua_scheduling_partner', name);
    const params = new URLSearchParams({ matchId, schedulingState: state ?? 'pending_both' });
    router.push(`/set-availability?${params.toString()}`);
  };

  const isEmpty = !loading && scheduling.length === 0 && upcoming.length === 0 && past.length === 0;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'upcoming',   label: 'Upcoming',   count: upcoming.length },
    { id: 'scheduling', label: 'Scheduling', count: scheduling.length },
    { id: 'past',       label: 'Past',       count: past.length },
  ];

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">
        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Exchanges</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="bg-white border border-stone-200 rounded-2xl px-6 py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-neutral-700">No exchanges yet</p>
            <p className="text-sm text-stone-400 leading-relaxed">Head to Home to find a match and get started.</p>
          </div>
        ) : (
          <>
            <SegmentControl tabs={tabs} active={activeTab} onChange={setActiveTab} />

            <div className="space-y-4">
              {activeTab === 'upcoming' && (
                upcoming.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">No upcoming sessions.</p>
                ) : upcoming.map(card => (
                  <UpcomingCard
                    key={card.matchId}
                    card={card}
                    onJoin={() => handleJoin(card)}
                    onReschedule={() => handleReschedule(card.matchId, card.name, 'scheduled')}
                    onViewProfile={() => router.push(`/partner/${card.matchId}`)}
                  />
                ))
              )}

              {activeTab === 'scheduling' && (
                scheduling.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">No sessions being scheduled.</p>
                ) : scheduling.map(card => (
                  <SchedulingCard
                    key={card.matchId}
                    card={card}
                    onSetAvailability={() => handleReschedule(card.matchId, card.name, card.schedulingState)}
                  />
                ))
              )}

              {activeTab === 'past' && (
                past.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">No past sessions yet.</p>
                ) : past.map(card => (
                  <PastCard
                    key={card.logId}
                    card={card}
                    onReschedule={() => {
                      localStorage.setItem('mutua_scheduling_partner', card.name);
                      router.push('/history');
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
