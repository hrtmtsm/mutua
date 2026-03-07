'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedPartner } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import { getSessionStarters } from '@/lib/prompts';

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

export default function PreSessionPage() {
  const router   = useRouter();
  const [partner,  setPartner]  = useState<SavedPartner | null>(null);
  const [starters, setStarters] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('mutua_current_partner');
    if (!stored) { router.replace('/partners'); return; }
    const p: SavedPartner = JSON.parse(stored);
    setPartner(p);
    setStarters(getSessionStarters(p.native_language));
  }, [router]);

  if (!partner) return null;

  const flag = LANG_FLAGS[partner.native_language] ?? '';

  const handleStart = () => {
    // Build the MatchResult shape that session/page.tsx expects
    const sessionMatch = {
      partner: {
        session_id:        partner.partner_id,
        name:              partner.name,
        native_language:   partner.native_language,
        learning_language: partner.learning_language,
        goal:              partner.goal,
        comm_style:        partner.comm_style,
        availability:      partner.availability,
      },
      score:    0,
      reasons:  [],
      starters,
    };
    localStorage.setItem('mutua_match', JSON.stringify(sessionMatch));
    router.push('/session');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 py-4 border-b-2 border-neutral-900 bg-[#f5ede0] flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm font-semibold text-stone-500 hover:text-neutral-900 transition-colors"
        >
          ← Back
        </button>
        <span className="font-serif font-black text-xl tracking-tight">Mutua</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[6px_6px_0_0_#111] max-w-md w-full overflow-hidden">

          {/* Partner header */}
          <div className="px-6 pt-6 pb-5 border-b-2 border-dashed border-stone-200">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-4">
              Getting ready to practice
            </p>
            <div className="flex items-center gap-4">
              <Avatar name={partner.name} language={partner.native_language} />
              <div>
                <p className="font-serif font-black text-xl text-neutral-900">{partner.name}</p>
                <p className="text-sm text-stone-600 mt-0.5">
                  {flag} Native {partner.native_language} · Learning {partner.learning_language}
                </p>
                <span className="inline-block mt-2 px-2.5 py-0.5 bg-amber-100 border border-neutral-900 text-xs font-semibold text-neutral-800 rounded">
                  {partner.goal}
                </span>
              </div>
            </div>
          </div>

          {/* Session starters */}
          <div className="px-6 py-5 border-b-2 border-dashed border-stone-200">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-400 mb-4">
              To start the conversation
            </p>
            <ul className="space-y-3">
              {starters.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-amber-400 border-2 border-neutral-900 rounded text-xs font-black text-neutral-900 flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-stone-700 leading-relaxed">{s}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="px-6 py-5">
            <button
              onClick={handleStart}
              className="w-full py-4 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold rounded-lg shadow-[3px_3px_0_0_#111] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all text-base"
            >
              Start session →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
