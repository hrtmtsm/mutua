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
      const params     = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
      const code = params.get('code');
      // type can be in query string (PKCE) or hash (implicit flow)
      const type = params.get('type') || hashParams.get('type');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setStatus('error'); return; }
      }

      // Password recovery flow — redirect to the reset page
      if (type === 'recovery') {
        router.replace('/reset-password');
        return;
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

        // needs_welcome is an explicit flag set only by the admin/stub profile
        // creation paths (invited users who have never set a password) — not
        // inferred from whether a name happens to be present. A SetupModal
        // signup never sets this flag, so it always skips straight to /app.
        //
        // IMPORTANT: until the `needs_welcome` column is migrated in, `select('*')`
        // simply omits the key — it will not exist on `profile` at all. We must not
        // read that as "false" (would silently skip password setup for invited
        // users). Distinguish "column missing" (`in` check fails) from "column
        // present and false" by key presence, and fall back to the exact
        // pre-existing name heuristic only in the missing-column case, so invited
        // users keep going through /auth/welcome exactly as before until the
        // migration lands — see invite-flow-fix-migration.sql.
        const needsWelcome = 'needs_welcome' in profile
          ? Boolean(profile.needs_welcome)
          : !(profile.name && !String(profile.name).includes('@'));
        router.replace(needsWelcome ? '/auth/welcome' : '/app');
      } else {
        // Authenticated but no profile row yet — this happens for a brand-new
        // SetupModal signup only when the Supabase project requires email
        // confirmation (so the profile wasn't created before this redirect).
        // Land on the main screen; it asks for just the language pair via
        // SetupModal the next time the user tries to act, not here.
        router.replace('/app');
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
