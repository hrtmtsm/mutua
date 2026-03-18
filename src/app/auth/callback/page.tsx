'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router  = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const run = async () => {
      // PKCE flow: code in query string
      const params = new URLSearchParams(window.location.search);
      const code   = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setStatus('error'); return; }
      }

      // Implicit flow: #access_token= in hash — Supabase JS processes it automatically.
      // Either way, getSession() now returns the active session.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.email) { setStatus('error'); return; }

      // Look up their profile by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', session.user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profile) {
        localStorage.setItem('mutua_session_id', profile.session_id);
        localStorage.setItem('mutua_profile', JSON.stringify(profile));

        // If they already have a name set, skip welcome — they're a returning user
        const alreadySetUp = profile.name && !profile.name.includes('@');
        router.replace(alreadySetUp ? '/find-match' : '/auth/welcome');
      } else {
        // Authenticated but no profile — go through onboarding
        router.replace('/onboarding');
      }
    };

    run();
  }, [router]);

  if (status === 'error') return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="font-serif font-black text-2xl text-neutral-900 mb-2">Link already used</p>
          <p className="text-sm text-stone-500 leading-relaxed">
            This link can only be used once. Sign in with your email and password instead.
          </p>
        </div>
        <a
          href="/auth/send"
          className="block w-full py-3 text-center btn-primary text-white font-bold text-sm rounded-xl"
        >
          Sign in →
        </a>
        <p className="text-center text-xs text-stone-400">
          No password set?{' '}
          <a href="/auth/send" className="text-[#2B8FFF] font-semibold">Email me a new link</a>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-stone-400 text-sm">Signing you in...</p>
    </div>
  );
}
