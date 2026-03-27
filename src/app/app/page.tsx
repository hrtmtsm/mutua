'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchBySessionId, type Match, type SchedulingState } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR, INTEREST_CATEGORIES, INTEREST_MIGRATION } from '@/lib/constants';
import { track } from '@/lib/analytics';
import AppShell from '@/components/AppShell';
import { ArrowLeftRight } from 'lucide-react';

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
  sharedInterests:  string[];
  bio?:             string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, lang, avatarUrl, size = 'md' }: { name: string; lang: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const bg  = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const cls = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  const [imgFailed, setImgFailed] = useState(false);
  if (avatarUrl && !imgFailed) {
    return (
      <div className={`${cls} rounded-2xl overflow-hidden shrink-0`}>
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return (
    <div
      style={{ backgroundColor: bg }}
      className={`${cls} rounded-2xl flex items-center justify-center font-black text-white shrink-0`}
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
    avatarUrl:       null,
    sharedInterests: [],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isJoinable(scheduledAt: string, now: number): boolean {
  const t = new Date(scheduledAt).getTime();
  return (t - now) <= 30 * 60 * 1000 && (now - t) <= 60 * 60 * 1000;
}

// ── Scheduling partner card ───────────────────────────────────────────────────

function SchedulingCard({
  partner,
  onReschedule,
  onJoin,
  onBookExchange,
  onViewProfile,
  onMessage,
  myName,
  myAvatarUrl,
}: {
  partner:         PartnerCard;
  onReschedule:    () => void;
  onJoin:          () => void;
  onBookExchange:  () => void;
  onViewProfile:   () => void;
  onMessage?:      () => void;
  myName?:         string;
  myAvatarUrl?:    string | null;
}) {
  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';

  const [showNotYet,  setShowNotYet]  = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const s = partner.schedulingState;
  const iNeedToSet =
    s === 'pending_both' ||
    (s === 'pending_a' && partner.iAmA) ||
    (s === 'pending_b' && !partner.iAmA);
  const waitingOnPartner =
    (s === 'pending_a' && !partner.iAmA) ||
    (s === 'pending_b' && partner.iAmA);

  // ── Scheduled state: focused card ─────────────────────────────────────────
  if (s === 'scheduled' && partner.scheduledAt) {
    const sessionDate = new Date(partner.scheduledAt);
    const dateLine = sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeLine = sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return (
      <div className="overflow-hidden bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-center gap-4">
          {/* Dual avatar */}
          <div className="relative shrink-0 flex items-center" style={{ width: 104, height: 64 }}>
            <div className="absolute left-0" style={{ transform: 'rotate(-6deg)', zIndex: 1 }}>
              <Avatar name={myName ?? 'Me'} lang={partner.learningLang} avatarUrl={myAvatarUrl} size="lg" />
            </div>
            <div className="absolute right-0" style={{ transform: 'rotate(6deg)', zIndex: 2 }}>
              <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-serif font-bold text-[#171717] text-2xl leading-tight">{partner.name}</p>
            <div className="flex items-center gap-1.5 mt-1 text-sm">
              <span className="text-stone-500">{nativeFlag} {partner.nativeLang}</span>
              <ArrowLeftRight size={12} className="text-stone-300 shrink-0" />
              <span className="text-stone-500">{learningFlag} {partner.learningLang}</span>
            </div>
          </div>
          {/* Three-dot overflow */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowOverflow(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-400"
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
                  {onMessage && <button onClick={() => { setShowOverflow(false); onMessage(); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Message</button>}
                  <button onClick={() => { setShowOverflow(false); onReschedule(); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Reschedule</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="px-6 pb-6">
          <p className="font-serif font-bold text-[#171717] text-3xl leading-tight">{dateLine}</p>
          <p className="text-stone-400 text-2xl mt-1">{timeLine}</p>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <button
            onClick={() => isJoinable(partner.scheduledAt!, now) ? onJoin() : setShowNotYet(true)}
            className="w-full py-3 btn-primary text-white text-sm rounded-xl"
          >
            Start exchange →
          </button>
        </div>

        {showNotYet && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
            <div className="bg-white rounded-2xl p-7 max-w-sm w-full space-y-4 shadow-xl">
              <div>
                <p className="font-semibold text-neutral-900 text-base">Session not started yet</p>
                <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                  Your session with <span className="font-medium text-neutral-700">{partner.name}</span> begins on{' '}
                  <span className="font-medium text-neutral-700">{fmtScheduledAt(partner.scheduledAt!)}</span>.
                  Come back then to join.
                </p>
              </div>
              <button
                onClick={() => setShowNotYet(false)}
                className="w-full py-3 bg-stone-100 hover:bg-stone-200 transition-colors text-neutral-700 font-semibold text-sm rounded-xl"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── All other states: full card ────────────────────────────────────────────
  return (
    <div className="overflow-hidden bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)]">

      {/* Header — avatar + name + overflow */}
      <div className="px-6 pt-6 pb-5 flex items-start gap-4">
        <button onClick={onViewProfile} className="shrink-0">
          <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
        </button>
        <button onClick={onViewProfile} className="flex-1 min-w-0 pt-0.5 text-left">
          <p className="font-serif font-bold text-[#171717] text-2xl leading-tight">{partner.name}</p>
          <div className="flex items-center gap-1.5 mt-1.5 text-sm">
            <span className="text-stone-500">{nativeFlag} {partner.nativeLang}</span>
            <ArrowLeftRight size={12} className="text-stone-300 shrink-0" />
            <span className="text-stone-500">{learningFlag} {partner.learningLang}</span>
          </div>
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowOverflow(v => !v)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-400"
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bio */}
      {partner.bio && (
        <div className="px-6 pb-5">
          <p className="text-xs font-medium text-stone-400 mb-1.5">About</p>
          <p className="text-sm text-stone-500 leading-relaxed">{partner.bio}</p>
        </div>
      )}

      {/* In common */}
      <div className="px-6 pb-5">
        <p className="text-xs font-medium text-stone-400 mb-2.5">In common</p>
        <div className="flex flex-wrap gap-1.5">
          {[partner.goal, partner.commStyle, partner.frequency, ...partner.sharedInterests].filter(Boolean).map((v, i) => (
            <span key={i} className="px-2.5 py-1 bg-stone-100 text-xs font-medium text-stone-500 rounded-full">{v}</span>
          ))}
        </div>
      </div>

      {iNeedToSet && (
        <div className="px-6 pb-6">
          <button onClick={onBookExchange} className="w-full py-3 btn-primary text-white text-sm rounded-xl">
            Pick a time to meet →
          </button>
        </div>
      )}

      {waitingOnPartner && (
        <div className="px-6 pb-6">
          <p className="text-sm text-stone-400">
            You're set — waiting on <span className="font-medium text-neutral-600">{partner.name}</span> to share their availability.
          </p>
        </div>
      )}

      {s === 'computing' && (
        <div className="px-6 pb-6">
          <p className="text-sm text-stone-400">Finding a time that works for both of you…</p>
        </div>
      )}

      {s === 'no_overlap' && (
        <div className="px-6 pb-6 space-y-3">
          <p className="text-sm text-stone-400">No overlapping slots yet. Update your free times and we'll keep trying.</p>
          <button onClick={onBookExchange} className="w-full py-3 btn-primary text-white text-sm rounded-xl">
            Update my availability →
          </button>
        </div>
      )}

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const [partner,      setPartner]      = useState<PartnerCard | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [matchId,      setMatchId]      = useState<string | null>(null);
  const [sessionId,    setSessionId]    = useState<string | null>(null);
  const [myName,       setMyName]       = useState<string | undefined>();
  const [myAvatarUrl,  setMyAvatarUrl]  = useState<string | null>(null);

  const loadMatch = useCallback(async (sid: string) => {
    try {
      const m = await getMatchBySessionId(sid);
      if (!m) return false;

      const isA = m.session_id_a === sid;
      const partnerSessionId = isA ? m.session_id_b : m.session_id_a;

      const { data: partnerProfile } = await supabase
        .from('profiles').select('name, avatar_url, interests, bio').eq('session_id', partnerSessionId).maybeSingle();

      const allTags = INTEREST_CATEGORIES.flatMap(c => c.tags);
      const normalizeTags = (s?: string | null): string[] => {
        if (!s) return [];
        return [...new Set(
          s.split(',').map(t => t.trim()).filter(Boolean).map(t => {
            const exact = allTags.find(tag => tag.toLowerCase() === t.toLowerCase());
            if (exact) return exact;
            const migrationKey = Object.keys(INTEREST_MIGRATION).find(k => k.toLowerCase() === t.toLowerCase());
            return migrationKey ? INTEREST_MIGRATION[migrationKey] : null;
          }).filter(Boolean) as string[]
        )];
      };
      const myStoredProfile = localStorage.getItem('mutua_profile');
      const myRaw = myStoredProfile ? JSON.parse(myStoredProfile).interests : null;
      const myInterests = normalizeTags(myRaw);
      const partnerInterests = normalizeTags(partnerProfile?.interests);
      const sharedInterests = myInterests.filter(t => partnerInterests.includes(t));

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const storageAvatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${partnerSessionId}.jpg`;

      const card = partnerFromMatch(m, sid);
      if (partnerProfile?.name) card.name = partnerProfile.name;
      card.avatarUrl = partnerProfile?.avatar_url ?? storageAvatarUrl;
      card.sharedInterests = sharedInterests;
      card.bio = partnerProfile?.bio ?? undefined;

      setPartner(card);
      setMatchId(m.id);

      // Auto-fire confirm notification once per user per match
      if (card.schedulingState === 'scheduled' && !localStorage.getItem(`mutua_autoconfirmed_${m.id}`)) {
        localStorage.setItem(`mutua_autoconfirmed_${m.id}`, '1');
        const myName = (() => { try { return JSON.parse(localStorage.getItem('mutua_profile') ?? '{}').name ?? ''; } catch { return ''; } })();
        fetch('/api/confirm-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: m.id, partnerEmail: '', scheduledTime: card.scheduledAt ? new Date(card.scheduledAt).toLocaleString() : '', confirmerName: myName }),
        }).catch(() => {});
      }
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
      sharedInterests: [],
    });
    return true;
  }, []);

  useEffect(() => {
    async function init() {
      const sid = localStorage.getItem('mutua_session_id');
      if (!sid) { router.replace('/onboarding'); return; }
      setSessionId(sid);

      // Load my own name + avatar
      const storedProfile = localStorage.getItem('mutua_profile');
      if (storedProfile) {
        try {
          const p = JSON.parse(storedProfile);
          if (p.name) setMyName(p.name);
        } catch { /* ignore */ }
      }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      setMyAvatarUrl(`${supabaseUrl}/storage/v1/object/public/avatars/${sid}.jpg`);

      // Sync interests from localStorage → DB so partner can see them
      if (storedProfile) {
        try {
          const p = JSON.parse(storedProfile);
          if (p.interests) {
            supabase.from('profiles').update({ interests: p.interests }).eq('session_id', sid).then(() => {});
          }
        } catch { /* ignore */ }
      }

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
          <h1 className="font-serif font-semibold text-2xl text-[#171717]">Your exchange</h1>
          <p className="text-sm text-stone-400 mt-1">
            {loading ? '' : partner
              ? 'You have an active language partner.'
              : 'No partner yet — we\'ll reach out when we find your match.'}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading...</p>
        ) : partner ? (
          <SchedulingCard
            partner={partner}
            onReschedule={handleReschedule}
            onJoin={handleJoin}
            onBookExchange={handleBookExchange}
            onViewProfile={() => router.push(`/partner/${partner.matchId}`)}
            myName={myName}
            myAvatarUrl={myAvatarUrl}
          />
        ) : (
          <div className="bg-white/60 border border-stone-200 border-dashed rounded-2xl px-6 py-10 text-center">
            <p className="text-sm text-stone-400">No partners yet — we'll email you when we find a match.</p>
          </div>
        )}

        {/* ── DEV PREVIEW: both card states ── */}
        <div className="mt-10 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-300">Preview — unscheduled</p>
          <SchedulingCard
            partner={{
              matchId: 'test-1', id: 'p1', name: 'Sofia Reyes',
              nativeLang: 'Spanish', learningLang: 'English',
              goal: 'Conversational', commStyle: 'Casual', frequency: 'Weekly',
              reasons: [], schedulingState: 'pending_both', scheduledAt: null,
              iAmA: true, avatarUrl: null,
              sharedInterests: ['Travel', 'Music'],
              bio: 'Software engineer based in Mexico City. I love hiking and indie music.',
            }}
            onReschedule={() => {}} onJoin={() => {}} onBookExchange={() => {}} onViewProfile={() => {}}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-300">Preview — scheduled</p>
          <SchedulingCard
            partner={{
              matchId: 'test-2', id: 'p2', name: 'Sofia Reyes',
              nativeLang: 'Spanish', learningLang: 'English',
              goal: 'Conversational', commStyle: 'Casual', frequency: 'Weekly',
              reasons: [], schedulingState: 'scheduled',
              scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
              iAmA: true, avatarUrl: null, sharedInterests: [], bio: undefined,
            }}
            myName={myName ?? 'You'}
            myAvatarUrl={myAvatarUrl}
            onReschedule={() => {}} onJoin={() => {}} onBookExchange={() => {}} onViewProfile={() => {}}
          />
        </div>
        {/* ── end DEV PREVIEW ── */}

      </main>


    </AppShell>
  );
}
