'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchBySessionId, type Match } from '@/lib/supabase';
import { LANG_FLAGS } from '@/lib/constants';
import AppShell from '@/components/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartnerCard {
  id:           string;
  name:         string;
  nativeLang:   string;
  learningLang: string;
  goal:         string;
  commStyle:    string;
  frequency:    string;
  reasons:      string[];
  suggestedTime: string;
}

interface UpcomingSession {
  partnerId:     string;
  partnerName:   string;
  nativeLang:    string;
  learningLang:  string;
  reasons:       string[];
  scheduledTime: string;
  status:        'confirmed' | 'scheduling';
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
  const bg = LANG_COLORS[lang] ?? '#3b82f6';
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

function getSuggestedTime(frequency?: string): string {
  const now = new Date();
  let daysAhead = 3;
  if      (frequency === 'Every day')         daysAhead = 1;
  else if (frequency === '2–3 times a week')  daysAhead = 2;
  else if (frequency === 'Once a week')       daysAhead = 5;
  const date = new Date(now);
  date.setDate(now.getDate() + daysAhead);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · 7:00 PM';
}

function generateAlternateSlots(suggestedTime: string): string[] {
  const now = new Date();
  return [
    { days: 1, time: '7:00 PM' },
    { days: 2, time: '8:00 PM' },
    { days: 3, time: '6:30 PM' },
    { days: 4, time: '9:00 AM' },
    { days: 5, time: '10:00 AM' },
    { days: 6, time: '7:00 PM' },
  ]
    .map(({ days, time }) => {
      const d = new Date(now);
      d.setDate(now.getDate() + days);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + time;
    })
    .filter(s => s !== suggestedTime)
    .slice(0, 4);
}

function partnerFromMatch(m: Match, sessionId: string): PartnerCard {
  const isA = m.session_id_a === sessionId;
  const frequency = m.practice_frequency ?? '';
  const suggestedTime = m.suggested_time
    ? new Date(m.suggested_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · 7:00 PM'
    : getSuggestedTime(frequency);
  return {
    id:           isA ? m.session_id_b : m.session_id_a,
    name:         isA ? (m.name_b ?? 'Your partner') : (m.name_a ?? 'Your partner'),
    nativeLang:   isA ? m.native_language_b : m.native_language_a,
    learningLang: isA ? m.native_language_a : m.native_language_b,
    goal:         m.goal       ?? '',
    commStyle:    m.comm_style ?? '',
    frequency,
    reasons:      m.reasons    ?? [],
    suggestedTime,
  };
}

// ── Upcoming card ─────────────────────────────────────────────────────────────

function UpcomingCard({
  session,
  onJoin,
  onReschedule,
}: {
  session: UpcomingSession;
  onJoin: () => void;
  onReschedule: () => void;
}) {
  const nativeFlag   = LANG_FLAGS[session.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[session.learningLang] ?? '';

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">

      <div className="px-6 pt-5 pb-4 flex items-center gap-4">
        <Avatar name={session.partnerName} lang={session.nativeLang} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-neutral-900 text-lg leading-tight">{session.partnerName}</p>
        </div>
        {session.status === 'confirmed' ? (
          <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-xs font-semibold text-green-700 rounded-full shrink-0">
            Confirmed
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-600 rounded-full shrink-0">
            Scheduling
          </span>
        )}
      </div>

      <div className="px-6 pb-4 grid grid-cols-2 gap-3">
        <div className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Native</p>
          <p className="font-bold text-neutral-900 text-base">{nativeFlag} {session.nativeLang}</p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Practicing</p>
          <p className="font-bold text-neutral-900 text-base">{learningFlag} {session.learningLang}</p>
        </div>
      </div>

      {session.reasons.length > 0 && (
        <div className="px-6 pb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">In common</p>
          <div className="flex flex-wrap gap-1.5">
            {session.reasons.slice(0, 3).map((r, i) => (
              <span key={i} className="px-2.5 py-1 bg-stone-100 border border-stone-200 text-xs font-medium text-stone-600 rounded-full">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 pb-5 pt-4 border-t border-stone-100">
        {session.status === 'confirmed' ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-stone-400">Scheduled</p>
              <p className="font-semibold text-neutral-900 text-sm mt-0.5">{session.scheduledTime}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={onReschedule} className="text-sm text-stone-400 hover:text-neutral-900 font-medium transition-colors">
                Reschedule
              </button>
              <button onClick={onJoin} className="px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-sm">
                Join session →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-stone-400 mb-1">Options sent — waiting for {session.partnerName} to pick</p>
              <div className="flex flex-wrap gap-1.5">
                {session.scheduledTime.split(' / ').map(slot => (
                  <span key={slot} className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-xs text-amber-700 rounded-full">
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Partner row ───────────────────────────────────────────────────────────────

function PartnerRow({
  partner,
  onConfirm,
  onSeeOtherTimes,
}: {
  partner: PartnerCard;
  onConfirm: () => void;
  onSeeOtherTimes: () => void;
}) {
  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:border-stone-300 transition-all">

      <div className="px-6 pt-5 pb-4 flex items-center gap-4">
        <Avatar name={partner.name} lang={partner.nativeLang} />
        <div>
          <p className="font-bold text-neutral-900 text-lg leading-tight">{partner.name}</p>
        </div>
      </div>

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

      {partner.reasons.length > 0 && (
        <div className="px-6 pb-5">
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

      <div className="px-6 pb-5 pt-4 border-t border-stone-100 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-stone-400">Suggested first session</p>
          <p className="font-semibold text-neutral-900 text-sm mt-0.5">{partner.suggestedTime}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onSeeOtherTimes}
            className="text-sm text-stone-400 hover:text-neutral-900 font-medium transition-colors"
          >
            Other times
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-sm"
          >
            Confirm session →
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const router = useRouter();
  const [upcoming,  setUpcoming]  = useState<UpcomingSession | null>(null);
  const [partners,  setPartners]  = useState<PartnerCard[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [confirming, setConfirming] = useState<{ name: string; time: string } | null>(null);
  const [confirmed,  setConfirmed]  = useState(false);

  useEffect(() => {
    // Load compatible partners (also refreshes upcoming partner name)
    async function loadPartners() {
      const sessionId = localStorage.getItem('mutua_session_id');
      if (sessionId) {
        try {
          const m = await getMatchBySessionId(sessionId);
          if (m) {
            const isA = m.session_id_a === sessionId;
            const partnerSessionId = isA ? m.session_id_b : m.session_id_a;

            // Fetch fresh partner name from profiles
            const { data: partnerProfile } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('session_id', partnerSessionId)
              .maybeSingle();

            const card = partnerFromMatch(m, sessionId);
            if (partnerProfile?.name) card.name = partnerProfile.name;

            // Persist match context for session-schedule page
            const partnerEmail = isA ? (m.email_b ?? '') : (m.email_a ?? '');
            localStorage.setItem('mutua_match_id', m.id);
            localStorage.setItem('mutua_partner_email', partnerEmail);

            setPartners([card]);

            // Also update upcoming session if it's for this partner
            const partnerRaw = localStorage.getItem('mutua_current_partner');
            const time       = localStorage.getItem('mutua_scheduled_time');
            if (partnerRaw && time) {
              const p = JSON.parse(partnerRaw);
              const freshName = partnerProfile?.name ?? p.name ?? 'Your partner';
              setUpcoming({
                partnerId:    p.partner_id        ?? '',
                partnerName:  freshName,
                nativeLang:   p.native_language   ?? '',
                learningLang: p.learning_language ?? '',
                reasons:      p.reasons           ?? [],
                scheduledTime: time,
                status:       m.status === 'confirmed' ? 'confirmed' : 'scheduling',
              });
            }

            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('getMatchBySessionId error:', err);
        }
      }

      // Fallback: load upcoming from localStorage only
      const partnerRaw = localStorage.getItem('mutua_current_partner');
      const time       = localStorage.getItem('mutua_scheduled_time');
      if (partnerRaw && time) {
        const p = JSON.parse(partnerRaw);
        setUpcoming({
          partnerId:    p.partner_id        ?? '',
          partnerName:  p.name              ?? 'Your partner',
          nativeLang:   p.native_language   ?? '',
          learningLang: p.learning_language ?? '',
          reasons:      p.reasons           ?? [],
          scheduledTime: time,
          status:       'scheduling',
        });
      }

      const multi = localStorage.getItem('mutua_partners');
      if (multi) {
        const arr = JSON.parse(multi) as Array<{
          partner: { session_id?: string; name?: string; native_language: string; learning_language: string; goal?: string; comm_style?: string; practice_frequency?: string };
          reasons?: string[];
        }>;
        setPartners(arr.filter(item => item?.partner).map((item, i) => ({
          id:           item.partner.session_id        ?? `demo-${i}`,
          name:         item.partner.name              ?? 'Demo partner',
          nativeLang:   item.partner.native_language,
          learningLang: item.partner.learning_language,
          goal:         item.partner.goal              ?? '',
          commStyle:    item.partner.comm_style        ?? '',
          frequency:    item.partner.practice_frequency ?? '',
          reasons:      item.reasons                   ?? [],
          suggestedTime: getSuggestedTime(item.partner.practice_frequency),
        })));
        setLoading(false);
        return;
      }

      const single = localStorage.getItem('mutua_match');
      if (single) {
        const parsed = JSON.parse(single);
        const p = parsed.partner;
        setPartners([{
          id:           p.session_id      ?? 'demo',
          name:         p.name            ?? 'Demo partner',
          nativeLang:   p.native_language,
          learningLang: p.learning_language,
          goal:         p.goal            ?? '',
          commStyle:    p.comm_style      ?? '',
          frequency:    p.practice_frequency ?? '',
          reasons:      parsed.reasons    ?? [],
          suggestedTime: getSuggestedTime(p.practice_frequency),
        }]);
        setLoading(false);
        return;
      }

      setLoading(false);
    }
    loadPartners();
  }, []);

  const savePartner = (p: PartnerCard) => {
    localStorage.setItem('mutua_current_partner', JSON.stringify({
      partner_id:         p.id,
      name:               p.name,
      native_language:    p.nativeLang,
      learning_language:  p.learningLang,
      goal:               p.goal,
      comm_style:         p.commStyle,
      practice_frequency: p.frequency,
      saved_at:           new Date().toISOString(),
    }));
  };

  const handleConfirm = (p: PartnerCard) => {
    savePartner(p);
    localStorage.setItem('mutua_scheduled_time', p.suggestedTime);
    setConfirming({ name: p.name, time: p.suggestedTime });
  };

  const handleBook = () => {
    setConfirmed(true);
    const partnerRaw = localStorage.getItem('mutua_current_partner');
    const time       = localStorage.getItem('mutua_scheduled_time');
    if (partnerRaw && time) {
      const p = JSON.parse(partnerRaw);
      setUpcoming({
        partnerId:    p.partner_id        ?? '',
        partnerName:  p.name              ?? 'Your partner',
        nativeLang:   p.native_language   ?? '',
        learningLang: p.learning_language ?? '',
        reasons:      p.reasons           ?? [],
        scheduledTime: time,
        status:       time.includes(' / ') ? 'scheduling' : 'confirmed',
      });
    }
  };

  const handleConfirmDone = () => {
    setConfirming(null);
    setConfirmed(false);
  };

  const handleSeeOtherTimes = (p: PartnerCard) => {
    savePartner(p);
    localStorage.setItem('mutua_session_slots', JSON.stringify(generateAlternateSlots(p.suggestedTime)));
    router.push('/session-schedule');
  };

  const handleJoin = () => {
    router.push('/pre-session');
  };

  const handleReschedule = () => {
    const slots = upcoming
      ? generateAlternateSlots(upcoming.scheduledTime)
      : [];
    localStorage.setItem('mutua_session_slots', JSON.stringify(slots));
    router.push('/session-schedule');
  };

  return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-10">

        {/* ── Page title ── */}
        <div>
          <h1 className="font-serif font-black text-2xl text-neutral-900">Session</h1>
        </div>

        {/* ── Upcoming ── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Upcoming</h2>
          {upcoming ? (
            <UpcomingCard
              session={upcoming}
              onJoin={handleJoin}
              onReschedule={handleReschedule}
            />
          ) : (
            <div className="bg-stone-50 border border-stone-200 border-dashed rounded-2xl px-6 py-8 text-center">
              <p className="text-sm text-stone-400">No sessions scheduled yet.</p>
            </div>
          )}
        </section>

        {/* ── Compatible partners ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Compatible partners for you</h2>
          </div>

          {loading ? (
            <p className="text-sm text-stone-400">Loading partners...</p>
          ) : partners.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 border-dashed rounded-2xl px-6 py-8 text-center">
              <p className="text-sm text-stone-400">We'll show compatible partners here once we find a match.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {partners.map(p => (
                <PartnerRow
                  key={p.id}
                  partner={p}
                  onConfirm={() => handleConfirm(p)}
                  onSeeOtherTimes={() => handleSeeOtherTimes(p)}
                />
              ))}
            </div>
          )}
        </section>

      </main>

      {/* ── Confirmation modal ── */}
      {confirming && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-5 shadow-xl">

            {!confirmed ? (
              /* ── Step 1: double-check ── */
              <>
                <div className="space-y-1">
                  <p className="font-bold text-neutral-900 text-lg">Book a session with {confirming.name}?</p>
                  <p className="text-sm text-stone-500">
                    Suggested time: <span className="font-semibold text-neutral-700">{confirming.time}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleBook}
                    className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl"
                  >
                    Book a session
                  </button>
                  <button
                    onClick={handleConfirmDone}
                    className="w-full py-2.5 text-stone-400 hover:text-neutral-700 text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              /* ── Step 2: confirmed ── */
              <>
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#2B8FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-neutral-900 text-lg">Session booked</p>
                  <p className="text-sm text-stone-500">
                    Your first session with <span className="font-semibold text-neutral-900">{confirming.name}</span> is set for
                  </p>
                  <p className="font-bold text-[#2B8FFF] text-base">{confirming.time}</p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleConfirmDone}
                    className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl"
                  >
                    Got it
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </AppShell>
  );
}
