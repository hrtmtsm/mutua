'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedPartner } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import { getPartners, removePartner, PARTNER_LIMIT } from '@/lib/partners';
import AppShell from '@/components/AppShell';

function Avatar({ name, language }: { name: string; language: string }) {
  const color = LANG_AVATAR_COLOR[language] ?? '#737373';
  return (
    <div
      style={{ backgroundColor: color }}
      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
    >
      {name.trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

function PartnerCard({
  partner,
  onRemove,
  onStartSession,
}: {
  partner: SavedPartner;
  onRemove: () => void;
  onStartSession: () => void;
}) {
  const flag = LANG_FLAGS[partner.native_language] ?? '';
  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 space-y-4">

      {/* Identity row */}
      <div className="flex items-center gap-3">
        <Avatar name={partner.name} language={partner.native_language} />
        <div className="flex-1 min-w-0">
          <p className="font-serif font-black text-lg text-neutral-900 leading-tight truncate">{partner.name}</p>
          <p className="text-xs text-stone-500 mt-0.5">
            {flag} {partner.native_language} ↔ {partner.learning_language}
          </p>
        </div>
        <button
          onClick={onRemove}
          title="Remove partner"
          className="text-stone-300 hover:text-neutral-900 text-xl font-bold leading-none transition-colors px-1"
        >
          ×
        </button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {[partner.goal, partner.comm_style, partner.availability].map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-sky-50 border border-sky-200 text-xs font-semibold text-[#2B8FFF] rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onStartSession}
          className="flex-1 py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md transition-all"
        >
          Start session
        </button>
        <button
          onClick={() => alert("Messaging is coming in the next version.")}
          className="flex-1 py-2.5 bg-white text-[#2B8FFF] border border-[#2B8FFF] font-semibold text-sm rounded-full hover:bg-sky-50 transition-all"
        >
          Message
        </button>
      </div>
    </div>
  );
}

export default function PracticePage() {
  const router = useRouter();
  const [partners, setPartners] = useState<SavedPartner[]>([]);

  useEffect(() => {
    setPartners(getPartners());
  }, []);

  const handleRemove = (partnerId: string) => {
    removePartner(partnerId);
    setPartners(getPartners());
  };

  const handleStartSession = (partner: SavedPartner) => {
    localStorage.setItem('mutua_current_partner', JSON.stringify(partner));
    router.push('/pre-session');
  };

  const atLimit = partners.length >= PARTNER_LIMIT;

  return (
    <AppShell>
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full space-y-5">

        {/* Page title row */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-serif font-black text-2xl text-neutral-900">Practice</h1>
        </div>


        {/* Partner cards */}
        {partners.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm px-8 py-12 text-center">
            <p className="font-serif font-black text-xl text-neutral-900 mb-2">No partners yet</p>
            <p className="text-sm text-stone-500">Your match will appear here once we find one for you.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {partners.map(p => (
              <PartnerCard
                key={p.partner_id}
                partner={p}
                onRemove={() => handleRemove(p.partner_id)}
                onStartSession={() => handleStartSession(p)}
              />
            ))}
          </div>
        )}

      </main>
    </AppShell>
  );
}
