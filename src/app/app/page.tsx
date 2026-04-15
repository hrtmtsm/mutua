'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchesBySessionId, type Match, type SchedulingState } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR, INTEREST_CATEGORIES, INTEREST_MIGRATION } from '@/lib/constants';
import type { SavedPartner } from '@/lib/types';
import { track } from '@/lib/analytics';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
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
  const cls = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (() => { const p = name.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.trim().slice(0, 2)).toUpperCase(); })();
  return (
    <div style={{ backgroundColor: bg }} className={`${cls} rounded-full flex items-center justify-center font-black text-white shrink-0 overflow-hidden relative`}>
      <span className="select-none">{initials}</span>
      {avatarUrl && !imgFailed && (
        <img
          src={avatarUrl}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgFailed(true)}
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
    name:            isA ? (m.name_b ?? m.email_b?.split('@')[0] ?? 'Your partner') : (m.name_a ?? m.email_a?.split('@')[0] ?? 'Your partner'),
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
  const router = useRouter();

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

  // ── Scheduled state: compact upcoming badge, or fall through to reschedule if missed ──
  if (s === 'scheduled' && partner.scheduledAt) {
    const sessionDate   = new Date(partner.scheduledAt);
    const sessionPassed = now - sessionDate.getTime() > 60 * 60 * 1000;
    const isLive        = isJoinable(partner.scheduledAt, now);

    // Missed sessions: show partner profile card with reschedule action (no missed indicator)
    if (sessionPassed) {
      const pills = [partner.goal, partner.commStyle, partner.frequency, ...partner.sharedInterests].filter(Boolean).slice(0, 4);
      return (
        <div className="overflow-hidden bg-white rounded-2xl border border-stone-200">
          <div className="px-7 pt-6 pb-0 flex items-start gap-4">
            <button onClick={onViewProfile} className="shrink-0">
              <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
            </button>
            <button onClick={onViewProfile} className="flex-1 min-w-0 text-left">
              <p className="font-serif font-bold text-[#171717] text-2xl leading-tight truncate">{partner.name}</p>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400">
                <span>{nativeFlag} {partner.nativeLang}</span>
                <ArrowLeftRight size={11} className="shrink-0" />
                <span>{learningFlag} {partner.learningLang}</span>
              </div>
            </button>
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
                    <button onClick={() => { setShowOverflow(false); window.dispatchEvent(new Event('mutua:open-chat')); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Say hi 👋</button>
                  </div>
                </>
              )}
            </div>
          </div>
          {partner.bio && <div className="px-7 mt-4"><p className="text-sm text-neutral-700 leading-relaxed">{partner.bio}</p></div>}
          {pills.length > 0 && (
            <div className="px-7 mt-4">
              <p className="text-xs text-stone-400 font-medium mb-2">In common</p>
              <div className="flex flex-wrap gap-1.5">
                {pills.map((v, i) => <span key={i} className="px-3 py-1 bg-stone-100 text-sm font-medium text-stone-600 rounded-full">{v}</span>)}
              </div>
            </div>
          )}
          <div className="px-7 mt-6 pb-7">
            <button onClick={onReschedule} className="px-5 py-3 btn-primary text-white text-sm font-semibold rounded-xl">
              Reschedule →
            </button>
          </div>
        </div>
      );
    }

    // Upcoming: compact badge linking to Exchanges
    const statusPill = isLive
      ? { label: '● Live now', cls: 'bg-emerald-50 text-emerald-600' }
      : { label: 'Upcoming', cls: 'bg-blue-50 text-blue-600' };

    return (
      <div className="overflow-hidden bg-white rounded-2xl border border-stone-200">
        <div className="px-7 pt-6 pb-0 flex items-start gap-4">
          <button onClick={onViewProfile} className="shrink-0">
            <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
          </button>
          <button onClick={onViewProfile} className="flex-1 min-w-0 text-left">
            <p className="font-serif font-bold text-[#171717] text-2xl leading-tight truncate">{partner.name}</p>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400">
              <span>{nativeFlag} {partner.nativeLang}</span>
              <ArrowLeftRight size={11} className="shrink-0" />
              <span>{learningFlag} {partner.learningLang}</span>
            </div>
          </button>
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
                  <button onClick={() => { setShowOverflow(false); window.dispatchEvent(new Event('mutua:open-chat')); }} className="w-full px-4 py-2.5 text-left text-neutral-700 hover:bg-stone-50">Say hi 👋</button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="px-7 mt-5 pb-6 flex items-center justify-between">
          <div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusPill.cls}`}>
              {statusPill.label}
            </span>
            <p className="text-xs text-stone-400 mt-1.5">
              {sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, {sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          <Link href="/exchanges" className="px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl">
            {isLive ? 'Join now →' : 'See exchange →'}
          </Link>
        </div>
      </div>
    );
  }

  // ── All other states: full card ────────────────────────────────────────────
  const pills = [partner.goal, partner.commStyle, partner.frequency, ...partner.sharedInterests].filter(Boolean).slice(0, 4);

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-stone-200">

      {/* Identity block */}
      <div className="px-7 pt-6 pb-0 flex items-start gap-4">
        <button onClick={onViewProfile} className="shrink-0">
          <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
        </button>
        <button onClick={onViewProfile} className="flex-1 min-w-0 text-left">
          <p className="font-serif font-bold text-[#171717] text-2xl leading-tight truncate">{partner.name}</p>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400">
            <span>{nativeFlag} {partner.nativeLang}</span>
            <ArrowLeftRight size={11} className="shrink-0" />
            <span>{learningFlag} {partner.learningLang}</span>
          </div>
        </button>
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context block — bio */}
      {partner.bio && (
        <div className="px-7 mt-4">
          <p className="text-sm text-neutral-700 leading-relaxed">{partner.bio}</p>
        </div>
      )}

      {/* Signals block — max 4, read as structured data */}
      {pills.length > 0 && (
        <div className="px-7 mt-4">
          <p className="text-xs text-stone-400 font-medium mb-2">In common</p>
          <div className="flex flex-wrap gap-1.5">
            {pills.map((v, i) => (
              <span key={i} className="px-3 py-1 bg-stone-100 text-sm font-medium text-stone-600 rounded-full">{v}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action block */}
      <div className="px-7 mt-6 pb-7 space-y-2">
        {/* Button — always blue, disabled when no action needed */}
        <button
          onClick={iNeedToSet || s === 'no_overlap' ? onBookExchange : undefined}
          disabled={waitingOnPartner || s === 'computing'}
          className="px-5 py-3 btn-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-default"
        >
          {s === 'no_overlap'                          ? 'Update your times →'  :
           waitingOnPartner                            ? 'Scheduling…'          :
           s === 'computing'                           ? 'Scheduling…'          :
           s === 'pending_both'                        ? 'Pick a time to meet →':
                                                        'Update your times →'}
        </button>

        {/* Inline notification — small status text below button */}
        {waitingOnPartner && (
          <p className="text-xs text-stone-400">
            Waiting on {partner.name} to pick their times.
          </p>
        )}
        {s === 'computing' && (
          <p className="text-xs text-stone-400">
            Finding a time that works for both of you…
          </p>
        )}
        {s === 'no_overlap' && (
          <p className="text-xs text-stone-400">
            No overlap found. Update your times and we'll try again.
          </p>
        )}
      </div>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const [partners,     setPartners]     = useState<PartnerCard[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [sessionId,    setSessionId]    = useState<string | null>(null);
  const [myName,       setMyName]       = useState<string | undefined>();
  const [myAvatarUrl,  setMyAvatarUrl]  = useState<string | null>(null);

  const buildCard = useCallback(async (m: Match, sid: string): Promise<PartnerCard> => {
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

    // Auto-fire confirm notification once per user per match
    if (card.schedulingState === 'scheduled' && !localStorage.getItem(`mutua_autoconfirmed_${m.id}`)) {
      localStorage.setItem(`mutua_autoconfirmed_${m.id}`, '1');
      const myNameStr = (() => { try { return JSON.parse(localStorage.getItem('mutua_profile') ?? '{}').name ?? ''; } catch { return ''; } })();
      const partnerEmail = isA ? (m.email_b ?? '') : (m.email_a ?? '');
      if (partnerEmail) {
        fetch('/api/confirm-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: m.id,
            partnerEmail,
            partnerSessionId,
            scheduledTime: card.scheduledAt ? new Date(card.scheduledAt).toLocaleString() : '',
            confirmerName: myNameStr,
          }),
        }).catch(() => {});
      }
    }
    if (card.schedulingState === 'scheduled' && card.scheduledAt) {
      localStorage.setItem('mutua_last_notification', JSON.stringify({
        type: 'session_scheduled',
        partnerName: card.name,
        scheduledAt: card.scheduledAt,
      }));
    }

    return card;
  }, []);

  const loadMatch = useCallback(async (sid: string) => {
    try {
      const matches = await getMatchesBySessionId(sid);
      if (matches.length === 0) return false;
      const cards = await Promise.all(matches.map(m => buildCard(m, sid)));
      setPartners(cards);
      track('match_card_viewed', { match_count: cards.length, partner_names: cards.map(c => c.name) });
      return true;
    } catch (err) {
      console.error('loadMatch error:', err);
      return false;
    }
  }, [buildCard]);

  // Fallback: build a card from localStorage if DB has no match yet
  const loadFromLocalStorage = useCallback(() => {
    const single = localStorage.getItem('mutua_match');
    if (!single) return false;
    const raw = JSON.parse(single);
    const p   = raw.partner;
    if (!p) return false;
    setPartners([{
      matchId:         '',
      id:              p.session_id         ?? 'demo',
      name:            p.name               ?? 'Your partner',
      nativeLang:      p.native_language,
      learningLang:    p.learning_language,
      goal:            p.goal               ?? '',
      commStyle:       p.comm_style         ?? '',
      frequency:       p.practice_frequency ?? '',
      reasons:         raw.reasons          ?? [],
      schedulingState: 'pending_both',
      scheduledAt:     null,
      iAmA:            true,
      avatarUrl:       null,
      sharedInterests: [],
    }]);
    return true;
  }, []);

  useEffect(() => {
    async function init() {
      const sid = localStorage.getItem('mutua_session_id');
      if (!sid) { router.replace('/onboarding'); return; }
      setSessionId(sid);

      // Load my own name + avatar
      const storedProfile = localStorage.getItem('mutua_profile');
      let myAvatarFromStorage: string | null = null;
      if (storedProfile) {
        try {
          const p = JSON.parse(storedProfile);
          if (p.name) setMyName(p.name);
          // avatar_url in localStorage includes the cache-busting ?t= timestamp set after upload
          if (p.avatar_url) myAvatarFromStorage = p.avatar_url;
        } catch { /* ignore */ }
      }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      setMyAvatarUrl(myAvatarFromStorage ?? `${supabaseUrl}/storage/v1/object/public/avatars/${sid}.jpg`);

      // Sync name + interests from localStorage → DB so partner can see them
      if (storedProfile) {
        try {
          const p = JSON.parse(storedProfile);
          const updates: Record<string, string> = {};
          if (p.name)      updates.name      = p.name;
          if (p.interests) updates.interests = p.interests;
          if (Object.keys(updates).length > 0) {
            supabase.from('profiles').update(updates).eq('session_id', sid).then(() => {});
          }
        } catch { /* ignore */ }
      }

      const isReturning = !!localStorage.getItem('mutua_profile');
      if (isReturning) track('returning_user_opened');

      const found = await loadMatch(sid);
      if (!found) loadFromLocalStorage();

      localStorage.removeItem('mutua_just_saved_availability');
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

  // Poll when any card is 'computing' — re-fetch every 4s until resolved
  const anyComputing = partners.some(p => p.schedulingState === 'computing');
  useEffect(() => {
    if (!anyComputing || !sessionId) return;
    const interval = setInterval(async () => {
      await loadMatch(sessionId);
      setPartners(prev => {
        const justScheduled = prev.some(p => p.schedulingState === 'scheduled');
        if (justScheduled) localStorage.setItem('mutua_unread_notification', 'session_scheduled');
        return prev;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [anyComputing, sessionId, loadMatch]);

  const handleBookExchange = (partner: PartnerCard) => {
    track('schedule_clicked', { partner_name: partner.name, match_id: partner.matchId });
    localStorage.setItem('mutua_scheduling_partner', partner.name);
    const params = new URLSearchParams();
    if (partner.matchId)         params.set('matchId', partner.matchId);
    if (partner.schedulingState) params.set('schedulingState', partner.schedulingState);
    router.push(`/set-availability?${params.toString()}`);
  };

  const handleReschedule = (partner: PartnerCard) => {
    track('reschedule_clicked', { partner_name: partner.name, match_id: partner.matchId });
    localStorage.setItem('mutua_scheduling_partner', partner.name);
    const params = new URLSearchParams();
    if (partner.matchId)         params.set('matchId', partner.matchId);
    if (partner.schedulingState) params.set('schedulingState', partner.schedulingState);
    router.push(`/set-availability?${params.toString()}`);
  };

  const handleJoin = (partner: PartnerCard) => {
    track('session_join_clicked', { partner_name: partner.name, match_id: partner.matchId });
    const savedPartner: SavedPartner = {
      partner_id:          partner.id,
      name:                partner.name,
      native_language:     partner.nativeLang as SavedPartner['native_language'],
      learning_language:   partner.learningLang as SavedPartner['learning_language'],
      goal:                partner.goal as SavedPartner['goal'],
      comm_style:          partner.commStyle as SavedPartner['comm_style'],
      practice_frequency:  partner.frequency as SavedPartner['practice_frequency'],
      saved_at:            new Date().toISOString(),
      match_id:            partner.matchId,
      avatar_url:          partner.avatarUrl,
    };
    localStorage.setItem('mutua_current_partner', JSON.stringify(savedPartner));
    router.push('/pre-session');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">

        {/* Context header */}
        <div>
          <h1 className="font-serif font-semibold text-2xl text-[#171717]">Your partners</h1>
          {!loading && partners.length === 0 && (
            <p className="text-sm text-stone-400 mt-1">No partners yet — we'll reach out when we find your match.</p>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading...</p>
        ) : partners.length > 0 ? (
          <div className="space-y-6">
            {partners.map(partner => (
              <SchedulingCard
                key={partner.matchId || partner.id}
                partner={partner}
                onReschedule={() => handleReschedule(partner)}
                onJoin={() => handleJoin(partner)}
                onBookExchange={() => handleBookExchange(partner)}
                onViewProfile={() => router.push(`/partner/${partner.matchId}`)}
                myName={myName}
                myAvatarUrl={myAvatarUrl}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl px-6 py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-neutral-700">Looking for your match</p>
            <p className="text-sm text-stone-400 leading-relaxed">
              We're searching for a compatible language partner.<br />
              We'll email you as soon as we find one.
            </p>
          </div>
        )}


      </main>


    </AppShell>
  );
}
