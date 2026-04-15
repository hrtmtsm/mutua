'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchesBySessionId, type Match, type SchedulingState } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import type { SavedPartner } from '@/lib/types';
import { track } from '@/lib/analytics';
import AppShell from '@/components/AppShell';

interface ExchangeCard {
  matchId:         string;
  id:              string;
  name:            string;
  nativeLang:      string;
  learningLang:    string;
  goal:            string;
  commStyle:       string;
  frequency:       string;
  scheduledAt:     string;
  iAmA:            boolean;
  avatarUrl:       string | null;
}

function Avatar({ name, lang, avatarUrl }: { name: string; lang: string; avatarUrl?: string | null }) {
  const bg = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (() => { const p = name.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.trim().slice(0, 2)).toUpperCase(); })();
  return (
    <div style={{ backgroundColor: bg }} className="w-20 h-20 rounded-full flex items-center justify-center font-black text-white text-2xl shrink-0 overflow-hidden relative">
      <span className="select-none">{initials}</span>
      {avatarUrl && !imgFailed && (
        <img src={avatarUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgFailed(true)} />
      )}
    </div>
  );
}

function isJoinable(scheduledAt: string, now: number): boolean {
  const t = new Date(scheduledAt).getTime();
  return (t - now) <= 30 * 60 * 1000 && (now - t) <= 60 * 60 * 1000;
}

function TicketCard({
  exchange,
  onJoin,
  onReschedule,
}: {
  exchange: ExchangeCard;
  onJoin: () => void;
  onReschedule: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const sessionDate   = new Date(exchange.scheduledAt);
  const sessionPassed = now - sessionDate.getTime() > 60 * 60 * 1000;
  const isLive        = isJoinable(exchange.scheduledAt, now);
  const msUntil       = sessionDate.getTime() - now;
  const isSoon        = !isLive && msUntil > 0 && msUntil <= 60 * 60 * 1000;

  const dateLine = sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeLine = sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const nativeFlag   = LANG_FLAGS[exchange.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[exchange.learningLang] ?? '';

  const statusPill = sessionPassed
    ? { label: 'Missed :(', cls: 'bg-stone-100 text-stone-500' }
    : isLive
    ? { label: '● Live now', cls: 'bg-emerald-50 text-emerald-600' }
    : isSoon
    ? { label: '● Starting soon', cls: 'bg-amber-50 text-amber-600' }
    : { label: 'Upcoming', cls: 'bg-blue-50 text-blue-600' };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Ticket header band */}
      <div className="px-6 pt-5 pb-4 border-b border-dashed border-stone-200">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${statusPill.cls}`}>
          {statusPill.label}
        </span>
        <div className="flex items-center gap-4">
          <Avatar name={exchange.name} lang={exchange.nativeLang} avatarUrl={exchange.avatarUrl} />
          <div>
            <p className="font-serif font-bold text-[#171717] text-2xl leading-tight">{exchange.name}</p>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400">
              <span>{nativeFlag} {exchange.nativeLang}</span>
              <span className="text-stone-300">↔</span>
              <span>{learningFlag} {exchange.learningLang}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket body — date/time hero */}
      <div className="px-6 py-5">
        <p className="text-xs text-stone-400 font-medium mb-1">
          {sessionPassed ? 'Session passed' : 'Session time'}
        </p>
        <p className="font-serif font-bold text-[#171717] text-2xl leading-snug">{dateLine}</p>
        <p className="text-lg font-semibold text-stone-500 mt-0.5">{timeLine}</p>

        <div className="flex gap-2 mt-5">
          {sessionPassed ? (
            <>
              <button
                onClick={() => window.dispatchEvent(new Event('mutua:open-chat'))}
                className="px-4 py-3 border border-stone-200 bg-white text-sm text-neutral-500 font-medium rounded-xl hover:bg-stone-50 transition-colors"
              >
                Say hi 👋
              </button>
              <button
                onClick={onReschedule}
                className="flex-1 py-3 btn-primary text-white text-sm font-semibold rounded-xl"
              >
                Reschedule →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => window.dispatchEvent(new Event('mutua:open-chat'))}
                className="px-4 py-3 border border-stone-200 bg-white text-sm text-neutral-500 font-medium rounded-xl hover:bg-stone-50 transition-colors"
              >
                Say hi 👋
              </button>
              <button
                onClick={onJoin}
                className="flex-1 py-3 btn-primary text-white text-sm font-semibold rounded-xl"
              >
                {isLive ? 'Join now →' : 'Start exchange →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExchangesPage() {
  const router = useRouter();
  const [exchanges, setExchanges] = useState<ExchangeCard[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const loadExchanges = useCallback(async (sid: string) => {
    const matches = await getMatchesBySessionId(sid);
    const now = Date.now();
    const scheduled = matches.filter(m =>
      m.scheduling_state === 'scheduled' &&
      m.scheduled_at &&
      now - new Date(m.scheduled_at).getTime() <= 60 * 60 * 1000 // not more than 1h past
    );

    const cards: ExchangeCard[] = await Promise.all(
      scheduled.map(async (m: Match) => {
        const isA = m.session_id_a === sid;
        const partnerSid = isA ? m.session_id_b : m.session_id_a;
        const { data: profile } = await supabase
          .from('profiles').select('name, avatar_url').eq('session_id', partnerSid).maybeSingle();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        return {
          matchId:      m.id,
          id:           partnerSid,
          name:         profile?.name ?? (isA ? (m.name_b ?? 'Partner') : (m.name_a ?? 'Partner')),
          nativeLang:   isA ? m.native_language_b : m.native_language_a,
          learningLang: isA ? m.native_language_a : m.native_language_b,
          goal:         m.goal ?? '',
          commStyle:    m.comm_style ?? '',
          frequency:    m.practice_frequency ?? '',
          scheduledAt:  m.scheduled_at!,
          iAmA:         isA,
          avatarUrl:    profile?.avatar_url ?? `${supabaseUrl}/storage/v1/object/public/avatars/${partnerSid}.jpg`,
        };
      })
    );

    // Sort ascending by session time
    cards.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    setExchanges(cards);
  }, []);

  useEffect(() => {
    const sid = localStorage.getItem('mutua_session_id');
    if (!sid) { router.replace('/onboarding'); return; }
    setSessionId(sid);
    loadExchanges(sid).finally(() => setLoading(false));
  }, [router, loadExchanges]);

  useEffect(() => {
    if (!sessionId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadExchanges(sessionId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sessionId, loadExchanges]);

  const handleJoin = (ex: ExchangeCard) => {
    track('session_join_clicked', { partner_name: ex.name, match_id: ex.matchId });
    const savedPartner: SavedPartner = {
      partner_id:         ex.id,
      name:               ex.name,
      native_language:    ex.nativeLang as SavedPartner['native_language'],
      learning_language:  ex.learningLang as SavedPartner['learning_language'],
      goal:               ex.goal as SavedPartner['goal'],
      comm_style:         ex.commStyle as SavedPartner['comm_style'],
      practice_frequency: ex.frequency as SavedPartner['practice_frequency'],
      saved_at:           new Date().toISOString(),
      match_id:           ex.matchId,
      avatar_url:         ex.avatarUrl,
    };
    localStorage.setItem('mutua_current_partner', JSON.stringify(savedPartner));
    router.push('/pre-session');
  };

  const handleReschedule = (ex: ExchangeCard) => {
    track('reschedule_clicked', { partner_name: ex.name, match_id: ex.matchId });
    localStorage.setItem('mutua_scheduling_partner', ex.name);
    const params = new URLSearchParams({ matchId: ex.matchId, schedulingState: 'scheduled' });
    router.push(`/set-availability?${params.toString()}`);
  };

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Exchanges</h1>

        {loading ? (
          <p className="text-sm text-stone-400">Loading...</p>
        ) : exchanges.length > 0 ? (
          <div className="space-y-4">
            {exchanges.map(ex => (
              <TicketCard
                key={ex.matchId}
                exchange={ex}
                onJoin={() => handleJoin(ex)}
                onReschedule={() => handleReschedule(ex)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl px-6 py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-neutral-700">No upcoming exchanges</p>
            <p className="text-sm text-stone-400 leading-relaxed">
              Schedule a session with a partner to see it here.
            </p>
          </div>
        )}

      </main>
    </AppShell>
  );
}
