'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchBySessionId, type Match, type SchedulingState } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR, INTEREST_CATEGORIES, INTEREST_MIGRATION } from '@/lib/constants';
import { track } from '@/lib/analytics';
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

function daysLabel(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

// ── Scheduling partner card ───────────────────────────────────────────────────

function SchedulingCard({
  partner,
  onReschedule,
  onJoin,
  onBookExchange,
  onViewProfile,
  onMessage,
}: {
  partner:         PartnerCard;
  onReschedule:    () => void;
  onJoin:          () => void;
  onBookExchange:  () => void;
  onViewProfile:   () => void;
  onMessage:       () => void;
}) {
  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';

  const [showPicker, setShowPicker] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

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
    <div className="overflow-hidden bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)]">

      {/* Header — avatar + name + badge */}
      <button onClick={onViewProfile} className="w-full text-left">
        <div className="px-6 pt-6 pb-5 flex items-start gap-4">
          <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-serif font-bold text-[#171717] text-2xl leading-tight">{partner.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-sm">
              <span className="text-stone-500">{nativeFlag} {partner.nativeLang}</span>
              <span className="text-stone-300">→</span>
              <span className="text-[#2B8FFF] font-medium">{learningFlag} {partner.learningLang}</span>
            </div>
          </div>
          <div className="shrink-0">
            {s === 'scheduled' && (
              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full block">Scheduled</span>
            )}
            {waitingOnPartner && (
              <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full block">Waiting</span>
            )}
            {s === 'no_overlap' && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full block">No overlap</span>
            )}
            {s === 'computing' && (
              <span className="text-xs font-semibold text-[#2B8FFF] bg-blue-50 px-2.5 py-1 rounded-full block">Matching…</span>
            )}
          </div>
        </div>
      </button>

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

      {/* State-driven footer */}
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

      {s === 'scheduled' && partner.scheduledAt && (
        <div className="px-6 pb-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-400">First session</p>
              <p className="font-semibold text-neutral-800 text-sm mt-1">{fmtScheduledAt(partner.scheduledAt)}</p>
            </div>
            <span className="text-xs font-semibold text-[#2B8FFF] bg-blue-50 px-2.5 py-1 rounded-full shrink-0">
              {daysLabel(partner.scheduledAt)}
            </span>
          </div>
          {isJoinable(partner.scheduledAt, now) ? (
            <button onClick={onJoin} className="w-full py-3 btn-primary text-white text-sm rounded-xl">
              Join session →
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={onMessage} className="flex-1 py-3 btn-primary text-white text-sm rounded-xl">
                Message {partner.name.split(' ')[0]} →
              </button>
              <button onClick={onReschedule} className="px-4 py-3 border border-stone-200 text-sm text-neutral-500 font-medium rounded-xl hover:bg-stone-50 transition-colors">
                Reschedule
              </button>
            </div>
          )}
        </div>
      )}

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

      // Sync interests from localStorage → DB so partner can see them
      const storedProfile = localStorage.getItem('mutua_profile');
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

  const handleJoin    = () => router.push('/pre-session');
  const handleMessage = () => router.push('/messages');

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-6">

        {/* Context header */}
        <div>
          <h1 className="font-serif font-semibold text-2xl text-[#171717]">
            {!loading && partner?.schedulingState === 'scheduled' ? 'Upcoming session' : 'Your exchange'}
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            {loading ? '' : partner
              ? partner.schedulingState === 'scheduled'
                ? `You're all set with ${partner.name}. Say hello before you meet.`
                : 'You have an active language partner.'
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
            onMessage={handleMessage}
          />
        ) : (
          <div className="bg-white/60 border border-stone-200 border-dashed rounded-2xl px-6 py-10 text-center">
            <p className="text-sm text-stone-400">No partners yet — we'll email you when we find a match.</p>
          </div>
        )}

      </main>


    </AppShell>
  );
}
