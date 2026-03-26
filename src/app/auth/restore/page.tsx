'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { initAnalytics, identifyUser, track } from '@/lib/analytics';

export default function AuthRestorePage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('sid');
    if (!sid) { router.replace('/onboarding'); return; }

    supabase
      .from('profiles')
      .select('*')
      .eq('session_id', sid)
      .maybeSingle()
      .then(({ data: profile }) => {
        if (profile) {
          localStorage.setItem('mutua_session_id', profile.session_id);
          localStorage.setItem('mutua_profile', JSON.stringify(profile));
          initAnalytics();
          identifyUser(profile.session_id, {
            native_language:   profile.native_language,
            learning_language: profile.learning_language,
          });
          track('waitlist_activated');
          router.replace('/find-match');
        } else {
          setError(true);
        }
      });
  }, [router]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="font-serif font-black text-xl text-neutral-900">Link not found</p>
        <p className="text-sm text-stone-500">This link may have expired. Please sign in again.</p>
        <a href="/auth/send" className="text-sm text-[#2B8FFF] font-semibold">Get a new link</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-stone-400 text-sm">Signing you in...</p>
    </div>
  );
}
