'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { saveProfile, checkWaitlistForMatch } from '@/lib/supabase';
import AppShell from '@/components/AppShell';

export default function WaitlistPage() {
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('mutua_profile');
    if (!stored) { router.replace('/onboarding'); return; }
    const profile: UserProfile = JSON.parse(stored);

    // Fire and forget — detect match silently
    (async () => {
      try { await saveProfile(profile); } catch { /* demo mode */ }
      if (!profile.email) return;
      try { await checkWaitlistForMatch(profile); } catch { /* ignore */ }
    })();
  }, [router]);

  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm px-16 py-16 max-w-lg w-full text-center space-y-4">
          <p className="font-serif font-black text-xl text-neutral-900">Welcome to Mutua.</p>
          <p className="text-sm text-stone-500 leading-relaxed">
            We&rsquo;re still early, so we don&rsquo;t have a partner match for you just yet.<br /><br />
            As soon as we find someone compatible, we&rsquo;ll reach out. Stay tuned.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
