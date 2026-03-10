'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppShell from '@/components/AppShell';

export default function SignupPage() {
  const router = useRouter();
  const [email,        setEmail]       = useState('');
  const [password,     setPassword]   = useState('');
  const [confirm,      setConfirm]    = useState('');
  const [showPass,     setShowPass]   = useState(false);
  const [showConfirm,  setShowConfirm]= useState(false);
  const [submitting,   setSubmitting] = useState(false);
  const [error,        setError]      = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }

    setSubmitting(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    const hasProfile = Boolean(localStorage.getItem('mutua_profile'));
    router.push(hasProfile ? '/profile' : '/onboarding');
  };

  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm px-10 py-12 max-w-sm w-full text-center space-y-8">

          <>
            <div className="space-y-2">
              <p className="font-serif font-black text-xl text-neutral-900">Create your account.</p>
              <p className="text-sm text-stone-500 leading-relaxed">
                Save your profile and matches across devices.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-left">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={submitting}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF] disabled:opacity-50"
                />
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    disabled={submitting}
                    className="w-full px-4 py-2.5 pr-10 border border-stone-200 rounded-lg text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF] disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-900">
                    {showPass
                      ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd"/><path d="M10.748 13.93l2.523 2.524a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                    }
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Confirm password"
                    disabled={submitting}
                    className="w-full px-4 py-2.5 pr-10 border border-stone-200 rounded-lg text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF] disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-neutral-900">
                    {showConfirm
                      ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd"/><path d="M10.748 13.93l2.523 2.524a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                    }
                  </button>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? 'Creating...' : 'Create account'}
                </button>
              </form>

            <p className="text-xs text-stone-400">
              Already have an account?{' '}
              <Link href="/login" className="text-neutral-900 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </>

        </div>
      </div>
    </AppShell>
  );
}
