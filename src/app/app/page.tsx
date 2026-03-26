'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchBySessionId, type Match, type SchedulingState } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR, LANG_FLAG_CODE } from '@/lib/constants';
import AppShell from '@/components/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartnerCard {
  matchId:          string;
  id:               string;
  name:             string;
  nativeLang:       string;
  learningLang:     string;
  goal:             string;
  commStyle:        string;
  frequency:        string;
  reasons:          string[];
  schedulingState:  SchedulingState;
  scheduledAt:      string | null;   // UTC ISO string when scheduled
  iAmA:             boolean;         // true = I am session_id_a
  avatarUrl:        string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, lang, avatarUrl, size = 'md' }: { name: string; lang: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const bg  = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const cls = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  const flagCode = LANG_FLAG_CODE[lang];
  const inner = avatarUrl ? (
    <div className={`${cls} rounded-2xl overflow-hidden shrink-0`}>
      <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
    </div>
  ) : (
    <div
      style={{ backgroundColor: bg }}
      className={`${cls} rounded-2xl flex items-center justify-center font-black text-white shrink-0`}
    >
      {name.trim().slice(0, 2).toUpperCase()}
    </div>
  );
  return (
    <div className="relative shrink-0 inline-block">
      {inner}
      {flagCode && (
        <span
          className={`fi fi-${flagCode} fis absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-white shadow-sm overflow-hidden`}
          style={{ backgroundSize: 'cover' }}
        />
      )}
    </div>
  );
}

function fmtScheduledAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function partnerFromMatch(m: Match, sessionId: string): PartnerCard {
  const isA = m.session_id_a === sessionId;
  const state = (m.scheduling_state ?? 'pending_both') as SchedulingState;
  return {
    matchId:         m.id,
    id:              isA ? m.session_id_b : m.session_id_a,
    name:            isA ? (m.name_b ?? 'Your partner') : (m.name_a ?? 'Your partner'),
    nativeLang:      isA ? m.native_language_b : m.native_language_a,
    learningLang:    isA ? m.native_language_a : m.native_language_b,
    goal:            m.goal       ?? '',
    commStyle:       m.comm_style ?? '',
    frequency:       m.practice_frequency ?? '',
    reasons:         m.reasons    ?? [],
    schedulingState: state,
    scheduledAt:     m.scheduled_at ?? null,
    iAmA:            isA,
    avatarUrl:       null,
  };
}

// ── Scheduling partner card ───────────────────────────────────────────────────

function SchedulingCard({
  partner,
  onConfirm,
  onReschedule,
  onJoin,
  onBookExchange,
  onViewProfile,
}: {
  partner:         PartnerCard;
  onConfirm:       (matchId: string, scheduledAt: string) => void;
  onReschedule:    () => void;
  onJoin:          () => void;
  onBookExchange:  () => void;
  onViewProfile:   () => void;
}) {
  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';

  const [showPicker, setShowPicker] = useState(false);

  // Determine my pending state
  const s = partner.schedulingState;
  const iNeedToSet =
    s === 'pending_both' ||
    (s === 'pending_a' && partner.iAmA) ||
    (s === 'pending_b' && !partner.iAmA);
  const waitingOnPartner =
    (s === 'pending_a' && !partner.iAmA) ||
    (s === 'pending_b' && partner.iAmA);

  return (
    <div className="overflow-hidden bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.07)]">

      <button
        onClick={onViewProfile}
        className="w-full text-left block"
      >
        <div className="px-6 pt-6 pb-5 flex items-end gap-4">
          <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
          <div className="flex-1 min-w-0 pb-0.5">
            <p className="font-serif font-bold text-[#171717] text-xl leading-tight">{partner.name}</p>
            <p className="text-sm text-stone-500 mt-0.5">
              {nativeFlag} {partner.nativeLang} · learning {learningFlag} {partner.learningLang}
            </p>
          </div>
          {s === 'scheduled' && (
            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full shrink-0 self-start">Scheduled</span>
          )}
          {waitingOnPartner && (
            <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full shrink-0 self-start">Waiting</span>
          )}
          {s === 'no_overlap' && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full shrink-0 self-start">No overlap</span>
          )}
          {s === 'computing' && (
            <span className="text-xs font-semibold text-[#2B8FFF] bg-blue-50 px-2.5 py-1 rounded-full shrink-0 self-start">Matching…</span>
          )}
        </div>
      </button>

      {/* Shared context — no section label */}
      <div className="px-6 py-4 flex flex-wrap gap-1.5 border-t border-stone-100">
        {[partner.goal, partner.commStyle, partner.frequency].filter(Boolean).map((v, i) => (
          <span key={i} className="px-2.5 py-1 bg-stone-100 text-xs font-medium text-stone-500 rounded-full">{v}</span>
        ))}
      </div>

      {/* State-driven footer */}
      <div className="px-6 pb-5 pt-1 border-t border-stone-100">

        {iNeedToSet && (
          <button onClick={onBookExchange} className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl mt-3">
            Pick a time to meet →
          </button>
        )}

        {waitingOnPartner && (
          <p className="text-sm text-stone-400 mt-3">
            You're set — waiting on <span className="font-medium text-neutral-600">{partner.name}</span> to share their availability.
          </p>
        )}

        {s === 'computing' && (
          <p className="text-sm text-stone-400 mt-3">Finding a time that works for both of you…</p>
        )}

        {s === 'no_overlap' && (
          <div className="space-y-3 mt-3">
            <p className="text-sm text-stone-400">No overlapping slots yet. Update your free times and we'll keep trying.</p>
            <button onClick={onBookExchange} className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl">
              Update my availability →
            </button>
          </div>
        )}

        {s === 'scheduled' && partner.scheduledAt && (
          <div className="flex items-center justify-between gap-3 mt-3">
            <div>
              <p className="text-xs text-stone-400">First session</p>
              <p className="font-semibold text-neutral-800 text-sm mt-0.5">{fmtScheduledAt(partner.scheduledAt)}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={onReschedule} className="text-sm text-stone-400 hover:text-neutral-600 font-medium transition-colors">
                Reschedule
              </button>
              <button onClick={() => onConfirm(partner.matchId, partner.scheduledAt!)} className="px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl">
                Confirm →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const [partner,   setPartner]   = useState<PartnerCard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [matchId,   setMatchId]   = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ name: string; time: string } | null>(null);

  const loadMatch = useCallback(async (sid: string) => {
    try {
      const m = await getMatchBySessionId(sid);
      if (!m) return false;

      const isA = m.session_id_a === sid;
      const partnerSessionId = isA ? m.session_id_b : m.session_id_a;

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('session_id', partnerSessionId)
        .maybeSingle();

      const card = partnerFromMatch(m, sid);
      if (partnerProfile?.name) card.name = partnerProfile.name;
      if (partnerProfile?.avatar_url) card.avatarUrl = partnerProfile.avatar_url;

      setPartner(card);
      setMatchId(m.id);
      if (card.schedulingState === 'scheduled' && card.scheduledAt) {
        localStorage.setItem('mutua_last_notification', JSON.stringify({
          type: 'session_scheduled',
          partnerName: card.name,
          scheduledAt: card.scheduledAt,
        }));
      }
      return true;
    } catch (err) {
      console.error('loadMatch error:', err);
      return false;
    }
  }, []);

  // Fallback: build a card from localStorage if DB has no match yet
  const loadFromLocalStorage = useCallback(() => {
    const multi  = localStorage.getItem('mutua_partners');
    const single = localStorage.getItem('mutua_match');

    const raw = multi
      ? (JSON.parse(multi) as Array<{ partner: any; reasons?: string[] }>)[0]
      : single ? { partner: JSON.parse(single).partner, reasons: JSON.parse(single).reasons } : null;

    if (!raw?.partner) return false;
    const p = raw.partner;
    setPartner({
      matchId:         '',
      id:              p.session_id        ?? 'demo',
      name:            p.name              ?? 'Your partner',
      nativeLang:      p.native_language,
      learningLang:    p.learning_language,
      goal:            p.goal              ?? '',
      commStyle:       p.comm_style        ?? '',
      frequency:       p.practice_frequency ?? '',
      reasons:         raw.reasons         ?? [],
      schedulingState: 'pending_both',
      scheduledAt:     null,
      iAmA:            true,
      avatarUrl:       null,
    });
    return true;
  }, []);

  useEffect(() => {
    async function init() {
      const sid = localStorage.getItem('mutua_session_id');
      if (!sid) { router.replace('/onboarding'); return; }
      setSessionId(sid);

      const found = await loadMatch(sid);
      if (!found) loadFromLocalStorage();

      // If user just saved availability, optimistically show computing state
      // so they don't see stale data while the server catches up
      if (localStorage.getItem('mutua_just_saved_availability')) {
        localStorage.removeItem('mutua_just_saved_availability');
        setPartner(p => p ? { ...p, schedulingState: 'computing', scheduledAt: null } : p);
      }

      setLoading(false);
    }
    init();
  }, [router, loadMatch]);

  // Re-fetch when user returns to this tab (e.g. back from /set-availability)
  useEffect(() => {
    if (!sessionId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadMatch(sessionId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sessionId, loadMatch]);

  // Poll when state is 'computing' — re-fetch every 4s until it resolves
  useEffect(() => {
    if (!partner || !sessionId) return;
    if (partner.schedulingState !== 'computing') return;

    const interval = setInterval(async () => {
      const prevState = partner.schedulingState;
      await loadMatch(sessionId);
      // If resolved to scheduled, set unread badge on the bell
      setPartner(p => {
        if (p && prevState === 'computing' && p.schedulingState === 'scheduled') {
          localStorage.setItem('mutua_unread_notification', 'session_scheduled');
        }
        return p;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [partner?.schedulingState, sessionId, loadMatch]);

  const handleBookExchange = () => {
    if (partner) localStorage.setItem('mutua_scheduling_partner', partner.name);
    const params = new URLSearchParams();
    if (partner?.matchId)         params.set('matchId', partner.matchId);
    if (partner?.schedulingState) params.set('schedulingState', partner.schedulingState);
    router.push(`/set-availability?${params.toString()}`);
  };

  const handleAvailabilitySaved = (mId: string) => {
    // Optimistically move to computing, then poll
    setPartner(p => p ? { ...p, schedulingState: 'computing' } : p);
    if (sessionId) loadMatch(sessionId);
  };

  const handleConfirm = async (mId: string, scheduledAt: string) => {
    const p = partner;
    if (!p) return;

    // Update DB status to confirmed
    await fetch('/api/confirm-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId:       mId,
        partnerEmail:  '', // email handled by DB — confirm-session still fires notification
        scheduledTime: fmtScheduledAt(scheduledAt),
        confirmerName: localStorage.getItem('mutua_profile')
          ? JSON.parse(localStorage.getItem('mutua_profile')!).name ?? ''
          : '',
      }),
    }).catch(() => {});

    setConfirmed({ name: p.name, time: fmtScheduledAt(scheduledAt) });
    setPartner(prev => prev ? { ...prev, schedulingState: 'scheduled' } : prev);
  };

  const handleReschedule = () => {
    if (partner) localStorage.setItem('mutua_scheduling_partner', partner.name);
    const params = new URLSearchParams();
    if (partner?.matchId)         params.set('matchId', partner.matchId);
    if (partner?.schedulingState) params.set('schedulingState', partner.schedulingState);
    router.push(`/set-availability?${params.toString()}`);
  };

  const handleJoin = () => router.push('/pre-session');

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-6">

        {/* Context header */}
        <div>
          <h1 className="font-serif font-bold text-3xl text-[#171717]">Your exchange</h1>
          <p className="text-sm text-stone-400 mt-1">
            {loading ? '' : partner
              ? 'You have an active language partner. Confirm your first session to get started.'
              : 'No partner yet — we\'ll reach out when we find your match.'}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading...</p>
        ) : partner ? (
          <SchedulingCard
            partner={partner}
            onConfirm={handleConfirm}
            onReschedule={handleReschedule}
            onJoin={handleJoin}
            onBookExchange={handleBookExchange}
            onViewProfile={() => router.push(`/partner/${partner.matchId}`)}
          />
        ) : (
          <div className="bg-white/60 border border-stone-200 border-dashed rounded-2xl px-6 py-10 text-center">
            <p className="text-sm text-stone-400">No partners yet — we'll email you when we find a match.</p>
          </div>
        )}

      </main>

      {/* Confirmation toast */}
      {confirmed && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-5 shadow-xl">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-neutral-500 text-lg">Session confirmed</p>
              <p className="text-sm text-stone-500">
                Your first session with <span className="font-semibold text-neutral-500">{confirmed.name}</span>
              </p>
              <p className="font-bold text-[#2B8FFF] text-base">{confirmed.time}</p>
            </div>
            <button
              onClick={() => setConfirmed(null)}
              className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </AppShell>
  );
}
