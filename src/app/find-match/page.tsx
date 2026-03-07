'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { findCandidates, saveToWaitlist, checkWaitlistForMatch } from '@/lib/supabase';
import { buildMatchResult } from '@/lib/matching';
import AppShell from '@/components/AppShell';

const MESSAGES = [
  'Looking for language partners...',
  'Checking compatibility...',
  'Analyzing shared goals...',
  'Almost there...',
];

export default function FindMatchPage() {
  const router = useRouter();
  const [msgIdx,     setMsgIdx]     = useState(0);
  const [noMatch,    setNoMatch]    = useState(false);
  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [email,      setEmail]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => Math.min(i + 1, MESSAGES.length - 1)), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const run = async () => {
      const stored = localStorage.getItem('mutua_profile');
      if (!stored) { router.replace('/onboarding'); return; }

      const p: UserProfile = JSON.parse(stored);
      setProfile(p);

      const [candidates] = await Promise.all([
        findCandidates(p).catch(() => [] as UserProfile[]),
        new Promise(r => setTimeout(r, 3000)),
      ]);

      // No candidates found → show waitlist state
      if ((candidates as UserProfile[]).length === 0) {
        setNoMatch(true);
        return;
      }

      // Real mode: candidates found — also notify anyone waiting on the waitlist
      const waitlisted = await checkWaitlistForMatch(p).catch(() => [] as Awaited<ReturnType<typeof checkWaitlistForMatch>>);
      if (waitlisted.length > 0) {
        const waitlistEmails = waitlisted.map(w => w.email).filter(Boolean);
        fetch('/api/notify-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: waitlistEmails }),
        }).catch(() => {});
      }

      const match = buildMatchResult(p, candidates as UserProfile[]);
      localStorage.setItem('mutua_match', JSON.stringify(match));
      router.push('/match-result');
    };
    run();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !profile) return;
    setSubmitting(true);
    try {
      await saveToWaitlist({
        email,
        native_language:    profile.native_language,
        target_language:    profile.learning_language,
        goal:               profile.goal,
        communication_style: profile.comm_style,
        availability:       profile.availability,
      });
    } catch {
      // Store silently even if Supabase fails
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center px-6">
        {noMatch ? (
          <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[5px_5px_0_0_#111] px-10 py-12 max-w-sm w-full text-center space-y-8">

            {submitted ? (
              <div className="space-y-2">
                <p className="font-serif font-bold text-lg text-neutral-900">You&rsquo;re on the list.</p>
                <p className="text-sm text-stone-500 leading-relaxed">
                  We&rsquo;ll notify you as soon as a compatible exchange partner joins Mutua.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="font-serif font-bold text-lg text-neutral-900">You&rsquo;re early.</p>
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Mutua is still growing, so a compatible partner might take a little time.<br /><br />
                    Leave your email and we&rsquo;ll notify you as soon as we find someone who matches you.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    disabled={submitting}
                    className="w-full px-4 py-2.5 border-2 border-neutral-900 rounded-lg text-sm text-neutral-900 placeholder:text-stone-400 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {submitting ? 'Saving...' : 'Notify me'}
                  </button>
                </form>
              </>
            )}

          </div>
        ) : (
          <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[5px_5px_0_0_#111] px-10 py-12 max-w-sm w-full text-center space-y-8">

            {/* Spinner */}
            <div className="relative w-14 h-14 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-stone-200" />
              <div className="absolute inset-0 rounded-full border-4 border-neutral-900 border-t-transparent animate-spin" />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <p className="font-serif font-bold text-lg text-neutral-900">{MESSAGES[msgIdx]}</p>
              <p className="text-sm text-stone-500">This only takes a moment</p>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 bg-amber-400 border border-neutral-900 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
