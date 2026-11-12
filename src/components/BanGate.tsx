'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/components/LocaleProvider';

// Pages that should never show the ban gate (auth flows)
const EXEMPT = ['/login', '/signup', '/auth', '/onboarding', '/landing', '/admin'];
const isExempt = (path: string) => EXEMPT.some(p => path === p || path.startsWith(p + '/'));

interface BanInfo {
  banned_until:   string;
  ban_reason:     string | null;
  ban_claimed_at: string | null;
}

export default function BanGate({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const isPrivacyPage = pathname === '/privacy';
  const [ban,      setBan]      = useState<BanInfo | null>(null);
  const [checked,  setChecked]  = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed,  setClaimed]  = useState(false);
  const [note,     setNote]     = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (isPrivacyPage) return;
    if (isExempt(pathname)) { setChecked(true); return; }

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setChecked(true); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('banned_until, ban_reason, ban_claimed_at')
        .eq('id', session.user.id)
        .single();

      if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
        setBan(profile as BanInfo);
        setClaimed(!!profile.ban_claimed_at);
      }
      setChecked(true);
    }
    check();
  }, [pathname, isPrivacyPage]);

  const handleClaim = async () => {
    setClaiming(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setClaiming(false); return; }

    await fetch('/api/claim-ban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ note }),
    });
    setClaiming(false);
    setClaimed(true);
    setShowForm(false);
  };

  if (isPrivacyPage) return <>{children}</>;

  // Don't flash content before check
  if (!checked) return null;

  if (ban) {
    const until = new Date(ban.banned_until).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-5">
          <span className="text-2xl">🚫</span>
        </div>

        <h1 className="font-serif font-black text-2xl text-neutral-900 mb-2">
          {t('banGate.title')}
        </h1>
        <p className="text-sm text-stone-500 mb-4 leading-relaxed">
          {t('banGate.suspendedUntil').split('{date}')[0]}<strong className="text-neutral-800">{until}</strong>{t('banGate.suspendedUntil').split('{date}')[1]}
        </p>

        {ban.ban_reason && (
          <div className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 mb-6 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">{t('banGate.flaggedMessage')}</p>
            <p className="text-sm text-neutral-700 leading-relaxed italic">"{ban.ban_reason}"</p>
          </div>
        )}

        <p className="text-xs text-stone-400 leading-relaxed mb-6">
          {t('banGate.policyNotice')}
        </p>

        {claimed ? (
          <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm font-semibold text-emerald-700">{t('banGate.appealSubmittedTitle')}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{t('banGate.appealSubmittedBody')}</p>
          </div>
        ) : showForm ? (
          <div className="w-full space-y-3">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('banGate.appealPlaceholder')}
              rows={3}
              className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-stone-200 resize-none text-neutral-800 placeholder-stone-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm border border-stone-200 text-stone-500 rounded-xl"
              >
                {t('profile.cancel')}
              </button>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="flex-1 py-2.5 text-sm bg-neutral-900 text-white font-semibold rounded-xl disabled:opacity-40"
              >
                {claiming ? t('banGate.submitting') : t('banGate.submitAppeal')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-[#2B8FFF] underline"
          >
            {t('banGate.claimMistake')}
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
