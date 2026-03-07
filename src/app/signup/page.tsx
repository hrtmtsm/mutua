'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AppShell from '@/components/AppShell';

export default function SignupPage() {
  const router = useRouter();
  const [email,      setEmail]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  };

  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[5px_5px_0_0_#111] px-10 py-12 max-w-sm w-full text-center space-y-8">

          {sent ? (
            <div className="space-y-3">
              <p className="font-serif font-black text-xl text-neutral-900">Check your email.</p>
              <p className="text-sm text-stone-500 leading-relaxed">
                We sent a magic link to <strong>{email}</strong>.<br />
                Click it to create your account — no password needed.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="font-serif font-black text-xl text-neutral-900">Create your account.</p>
                <p className="text-sm text-stone-500 leading-relaxed">
                  Save your profile and matches across devices.<br />
                  No password needed — we&rsquo;ll email you a magic link.
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
                  className="w-full px-4 py-2.5 border-2 border-neutral-900 rounded-lg text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? 'Sending...' : 'Send magic link'}
                </button>
              </form>

              <button
                onClick={() => router.back()}
                className="text-xs text-stone-400 hover:text-neutral-900 transition-colors"
              >
                Back
              </button>
            </>
          )}

        </div>
      </div>
    </AppShell>
  );
}
