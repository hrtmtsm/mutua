'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchBySessionId, type Match, type SchedulingState } from '@/lib/supabase';
import { LANG_FLAGS } from '@/lib/constants';
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  Japanese:   '#3b82f6',
  Korean:     '#8b5cf6',
  Mandarin:   '#ef4444',
  Spanish:    '#f59e0b',
  French:     '#10b981',
  English:    '#6366f1',
  Portuguese: '#f97316',
  German:     '#64748b',
  Italian:    '#ec4899',
  Arabic:     '#14b8a6',
};

function Avatar({ name, lang, size = 'md' }: { name: string; lang: string; size?: 'sm' | 'md' }) {
  const bg  = LANG_COLORS[lang] ?? '#3b82f6';
  const cls = size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  return (
    <div
      style={{ backgroundColor: bg }}
      className={`${cls} rounded-xl flex items-center justify-center font-black text-white shrink-0`}
    >
      {name.trim().slice(0, 2).toUpperCase()}
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
  };
}

// ── Scheduling partner card ───────────────────────────────────────────────────

function SchedulingCard({
  partner,
  onConfirm,
  onReschedule,
  onJoin,
  onBookExchange,
}: {
  partner:         PartnerCard;
  onConfirm:       (matchId: string, scheduledAt: string) => void;
  onReschedule:    () => void;
  onJoin:          () => void;
  onBookExchange:  () => void;
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
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-4">
        <Avatar name={partner.name} lang={partner.nativeLang} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-neutral-900 text-lg leading-tight">{partner.name}</p>
        </div>
        {s === 'scheduled' && (
          <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-xs font-semibold text-green-700 rounded-full shrink-0">
            Scheduled
          </span>
        )}
        {waitingOnPartner && (
          <span className="px-2.5 py-1 bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-500 rounded-full shrink-0">
            Waiting
          </span>
        )}
        {s === 'no_overlap' && (
          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-600 rounded-full shrink-0">
            No slots matched
          </span>
        )}
        {s === 'computing' && (
          <span className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-xs font-semibold text-[#2B8FFF] rounded-full shrink-0">
            Finding a match
          </span>
        )}
      </div>

      {/* Language blocks */}
      <div className="px-6 pb-4 grid grid-cols-2 gap-3">
        <div className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Native</p>
          <p className="font-bold text-neutral-900 text-base">{nativeFlag} {partner.nativeLang}</p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Practicing</p>
          <p className="font-bold text-neutral-900 text-base">{learningFlag} {partner.learningLang}</p>
        </div>
      </div>

      {/* In common */}
      {partner.reasons.length > 0 && (
        <div className="px-6 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">In common</p>
          <div className="flex flex-wrap gap-1.5">
            {partner.reasons.slice(0, 3).map((r, i) => (
              <span key={i} className="px-2.5 py-1 bg-stone-100 border border-stone-200 text-xs font-medium text-stone-600 rounded-full">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── State-driven footer ── */}
      <div className="px-6 pb-5 pt-4 border-t border-stone-100">

        {/* Schedule exchange CTA */}
        {iNeedToSet && (
          <button
            onClick={onBookExchange}
            className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl"
          >
            Schedule your exchange →
          </button>
        )}

        {/* Waiting on partner */}
        {waitingOnPartner && (
          <p className="text-sm text-stone-500">
            You're all set. Waiting for <span className="font-semibold text-neutral-900">{partner.name}</span> to share their availability.
          </p>
        )}

        {/* Computing */}
        {s === 'computing' && (
          <p className="text-sm text-stone-500">
            Looking for a time that works for both of you.
          </p>
        )}

        {/* No overlap */}
        {s === 'no_overlap' && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              Your schedules don't overlap yet. Update your free times and we'll match you automatically.
            </p>
            <button
              onClick={onBookExchange}
              className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl"
            >
              Update my free times →
            </button>
          </div>
        )}

        {/* Scheduled */}
        {s === 'scheduled' && partner.scheduledAt && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-stone-400">We found your first session</p>
              <p className="font-semibold text-neutral-900 text-sm mt-0.5">
                {fmtScheduledAt(partner.scheduledAt)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={onReschedule} className="text-sm text-stone-400 hover:text-neutral-900 font-medium transition-colors">
                Reschedule
              </button>
              <button
                onClick={() => onConfirm(partner.matchId, partner.scheduledAt!)}
                className="px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-sm"
              >
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
        .select('name')
        .eq('session_id', partnerSessionId)
        .maybeSingle();

      const card = partnerFromMatch(m, sid);
      if (partnerProfile?.name) card.name = partnerProfile.name;

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
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-8">

        <h1 className="font-serif font-black text-2xl text-neutral-900">Session</h1>

        {loading ? (
          <p className="text-sm text-stone-400">Loading...</p>
        ) : partner ? (
          <SchedulingCard
            partner={partner}
            onConfirm={handleConfirm}
            onReschedule={handleReschedule}
            onJoin={handleJoin}
            onBookExchange={handleBookExchange}
          />
        ) : (
          <div className="bg-stone-50 border border-stone-200 border-dashed rounded-2xl px-6 py-10 text-center">
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
              <p className="font-bold text-neutral-900 text-lg">Session confirmed</p>
              <p className="text-sm text-stone-500">
                Your first session with <span className="font-semibold text-neutral-900">{confirmed.name}</span>
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
