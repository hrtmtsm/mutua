'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function WelcomePage() {
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) { router.replace('/auth/send'); return; }
      setEmail(session.user.email);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())          { setError('Please enter your name.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    setError('');

    // Set password on the auth user
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) { setError(pwError.message); setLoading(false); return; }

    // Save name to profiles table
    const sessionId = localStorage.getItem('mutua_session_id');
    if (sessionId) {
      await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('session_id', sessionId);

      // Keep localStorage in sync
      const stored = localStorage.getItem('mutua_profile');
      if (stored) {
        const profile = JSON.parse(stored);
        localStorage.setItem('mutua_profile', JSON.stringify({ ...profile, name: name.trim() }));
      }
    }

    router.replace('/find-match');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <p className="text-base font-bold text-neutral-900 mb-10 tracking-tight">Mutua</p>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="font-serif font-black text-neutral-900 leading-[1.05] mb-3 whitespace-nowrap text-2xl">
            Welcome back.
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Your partner will see your name.<br />
            Set a password so you can sign in anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-stone-500 mb-1.5 block">
              First name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Haruto"
              autoFocus
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-300 focus:outline-none focus:border-[#2B8FFF] focus:ring-2 focus:ring-[#2B8FFF]/10 transition-all"
            />
          </div>

          {/* Email — read-only */}
          <div>
            <label className="text-xs font-semibold text-stone-500 mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full px-4 py-3 border border-stone-100 rounded-xl text-sm text-stone-400 bg-stone-50 cursor-default focus:outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-stone-500 mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-3 pr-14 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-300 focus:outline-none focus:border-[#2B8FFF] focus:ring-2 focus:ring-[#2B8FFF]/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-neutral-700 font-semibold transition-colors"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || password.length < 8}
            className="w-full py-3.5 btn-primary text-white font-bold text-sm rounded-xl disabled:opacity-40 disabled:pointer-events-none mt-2"
          >
            {loading ? 'Saving...' : 'Continue →'}
          </button>

        </form>

      </div>
    </div>
  );
}
