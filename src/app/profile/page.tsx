'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { LANGUAGES, GOALS, COMM_STYLES, FREQUENCY, type Language, type Goal, type CommStyle, type Frequency } from '@/lib/types';
import { LANG_FLAGS } from '@/lib/constants';
import { supabase, saveProfile } from '@/lib/supabase';
import type { UserAvailability } from '@/lib/supabase';
import AppShell from '@/components/AppShell';
import AvailabilityPicker from '@/components/AvailabilityPicker';
import { Pencil, Camera, ChevronDown } from 'lucide-react';

const LANG_COLORS: Record<string, string> = {
  Japanese: '#3b82f6', Korean: '#8b5cf6', Mandarin: '#ef4444',
  Spanish: '#f59e0b', French: '#10b981', English: '#6366f1',
  Portuguese: '#f97316', German: '#64748b', Italian: '#ec4899', Arabic: '#14b8a6',
};

export default function ProfilePage() {
  const router     = useRouter();
  const fileRef    = useRef<HTMLInputElement>(null);

  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  const [editing,        setEditing]        = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [saving,         setSaving]         = useState(false);

  // Identity fields
  const [name,      setName]      = useState('');
  const [draftName, setDraftName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Availability
  const [availSlots,    setAvailSlots]    = useState<UserAvailability[]>([]);
  const [availTimezone, setAvailTimezone] = useState('');
  const [savingAvail,   setSavingAvail]   = useState(false);
  const [editingAvail,  setEditingAvail]  = useState(false);

  // Preference fields
  const [native,     setNative]     = useState<Language>('English');
  const [learning,   setLearning]   = useState<Language>('Japanese');
  const [goal,       setGoal]       = useState<Goal>('Casual conversation');
  const [commStyle,  setCommStyle]  = useState<CommStyle>('Voice call');
  const [practiceFrequency, setPracticeFrequency] = useState<Frequency>('Once a week');

  useEffect(() => {
    const stored = localStorage.getItem('mutua_profile');
    if (stored) {
      const p: UserProfile = JSON.parse(stored);
      setProfile(p);
      setName(p.name ?? '');
      setDraftName(p.name ?? '');
      setAvatarUrl((p as any).avatar_url ?? '');
      setNative(p.native_language);
      setLearning(p.learning_language);
      setGoal(p.goal);
      setCommStyle(p.comm_style);
      if (p.practice_frequency) setPracticeFrequency(p.practice_frequency);
    }

    // Load existing availability (requires auth session)
    async function loadAvailability() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const avResp = await fetch('/api/get-availability', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
      if (!avResp?.ok) return;
      const av = await avResp.json();
      if (av.slots?.length) {
        setAvailSlots(av.slots);
        setAvailTimezone(av.timezone ?? '');
      }
    }
    loadAvailability();
  }, []);

  const handleAvatarClick = () => fileRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${profile.session_id}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl;
      setAvatarUrl(url);
      await supabase.from('profiles').update({ avatar_url: url }).eq('session_id', profile.session_id);
      const stored = localStorage.getItem('mutua_profile');
      if (stored) localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(stored), avatar_url: url }));
    }
    setUploading(false);
  };

  const handleSaveIdentity = async () => {
    if (!profile || !draftName.trim()) return;
    setSaving(true);
    const trimmed = draftName.trim();

    await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: profile.session_id, name: trimmed }),
    });

    const stored = localStorage.getItem('mutua_profile');
    if (stored) localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(stored), name: trimmed }));
    setProfile(p => p ? { ...p, name: trimmed } : p);
    setName(trimmed);
    setSaving(false);
    setEditingIdentity(false);
  };

  const handleSavePrefs = async () => {
    if (!profile) return;
    setSaving(true);
    const updated: UserProfile = {
      ...profile,
      native_language:    native,
      learning_language:  learning,
      goal,
      comm_style:         commStyle,
      practice_frequency: practiceFrequency,
    };
    localStorage.setItem('mutua_profile', JSON.stringify(updated));
    setProfile(updated);
    try { await saveProfile(updated); } catch { /* offline */ }
    setSaving(false);
    setEditing(false);
  };

  const initials = name.trim().slice(0, 2).toUpperCase() || '?';
  const avatarBg = LANG_COLORS[native] ?? '#3b82f6';

  const selectClass = "appearance-none text-sm font-semibold text-neutral-900 border border-stone-300 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-neutral-900 bg-stone-50 cursor-pointer";
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

        {profile ? (
          <>
            {/* ── Identity card ── */}
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-4">

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Your identity</p>
                {!editingIdentity ? (
                  <button onClick={() => { setDraftName(name); setEditingIdentity(true); }} title="Edit" className="text-stone-300 hover:text-neutral-900 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => setEditingIdentity(false)} className="text-xs text-stone-400 hover:text-neutral-900 transition-colors">Cancel</button>
                )}
              </div>

              <div className="flex items-center gap-5">

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`block w-16 h-16 rounded-2xl overflow-hidden ${editingIdentity ? 'cursor-pointer group' : ''}`}
                       onClick={editingIdentity ? handleAvatarClick : undefined}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <div style={{ backgroundColor: avatarBg }} className="w-full h-full flex items-center justify-center font-black text-white text-xl">
                        {initials}
                      </div>
                    )}
                    {editingIdentity && (
                      <div className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1.5">Name</p>
                  {editingIdentity ? (
                    <input
                      type="text"
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      autoFocus
                      placeholder="Your name"
                      className="w-full text-base font-bold text-neutral-900 border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#2B8FFF] transition-colors"
                    />
                  ) : (
                    <p className="text-base font-bold text-neutral-900">{name || '—'}</p>
                  )}
                </div>

              </div>

              {editingIdentity && (
                <button onClick={handleSaveIdentity} disabled={saving} className="w-full py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              )}

            </div>

            {/* ── Preferences card ── */}
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-4">

              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Your preferences</p>
                {!editing ? (
                  <button onClick={() => setEditing(true)} title="Edit" className="text-stone-300 hover:text-neutral-900 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => setEditing(false)} className="text-xs text-stone-400 hover:text-neutral-900 transition-colors">Cancel</button>
                )}
              </div>

              <div className="space-y-0">
                {[
                  { label: 'Native language', value: `${LANG_FLAGS[native] ?? ''} ${native}`, editor: <SelectWrap><select value={native} onChange={e => setNative(e.target.value as Language)} className={selectClass}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></SelectWrap> },
                  { label: 'Learning',         value: `${LANG_FLAGS[learning] ?? ''} ${learning}`, editor: <SelectWrap><select value={learning} onChange={e => setLearning(e.target.value as Language)} className={selectClass}>{LANGUAGES.filter(l => l !== native).map(l => <option key={l}>{l}</option>)}</select></SelectWrap> },
                  { label: 'Goal',             value: goal,             editor: <SelectWrap><select value={goal} onChange={e => setGoal(e.target.value as Goal)} className={selectClass}>{GOALS.map(g => <option key={g}>{g}</option>)}</select></SelectWrap> },
                  { label: 'Style',            value: commStyle,        editor: <SelectWrap><select value={commStyle} onChange={e => setCommStyle(e.target.value as CommStyle)} className={selectClass}>{COMM_STYLES.map(s => <option key={s}>{s}</option>)}</select></SelectWrap> },
                  { label: 'Frequency',        value: practiceFrequency, editor: <SelectWrap><select value={practiceFrequency} onChange={e => setPracticeFrequency(e.target.value as Frequency)} className={selectClass}>{FREQUENCY.map(f => <option key={f}>{f}</option>)}</select></SelectWrap> },
                ].map(({ label, value, editor }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</span>
                    {editing ? editor : <span className="text-sm font-semibold text-neutral-900">{value}</span>}
                  </div>
                ))}
              </div>

              {editing && (
                <button onClick={handleSavePrefs} disabled={saving} className="w-full py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              )}

            </div>
            {/* ── Availability card ── */}
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Weekly availability</p>
                  {availSlots.length > 0 && !editingAvail && (
                    <p className="text-xs text-stone-400 mt-0.5">{availSlots.length} slot{availSlots.length === 1 ? '' : 's'} saved</p>
                  )}
                </div>
                {!editingAvail ? (
                  <button onClick={() => setEditingAvail(true)} className="text-xs font-semibold text-[#2B8FFF] hover:underline">
                    {availSlots.length > 0 ? 'Edit' : 'Set availability'}
                  </button>
                ) : (
                  <button onClick={() => setEditingAvail(false)} className="text-xs text-stone-400 hover:text-neutral-900 transition-colors">Cancel</button>
                )}
              </div>

              {!editingAvail && availSlots.length === 0 && (
                <p className="text-sm text-stone-500">
                  Set your recurring free times so we can find a session slot with your partner automatically.
                </p>
              )}

              {editingAvail && (
                <AvailabilityPicker
                  initial={availSlots}
                  timezone={availTimezone || undefined}
                  onChange={(slots, tz) => { setAvailSlots(slots as UserAvailability[]); setAvailTimezone(tz); }}
                  onSave={async (slots, tz) => {
                    setSavingAvail(true);
                    const { data: { session } } = await supabase.auth.getSession();
                    await fetch('/api/set-availability', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                      },
                      body: JSON.stringify({ slots, timezone: tz }),
                    });
                    setAvailSlots(slots as UserAvailability[]);
                    setAvailTimezone(tz);
                    setSavingAvail(false);
                    setEditingAvail(false);
                  }}
                  saving={savingAvail}
                />
              )}
            </div>

          </>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm px-8 py-12 text-center space-y-3">
            <p className="font-serif font-black text-xl text-neutral-900">No profile yet</p>
            <p className="text-sm text-stone-500">Complete onboarding to set up your profile.</p>
            <button onClick={() => router.push('/onboarding')} className="mt-2 inline-block px-6 py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md">
              Get started
            </button>
          </div>
        )}

      </main>
    </AppShell>
  );
}
