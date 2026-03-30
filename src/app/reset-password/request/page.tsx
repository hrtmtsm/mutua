'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordRequestPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/callback` },
    );

    if (error) { setError(error.message); setLoading(false); return; }
    setSent(true);
  };

  if (sent) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <p className="font-serif font-black text-2xl text-neutral-900">Check your email</p>
        <p className="text-sm text-stone-500 leading-relaxed">
          We sent a password reset link to <span className="font-semibold text-neutral-900">{email}</span>.
        </p>
        <a href="/auth/send" className="block text-xs text-[#2B8FFF] font-semibold">
          Back to sign in
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-7">

        <div>
          <p className="font-serif font-black text-2xl text-neutral-900">Reset password</p>
          <p className="text-sm text-stone-500 mt-1">We&apos;ll send you a link to reset it.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2B8FFF]"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-3 btn-primary text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-40"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <a href="/auth/send" className="block text-center text-xs text-stone-400 hover:text-neutral-900">
          Back to sign in
        </a>

      </div>
    </div>
  );
}
