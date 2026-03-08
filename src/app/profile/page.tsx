'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { LANG_FLAGS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import AppShell from '@/components/AppShell';

export default function ProfilePage() {
  const router = useRouter();
  const [profile,       setProfile]       = useState<UserProfile | null>(null);
  const [signedIn,      setSignedIn]      = useState(false);
  const [userEmail,     setUserEmail]     = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('mutua_profile');
    if (stored) setProfile(JSON.parse(stored));

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setUserEmail(data.session.user.email ?? '');
      }
    });
  }, []);

  return (
    <AppShell>
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full space-y-5">

        <h1 className="font-serif font-black text-2xl text-neutral-900">Profile</h1>

        {/* Account status — only show when signed in */}
        {signedIn && (
          <div className="bg-white border-2 border-neutral-900 rounded-xl px-5 py-4 shadow-[2px_2px_0_0_#111] flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-neutral-900 text-sm">Signed in as {userEmail}</p>
              <p className="text-xs text-stone-500 mt-0.5">Your profile is saved to your account.</p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setSignedIn(false);
                setUserEmail('');
              }}
              className="text-xs font-semibold text-stone-400 hover:text-neutral-900 transition-colors shrink-0"
            >
              Sign out
            </button>
          </div>
        )}

        {/* Profile data */}
        {profile ? (
          <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[4px_4px_0_0_#111] p-6 space-y-4">
            <div className="space-y-0">
              {[
                { label: 'Native language', value: `${LANG_FLAGS[profile.native_language] ?? ''} ${profile.native_language}` },
                { label: 'Learning',        value: `${LANG_FLAGS[profile.learning_language] ?? ''} ${profile.learning_language}` },
                { label: 'Goal',            value: profile.goal },
                { label: 'Style',           value: profile.comm_style },
                { label: 'Availability',    value: profile.availability },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</span>
                  <span className="text-sm font-semibold text-neutral-900">{value}</span>
                </div>
              ))}
            </div>

            {!signedIn && (
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/signup')}
                  className="flex-1 py-2.5 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  Create an account
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="flex-1 py-2.5 bg-white text-neutral-900 border-2 border-neutral-900 font-semibold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  Sign in
                </button>
              </div>
            )}
            <button
              onClick={() => {
                localStorage.removeItem('mutua_profile');
                localStorage.removeItem('mutua_session_id');
                router.push('/onboarding');
              }}
              className="w-full py-2.5 bg-white text-neutral-900 border-2 border-neutral-900 font-semibold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Update preferences
            </button>
          </div>
        ) : (
          <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[4px_4px_0_0_#111] px-8 py-12 text-center space-y-3">
            <p className="font-serif font-black text-xl text-neutral-900">No profile yet</p>
            <p className="text-sm text-stone-500">Create an account to get started.</p>
            <button
              onClick={() => router.push('/signup')}
              className="mt-2 inline-block px-6 py-2.5 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Create an account
            </button>
          </div>
        )}

      </main>
    </AppShell>
  );
}
