'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignInPage() {
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [linkSent, setLinkSent] = useState(false);

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

    router.replace('/find-match');
  };

  const handleMagicLink = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setLinkSent(true);
  };

  if (linkSent) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-3">
        <p className="font-serif font-black text-xl text-neutral-900">Check your inbox</p>
        <p className="text-sm text-stone-500">
          We sent a link to <span className="font-medium text-neutral-900">{email}</span>. Click it to sign in.
        </p>
      </div>
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

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-xs text-stone-400">or</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <button
          onClick={handleMagicLink}
          disabled={loading}
          className="w-full py-3 border border-stone-200 rounded-xl text-sm font-semibold text-neutral-900 hover:border-stone-400 transition-all disabled:opacity-40"
        >
          Send magic link instead
        </button>

      </div>
    </div>
  );
}
