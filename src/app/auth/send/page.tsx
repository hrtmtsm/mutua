'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignInPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(true);
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.email) { setChecking(false); return; }
      // Restore profile to localStorage before redirecting
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
      }
      router.replace('/app');
    });
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    });

    if (error) { setError('Incorrect email or password.'); setLoading(false); return; }

    // Restore profile to localStorage
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', data.user.email!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profile) {
      localStorage.setItem('mutua_session_id', profile.session_id);
      localStorage.setItem('mutua_profile', JSON.stringify(profile));
    }

    router.replace('/app');
  };


  if (checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-7">

        <div>
          <p className="font-serif font-black text-2xl text-neutral-900">Sign in</p>
          <p className="text-sm text-stone-500 mt-1">Welcome back.</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-3">

          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF]"
          />

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 pr-14 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF]"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-neutral-900 font-medium"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-40"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

        </form>

        <p className="text-center text-xs text-stone-400">
          Forgot your password?{' '}
          <a href="/reset-password/request" className="text-[#2B8FFF] font-semibold">Reset it</a>
        </p>

      </div>
    </div>
  );
}
