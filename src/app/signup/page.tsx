'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AppShell from '@/components/AppShell';
import { Eye, EyeOff } from 'lucide-react';

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
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
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
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
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
