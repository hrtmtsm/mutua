'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getMatchBySessionId, type Match } from '@/lib/supabase';
import { LANG_FLAGS } from '@/lib/constants';
import TopNav from '@/components/Sidebar';

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
  slots:        string[];
  status:       string;
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
  const cls = size === 'sm'
    ? 'w-10 h-10 text-sm'
    : 'w-12 h-12 text-base';
  return (
    <div
      style={{ backgroundColor: bg }}
      className={`${cls} rounded-xl flex items-center justify-center font-black text-white shrink-0`}
    >
      {name.trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

function generateSlots(): string[] {
  const times = ['7:00 PM', '10:00 AM', '8:00 PM', '3:00 PM', '7:00 PM'];
  return times.map((t, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + t;
  });
}

function partnerFromMatch(m: Match, sessionId: string): PartnerCard {
  const isA = m.session_id_a === sessionId;
  return {
    id:           isA ? (m.session_id_b) : (m.session_id_a),
    name:         isA ? (m.name_b  ?? 'Your partner') : (m.name_a  ?? 'Your partner'),
    nativeLang:   isA ? m.native_language_b            :  m.native_language_a,
    learningLang: isA ? m.native_language_a            :  m.native_language_b,
    goal:         m.goal      ?? '',
    commStyle:    m.comm_style ?? '',
    frequency:    m.practice_frequency ?? '',
    reasons:      m.reasons   ?? [],
    slots:        generateSlots(),
    status:       m.status    ?? 'pending',
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PartnerRow({
  partner,
  onConfirm,
}: {
  partner: PartnerCard;
  onConfirm: (time: string) => void;
}) {
  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';
  const isConfirmed  = partner.status === 'confirmed';

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">

      <div className="px-6 pt-5 pb-4 flex items-center gap-4">
        <Avatar name={partner.name} lang={partner.nativeLang} />
        <div className="flex-1">
          <p className="font-bold text-neutral-900 text-lg leading-tight">{partner.name}</p>
        </div>
        {isConfirmed && (
          <span className="text-xs font-bold uppercase tracking-widest text-[#2B8FFF] bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full">
            Confirmed
          </span>
        )}
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

      <div className="px-6 pb-5 pt-4 border-t border-stone-100">
        {isConfirmed ? (
          <button
            onClick={() => onConfirm(partner.slots[0] ?? '')}
            className="px-5 py-2.5 btn-primary text-white text-sm font-bold rounded-xl shadow-sm"
          >
            Go to session →
          </button>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Pick a time to meet</p>
            <div className="flex flex-wrap gap-2">
              {partner.slots.map(slot => (
                <button
                  key={slot}
                  onClick={() => onConfirm(slot)}
                  className="px-3.5 py-2 border border-stone-200 rounded-xl text-sm font-semibold text-neutral-900 hover:border-[#2B8FFF] hover:bg-sky-50 hover:text-[#2B8FFF] transition-all"
                >
                  {slot}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MatchResultPage() {
  const router = useRouter();
  const [partners,      setPartners]      = useState<PartnerCard[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [noMatch,       setNoMatch]       = useState(false);
  const [matchId,       setMatchId]       = useState<string | null>(null);
  const [partnerEmail,  setPartnerEmail]  = useState<string | null>(null);
  const [myName,        setMyName]        = useState<string>('');

  useEffect(() => {
    async function load() {
      const sessionId = localStorage.getItem('mutua_session_id');
      if (!sessionId) { router.replace('/onboarding'); return; }

      const stored = localStorage.getItem('mutua_profile');
      if (stored) {
        const profile = JSON.parse(stored);
        setMyName(profile.name ?? profile.email?.split('@')[0] ?? '');
      }

      // Try Supabase
      try {
        const m = await getMatchBySessionId(sessionId);
        if (m) {
          const isA = m.session_id_a === sessionId;
          const partnerSessionId = isA ? m.session_id_b : m.session_id_a;
          setMatchId(m.id);
          setPartnerEmail(isA ? (m.email_b ?? null) : (m.email_a ?? null));

          // Fetch partner's current name from profiles (matches table name may be stale)
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('session_id', partnerSessionId)
            .maybeSingle();

          const card = partnerFromMatch(m, sessionId);
          if (partnerProfile?.name) card.name = partnerProfile.name;

          setPartners([card]);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('getMatchBySessionId error:', err);
      }

      // Fallback: mutua_partners (array, for demo with multiple partners)
      const multi = localStorage.getItem('mutua_partners');
      if (multi) {
        const arr = JSON.parse(multi) as Array<{
          partner: { session_id?: string; name?: string; native_language: string; learning_language: string; goal?: string; comm_style?: string; practice_frequency?: string };
          reasons?: string[];
        }>;
        setPartners(arr.filter(item => item?.partner).map((item, i) => ({
          id:           item.partner.session_id       ?? `demo-${i}`,
          name:         item.partner.name             ?? 'Partner',
          nativeLang:   item.partner.native_language,
          learningLang: item.partner.learning_language,
          goal:         item.partner.goal             ?? '',
          commStyle:    item.partner.comm_style       ?? '',
          frequency:    item.partner.practice_frequency ?? '',
          reasons:      item.reasons                  ?? [],
          slots:        generateSlots(),
          status:       'pending',
        })));
        setLoading(false);
        return;
      }

      // Fallback: mutua_match (single partner, legacy)
      const single = localStorage.getItem('mutua_match');
      if (single) {
        const parsed = JSON.parse(single);
        const p = parsed.partner;
        setPartners([{
          id:           p.session_id ?? 'demo',
          name:         p.name              ?? p.email?.split('@')[0] ?? 'Partner',
          nativeLang:   p.native_language,
          learningLang: p.learning_language,
          goal:         p.goal              ?? '',
          commStyle:    p.comm_style        ?? '',
          frequency:    p.practice_frequency ?? '',
          reasons:      parsed.reasons      ?? [],
          slots:        generateSlots(),
          status:       'pending',
        }]);
        setLoading(false);
        return;
      }

      setNoMatch(true);
      setLoading(false);
    }
    load();
  }, [router]);

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

  const handleConfirm = async (p: PartnerCard, time: string) => {
    savePartner(p);
    localStorage.setItem('mutua_scheduled_time', time);

    if (matchId && partnerEmail) {
      fetch('/api/confirm-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, partnerEmail, partnerName: p.name, scheduledTime: time, confirmerName: myName }),
      }).catch(() => {});
    }

    router.push('/session-confirmed');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-stone-400 text-sm">Loading your partners...</p>
    </div>
  );

  if (noMatch) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="font-serif font-black text-xl text-neutral-900">No partners yet</p>
        <p className="text-sm text-stone-500 max-w-xs">We'll email you as soon as we find someone compatible.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white">

      <TopNav />

      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="max-w-2xl w-full space-y-4">
          <div className="mb-2">
            <p className="font-serif font-black text-2xl text-neutral-900">Session</p>
            <h2 className="text-lg font-semibold text-neutral-700 mt-1">Compatible partners for you</h2>
          </div>
          {partners.map(p => (
            <PartnerRow
              key={p.id}
              partner={p}
              onConfirm={(time) => handleConfirm(p, time)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
