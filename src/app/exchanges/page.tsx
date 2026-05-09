'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchesBySessionId, type Match } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import type { SavedPartner } from '@/lib/types';
import { track } from '@/lib/analytics';
import AppShell from '@/components/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartnerInfo {
  name: string;
  nativeLang: string;
  learningLang: string;
  avatarUrl: string | null;
}

interface SchedulingCard extends PartnerInfo {
  matchId: string;
  partnerId: string;
  schedulingState: string;
  iAmA: boolean;
}

interface UpcomingCard extends PartnerInfo {
  matchId: string;
  partnerId: string;
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
  avatarUrl: string | null;
  durationSecs: number;
  endedAt: string;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, lang, avatarUrl, size = 'md' }: { name: string; lang: string; avatarUrl?: string | null; size?: 'sm' | 'md' }) {
  const bg = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const [failed, setFailed] = useState(false);
  const initials = (() => { const p = name.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.trim().slice(0, 2)).toUpperCase(); })();
  const sz = size === 'sm' ? 'w-10 h-10 text-sm' : 'w-14 h-14 text-lg';
  return (
    <div style={{ backgroundColor: bg }} className={`${sz} rounded-full flex items-center justify-center font-black text-white shrink-0 overflow-hidden relative`}>
      <span className="select-none">{initials}</span>
      {avatarUrl && !failed && (
        <img src={avatarUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

// ── Scheduling card ───────────────────────────────────────────────────────────

function schedulingLabel(state: string, iAmA: boolean, iNeedToAct: boolean): { status: string; cta: string | null } {
  if (state === 'no_overlap')   return { status: 'No overlap found', cta: 'Try different times →' };
  if (state === 'computing')    return { status: 'Finding a time...', cta: null };
  if (iNeedToAct)               return { status: 'Set your availability', cta: 'Set availability →' };
  return { status: 'Waiting for them', cta: null };
}

function needsMyAction(state: string, iAmA: boolean): boolean {
  if (state === 'pending_both') return true;
  if (state === 'pending_a')    return iAmA;
  if (state === 'pending_b')    return !iAmA;
  return false;
}

function SchedulingCard({ card, onSetAvailability }: { card: SchedulingCard; onSetAvailability: () => void }) {
  const iNeedToAct = needsMyAction(card.schedulingState, card.iAmA);
  const { status, cta } = schedulingLabel(card.schedulingState, card.iAmA, iNeedToAct);
  const nativeFlag   = LANG_FLAGS[card.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[card.learningLang] ?? '';

  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4 flex items-center gap-4">
      <Avatar name={card.name} lang={card.nativeLang} avatarUrl={card.avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#171717] text-base truncate">{card.name}</p>
        <div className="flex items-center gap-1 text-xs text-stone-400 mt-0.5">
          <span>{nativeFlag} {card.nativeLang}</span>
          <span className="text-stone-300">↔</span>
          <span>{learningFlag} {card.learningLang}</span>
        </div>
        <p className="text-xs text-stone-400 mt-1">{status}</p>
      </div>
      {cta && (
        <button
          onClick={onSetAvailability}
          className="shrink-0 px-3 py-2 btn-primary text-white text-xs font-semibold rounded-xl whitespace-nowrap"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

// ── Upcoming card (ticket) ────────────────────────────────────────────────────

function isJoinable(scheduledAt: string, now: number): boolean {
  const t = new Date(scheduledAt).getTime();
  return (t - now) <= 30 * 60 * 1000 && (now - t) <= 60 * 60 * 1000;
}

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

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-dashed border-stone-200">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${statusPill.cls}`}>
          {statusPill.label}
        </span>
        <div className="flex items-center gap-4">
          <Avatar name={card.name} lang={card.nativeLang} avatarUrl={card.avatarUrl} />
          <div className="flex-1 min-w-0">
            <p className="font-serif font-bold text-[#171717] text-2xl leading-tight">{card.name}</p>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400">
              <span>{nativeFlag} {card.nativeLang}</span>
              <span className="text-stone-300">↔</span>
              <span>{learningFlag} {card.learningLang}</span>
            </div>
          </div>
          <div className="relative shrink-0">
            <button onClick={() => setShowOverflow(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-300">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/>
              </svg>
            </button>
            {showOverflow && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-lg border border-stone-100 py-1 w-44 text-sm">
                  <button onClick={() => { setShowOverflow(false); onViewProfile(); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">View profile</button>
                  <button onClick={() => { setShowOverflow(false); window.dispatchEvent(new CustomEvent('mutua:open-chat', { detail: { matchId: card.matchId } })); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Say hi 👋</button>
                  <button onClick={() => { setShowOverflow(false); onReschedule(); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Reschedule</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="px-6 py-5">
        <p className="text-xs text-stone-400 font-medium mb-1">{sessionPassed ? 'Session passed' : 'Session time'}</p>
        <p className="font-serif font-bold text-[#171717] text-2xl leading-snug">{dateLine}</p>
        <p className="text-lg font-semibold text-stone-500 mt-0.5">{timeLine}</p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('mutua:open-chat', { detail: { matchId: card.matchId } }))}
            className="px-4 py-3 border border-stone-200 bg-white text-sm text-neutral-500 font-medium rounded-xl hover:bg-stone-50 transition-colors"
          >
            Say hi 👋
          </button>
          <button
            onClick={sessionPassed ? onReschedule : onJoin}
            className="px-5 py-3 btn-primary text-white text-sm font-semibold rounded-xl"
          >
            {sessionPassed ? 'Reschedule →' : isLive ? 'Join now →' : 'Start exchange →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Past card ─────────────────────────────────────────────────────────────────

function PastCard({ card, onReschedule }: { card: PastCard; onReschedule: () => void }) {
  const mins = Math.round(card.durationSecs / 60);
  const date = new Date(card.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4 flex items-center gap-4">
      <Avatar name={card.name} lang={card.nativeLang} avatarUrl={card.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#171717] text-sm truncate">{card.name}</p>
        <p className="text-xs text-stone-400 mt-0.5">{date} · {mins > 0 ? `${mins}m` : `${card.durationSecs}s`}</p>
      </div>
      <button
        onClick={onReschedule}
        className="shrink-0 px-3 py-2 border border-stone-200 text-xs font-medium text-neutral-600 rounded-xl hover:bg-stone-50 transition-colors"
      >
        Schedule again
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExchangesPage() {
  const router = useRouter();
  const [sessionId,  setSessionId]  = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<SchedulingCard[]>([]);
  const [upcoming,   setUpcoming]   = useState<UpcomingCard[]>([]);
  const [past,       setPast]       = useState<PastCard[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async (sid: string) => {
    const now = Date.now();
    const matches = await getMatchesBySessionId(sid);

    // Fetch partner profiles in one batch
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
      const isA       = m.session_id_a === sid;
      const partnerId = isA ? m.session_id_b : m.session_id_a;
      const prof      = profileMap[partnerId];
      const name      = prof?.name || (isA ? (m.name_b ?? 'Partner') : (m.name_a ?? 'Partner'));
      const nativeLang   = isA ? (m.native_language_b ?? '') : (m.native_language_a ?? '');
      const learningLang = isA ? (m.native_language_a ?? '') : (m.native_language_b ?? '');

      if (m.scheduling_state === 'scheduled' && m.scheduled_at &&
          now - new Date(m.scheduled_at).getTime() <= 60 * 60 * 1000) {
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
      const pastProfileMap: Record<string, { name: string; avatarUrl: string | null; nativeLang: string }> = {};
      for (const p of pastProfiles ?? []) {
        pastProfileMap[p.session_id] = { name: p.name ?? '', avatarUrl: p.avatar_url ?? null, nativeLang: p.native_language ?? '' };
      }
      setPast(logs.map(l => ({
        logId:        l.id,
        partnerId:    l.partner_id,
        name:         pastProfileMap[l.partner_id]?.name || 'Partner',
        nativeLang:   pastProfileMap[l.partner_id]?.nativeLang || '',
        avatarUrl:    pastProfileMap[l.partner_id]?.avatarUrl ?? null,
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

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-8">
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
            {upcoming.length > 0 && (
              <Section title="Upcoming">
                {upcoming.map(card => (
                  <UpcomingCard
                    key={card.matchId}
                    card={card}
                    onJoin={() => handleJoin(card)}
                    onReschedule={() => handleReschedule(card.matchId, card.name, 'scheduled')}
                    onViewProfile={() => router.push(`/partner/${card.matchId}`)}
                  />
                ))}
              </Section>
            )}

            {scheduling.length > 0 && (
              <Section title="Scheduling">
                {scheduling.map(card => (
                  <SchedulingCard
                    key={card.matchId}
                    card={card}
                    onSetAvailability={() => handleReschedule(card.matchId, card.name, card.schedulingState)}
                  />
                ))}
              </Section>
            )}

            {past.length > 0 && (
              <Section title="Past">
                {past.map(card => (
                  <PastCard
                    key={card.logId}
                    card={card}
                    onReschedule={() => {
                      localStorage.setItem('mutua_scheduling_partner', card.name);
                      router.push(`/history`);
                    }}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
