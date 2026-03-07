'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MatchResult } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import { addPartner, getPartners, profileToSavedPartner, PARTNER_LIMIT } from '@/lib/partners';

function Avatar({ name, language }: { name: string; language: string }) {
  const color = LANG_AVATAR_COLOR[language] ?? '#737373';
  return (
    <div
      style={{ backgroundColor: color }}
      className="w-14 h-14 rounded-xl border-2 border-neutral-900 shadow-[2px_2px_0_0_#111] flex items-center justify-center font-black text-white text-base shrink-0"
    >
      {name.trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function MatchResultPage() {
  const router = useRouter();
  const [match,   setMatch]   = useState<MatchResult | null>(null);
  const [atLimit, setAtLimit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('mutua_match');
    if (!stored) { router.replace('/onboarding'); return; }
    setMatch(JSON.parse(stored));
    setAtLimit(getPartners().length >= PARTNER_LIMIT);
  }, [router]);

  if (!match) return null;

  const { partner, score, reasons } = match;
  const name  = partner.name ?? 'Your partner';
  const flag  = LANG_FLAGS[partner.native_language] ?? '';
  const label = score >= 90 ? 'Excellent match' : score >= 75 ? 'Great match' : 'Good match';

  const handleAction = (mode: 'session' | 'chat') => {
    const saved = profileToSavedPartner(partner);
    addPartner(saved);
    localStorage.setItem('mutua_current_partner', JSON.stringify(saved));
    router.push(mode === 'session' ? '/pre-session' : '/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="px-6 py-4 border-b-2 border-neutral-900 bg-[#f5ede0]">
        <span className="font-serif font-black text-xl tracking-tight">Mutua</span>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[6px_6px_0_0_#111] max-w-md w-full overflow-hidden">

          {/* Header: partner identity */}
          <div className="px-6 pt-6 pb-5 border-b-2 border-dashed border-stone-200">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-4">
              ★ Great match found
            </p>
            <div className="flex items-center gap-4">
              <Avatar name={name} language={partner.native_language} />
              <div className="flex-1 min-w-0">
                <p className="font-serif font-black text-2xl text-neutral-900 leading-tight">{name}</p>
                <p className="text-sm text-stone-600 mt-1">
                  {flag} Native {partner.native_language} · Learning {partner.learning_language}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-3xl text-neutral-900 tabular-nums leading-none">{score}%</p>
                <p className="text-xs font-semibold text-amber-600 mt-0.5">{label}</p>
              </div>
            </div>
          </div>

          {/* Why you matched */}
          <div className="px-6 py-5 border-b-2 border-dashed border-stone-200">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-3">
              Why you matched
            </p>
            <ul className="space-y-2.5">
              {reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-stone-700 leading-relaxed">
                  <span className="text-amber-500 font-black mt-0.5 shrink-0">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="px-6 py-5 space-y-3">
            {atLimit ? (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-4">
                <p className="font-semibold text-neutral-900 text-sm">
                  You already have {PARTNER_LIMIT} active partners.
                </p>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Finish a session or remove a partner to save this match.
                </p>
                <button
                  onClick={() => router.push('/partners')}
                  className="mt-3 text-sm font-bold text-neutral-900 underline underline-offset-2"
                >
                  View active partners →
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleAction('session')}
                  className="w-full py-4 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold rounded-lg shadow-[3px_3px_0_0_#111] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all text-base"
                >
                  Start 3-minute session →
                </button>
                <button
                  onClick={() => handleAction('chat')}
                  className="w-full py-3 bg-white text-neutral-900 border-2 border-neutral-900 font-semibold rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm"
                >
                  Chat instead
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
