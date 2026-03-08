'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { LANGUAGES, GOALS, COMM_STYLES, AVAILABILITY, type Language, type Goal, type CommStyle, type Availability } from '@/lib/types';
import { LANG_FLAGS } from '@/lib/constants';
import { supabase, saveProfile } from '@/lib/supabase';
import AppShell from '@/components/AppShell';

export default function ProfilePage() {
  const router = useRouter();
  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [signedIn,   setSignedIn]   = useState(false);
  const [userEmail,  setUserEmail]  = useState('');
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Editable fields
  const [native,       setNative]       = useState<Language>('English');
  const [learning,     setLearning]     = useState<Language>('Japanese');
  const [goal,         setGoal]         = useState<Goal>('Casual conversation');
  const [commStyle,    setCommStyle]    = useState<CommStyle>('Voice call');
  const [availability, setAvailability] = useState<Availability>('Flexible');

  useEffect(() => {
    const stored = localStorage.getItem('mutua_profile');
    if (stored) {
      const p: UserProfile = JSON.parse(stored);
      setProfile(p);
      setNative(p.native_language);
      setLearning(p.learning_language);
      setGoal(p.goal);
      setCommStyle(p.comm_style);
      setAvailability(p.availability);
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setUserEmail(data.session.user.email ?? '');
      }
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const updated: UserProfile = {
      ...profile,
      native_language:   native,
      learning_language: learning,
      goal,
      comm_style:        commStyle,
      availability,
    };
    localStorage.setItem('mutua_profile', JSON.stringify(updated));
    setProfile(updated);
    try { await saveProfile(updated); } catch { /* offline */ }
    setSaving(false);
    setEditing(false);
  };

  const selectClass = "appearance-none text-sm font-semibold text-neutral-900 border-2 border-neutral-900 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none bg-white shadow-[2px_2px_0_0_#111] cursor-pointer";
  const ChevronDown = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
  const SelectWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="relative flex items-center">
      {children}
      <span className="absolute right-2.5 text-neutral-900 pointer-events-none"><ChevronDown /></span>
    </div>
  );

  return (
    <AppShell>
      <main className="flex-1 px-6 py-8 max-w-lg mx-auto w-full space-y-5">

        <h1 className="font-serif font-black text-2xl text-neutral-900">Profile</h1>

        {/* Account status */}
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

            {/* Card header with edit toggle */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Your preferences</p>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  title="Edit preferences"
                  className="text-stone-300 hover:text-neutral-900 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => { setEditing(false); }}
                  className="text-xs text-stone-400 hover:text-neutral-900 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Rows */}
            <div className="space-y-0">
              {[
                {
                  label: 'Native language',
                  value: `${LANG_FLAGS[native] ?? ''} ${native}`,
                  editor: (
                    <SelectWrap><select value={native} onChange={e => setNative(e.target.value as Language)} className={selectClass}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></SelectWrap>
                  ),
                },
                {
                  label: 'Learning',
                  value: `${LANG_FLAGS[learning] ?? ''} ${learning}`,
                  editor: (
                    <SelectWrap><select value={learning} onChange={e => setLearning(e.target.value as Language)} className={selectClass}>{LANGUAGES.filter(l => l !== native).map(l => <option key={l}>{l}</option>)}</select></SelectWrap>
                  ),
                },
                {
                  label: 'Goal',
                  value: goal,
                  editor: (
                    <SelectWrap><select value={goal} onChange={e => setGoal(e.target.value as Goal)} className={selectClass}>{GOALS.map(g => <option key={g}>{g}</option>)}</select></SelectWrap>
                  ),
                },
                {
                  label: 'Style',
                  value: commStyle,
                  editor: (
                    <SelectWrap><select value={commStyle} onChange={e => setCommStyle(e.target.value as CommStyle)} className={selectClass}>{COMM_STYLES.map(s => <option key={s}>{s}</option>)}</select></SelectWrap>
                  ),
                },
                {
                  label: 'Availability',
                  value: availability,
                  editor: (
                    <SelectWrap><select value={availability} onChange={e => setAvailability(e.target.value as Availability)} className={selectClass}>{AVAILABILITY.map(a => <option key={a}>{a}</option>)}</select></SelectWrap>
                  ),
                },
              ].map(({ label, value, editor }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</span>
                  {editing ? editor : <span className="text-sm font-semibold text-neutral-900">{value}</span>}
                </div>
              ))}
            </div>

            {editing && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            )}

            {!signedIn && !editing && (
              <div className="flex gap-2 pt-1">
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
          </div>
        ) : (
          <div className="bg-white border-2 border-neutral-900 rounded-2xl shadow-[4px_4px_0_0_#111] px-8 py-12 text-center space-y-3">
            <p className="font-serif font-black text-xl text-neutral-900">No profile yet</p>
            <p className="text-sm text-stone-500">Complete onboarding to set up your profile.</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-2 inline-block px-6 py-2.5 bg-amber-400 text-neutral-900 border-2 border-neutral-900 font-bold text-sm rounded-lg shadow-[2px_2px_0_0_#111] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Get started
            </button>
          </div>
        )}

      </main>
    </AppShell>
  );
}
