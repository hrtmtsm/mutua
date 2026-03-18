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
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-7">

        <div>
          <p className="font-serif font-black text-2xl text-neutral-900">One last thing.</p>
          <p className="text-sm text-stone-500 mt-1">
            Your partner will see your name. Set a password so you can sign in anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Name */}
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your first name"
            autoFocus
            className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF]"
          />

          {/* Email — read-only */}
          <input
            type="email"
            value={email}
            readOnly
            className="w-full px-4 py-3 border border-stone-100 rounded-xl text-sm text-stone-400 bg-stone-50 cursor-default focus:outline-none"
          />

          {/* Password */}
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create a password (min. 8 chars)"
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
            disabled={loading || !name.trim() || !password}
            className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-40"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>

        </form>

        <button
          onClick={() => router.replace('/find-match')}
          className="w-full text-center text-sm text-stone-400 hover:text-neutral-900 transition-colors"
        >
          Skip for now
        </button>

      </div>
    </div>
  );
}
