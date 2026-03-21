'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { LANGUAGES, GOALS, COMM_STYLES, FREQUENCY, type Language, type Goal, type CommStyle, type Frequency } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import { supabase, saveProfile } from '@/lib/supabase';
import type { UserAvailability } from '@/lib/supabase';
import AppShell from '@/components/AppShell';
import AvailabilityPicker from '@/components/AvailabilityPicker';
import { Pencil, Camera, ChevronDown } from 'lucide-react';


const CROP_SIZE = 260;

function CropModal({ src, onConfirm, onCancel }: { src: string; onConfirm: (blob: Blob) => void; onCancel: () => void }) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset]   = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const imgSizeRef = useRef({ w: 0, h: 0 });
  const dragging  = useRef(false);
  const lastPos   = useRef({ x: 0, y: 0 });

  const clamp = (ox: number, oy: number, w: number, h: number) => ({
    x: Math.min(0, Math.max(CROP_SIZE - w, ox)),
    y: Math.min(0, Math.max(CROP_SIZE - h, oy)),
  });

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const s   = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
    const w   = img.naturalWidth * s;
    const h   = img.naturalHeight * s;
    imgSizeRef.current = { w, h };
    setImgSize({ w, h });
    const start = clamp((CROP_SIZE - w) / 2, (CROP_SIZE - h) / 2, w, h);
    offsetRef.current = start;
    setOffset(start);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const dx = clientX - lastPos.current.x;
      const dy = clientY - lastPos.current.y;
      lastPos.current = { x: clientX, y: clientY };
      const next = clamp(
        offsetRef.current.x + dx,
        offsetRef.current.y + dy,
        imgSizeRef.current.w,
        imgSizeRef.current.h,
      );
      offsetRef.current = next;
      setOffset({ ...next });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true;
    lastPos.current  = { x: clientX, y: clientY };
  };

  const handleConfirm = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d')!;
    const img = imgRef.current!;
    ctx.drawImage(img, offsetRef.current.x, offsetRef.current.y, imgSizeRef.current.w, imgSizeRef.current.h);
    canvas.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-stone-100">
          <p className="text-sm font-semibold text-neutral-900">Crop photo</p>
          <p className="text-xs text-stone-400 mt-0.5">Drag to reposition</p>
        </div>

        <div className="flex justify-center py-6">
          <div
            className="relative overflow-hidden rounded-full select-none"
            style={{ width: CROP_SIZE, height: CROP_SIZE, cursor: 'grab', touchAction: 'none' }}
            onMouseDown={e => startDrag(e.clientX, e.clientY)}
            onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onLoad}
              draggable={false}
              style={{ position: 'absolute', left: offset.x, top: offset.y, width: imgSize.w, height: imgSize.h, pointerEvents: 'none', userSelect: 'none' }}
            />
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-semibold text-stone-500 border border-stone-200 rounded-full hover:bg-stone-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} className="flex-1 py-2.5 btn-primary text-white text-sm font-semibold rounded-full">
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router     = useRouter();
  const fileRef    = useRef<HTMLInputElement>(null);

  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  const [editing,        setEditing]        = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [saving,         setSaving]         = useState(false);

  const [name,      setName]      = useState('');
  const [draftName, setDraftName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [availSlots,    setAvailSlots]    = useState<UserAvailability[]>([]);
  const [availTimezone, setAvailTimezone] = useState('');
  const [savingAvail,   setSavingAvail]   = useState(false);
  const [editingAvail,  setEditingAvail]  = useState(false);

  const [native,     setNative]     = useState<Language>('English');
  const [learning,   setLearning]   = useState<Language>('Japanese');
  const [goal,       setGoal]       = useState<Goal>('Casual conversation');
  const [commStyle,  setCommStyle]  = useState<CommStyle>('Voice call');
  const [practiceFrequency, setPracticeFrequency] = useState<Frequency>('Once a week');
  const [interests, setInterests] = useState('');

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
      if (p.interests) setInterests(p.interests);
    }

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

  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const handleAvatarClick = () => fileRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!profile) return;
    setCropSrc(null);

    // Show immediately via object URL (current page only — not saved to localStorage)
    const localUrl = URL.createObjectURL(blob);
    setAvatarUrl(localUrl);

    setUploading(true);
    const path = `${profile.session_id}.jpg`;
    const file = new File([blob], path, { type: 'image/jpeg' });
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      console.error('Avatar upload error:', error);
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now();
      setAvatarUrl(url); // replace blob URL with real persistent URL
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
      interests:          interests.trim() || undefined,
    };
    localStorage.setItem('mutua_profile', JSON.stringify(updated));
    setProfile(updated);
    try { await saveProfile(updated); } catch { /* offline */ }
    setSaving(false);
    setEditing(false);
  };

  const initials = name.trim().slice(0, 2).toUpperCase() || '?';
  const avatarBg = LANG_AVATAR_COLOR[native] ?? '#3b82f6';

  const selectClass = "appearance-none text-sm font-semibold text-neutral-900 border border-stone-300 rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-neutral-900 bg-stone-50 cursor-pointer";
  const SelectWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="relative flex items-center">
      {children}
      <span className="absolute right-2.5 text-neutral-900 pointer-events-none"><ChevronDown /></span>
    </div>
  );

  return (
    <>
    {cropSrc && <CropModal src={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />}
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-5">

        <h1 className="font-serif font-bold text-3xl text-[#171717]">Profile</h1>

        {profile ? (
          <>
            {/* ── Identity card ── */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-400">Your identity</p>
                {!editingIdentity ? (
                  <button onClick={() => { setDraftName(name); setEditingIdentity(true); }} title="Edit" className="text-stone-300 hover:text-neutral-900 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => setEditingIdentity(false)} className="text-xs text-stone-400 hover:text-neutral-900 transition-colors">Cancel</button>
                )}
              </div>

              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <button className="block w-16 h-16 rounded-2xl overflow-hidden cursor-pointer group" onClick={handleAvatarClick}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className="w-full h-full object-cover"
                        onError={() => {
                          setAvatarUrl('');
                          const s = localStorage.getItem('mutua_profile');
                          if (s) localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(s), avatar_url: '' }));
                        }}
                      />
                    ) : (
                      <div style={{ backgroundColor: avatarBg }} className="w-full h-full flex items-center justify-center font-black text-white text-xl">
                        {initials}
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-2xl bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-400 mb-1.5">Name</p>
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
                    <p className="text-base font-bold text-neutral-500">{name || '—'}</p>
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
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-400">Your preferences</p>
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
                  { label: 'Interests',        value: interests || '—',  editor: <input type="text" value={interests} onChange={e => setInterests(e.target.value)} placeholder="e.g. music, travel, cooking" className="text-sm font-semibold text-neutral-900 border border-stone-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-neutral-900 bg-stone-50 w-48" /> },
                ].map(({ label, value, editor }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                    <span className="text-xs font-semibold text-stone-400">{label}</span>
                    {editing ? editor : <span className="text-sm font-semibold text-neutral-500">{value}</span>}
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
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-stone-400">Weekly availability</p>
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
          <div className="bg-white border border-stone-200 rounded-2xl px-8 py-12 text-center space-y-3">
            <p className="font-serif font-black text-xl text-neutral-900">No profile yet</p>
            <p className="text-sm text-stone-500">Complete onboarding to set up your profile.</p>
            <button onClick={() => router.push('/onboarding')} className="mt-2 inline-block px-6 py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md">
              Get started
            </button>
          </div>
        )}

      </main>
    </AppShell>
    </>
  );
}
