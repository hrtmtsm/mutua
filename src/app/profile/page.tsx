'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { LANGUAGES, GOALS, COMM_STYLES, FREQUENCY, type Language, type Goal, type CommStyle, type Frequency } from '@/lib/types';
import { LANG_FLAGS, LANG_AVATAR_COLOR, INTEREST_CATEGORIES, INTEREST_MIGRATION } from '@/lib/constants';
import { track } from '@/lib/analytics';
import { supabase, saveProfile } from '@/lib/supabase';
import type { UserAvailability } from '@/lib/supabase';
import AppShell from '@/components/AppShell';
import AvailabilityPicker from '@/components/AvailabilityPicker';
import { Pencil, Camera, ChevronDown } from 'lucide-react';


const CROP_SIZE = 260;

function CropModal({ src, onConfirm, onCancel }: { src: string; onConfirm: (blob: Blob) => void; onCancel: () => void }) {
  const imgRef       = useRef<HTMLImageElement>(null);
  const offsetRef    = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Only width is stored — height is always auto so browser keeps ratio
  const [imgWidth, setImgWidth] = useState(0);
  const imgWidthRef  = useRef(0);
  const naturalRef   = useRef({ w: 0, h: 0 });
  const dragging     = useRef(false);
  const lastPos      = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);

  // Derive height from width + natural ratio (never set it on the element)
  const renderedH = () => {
    const { w, h } = naturalRef.current;
    return w > 0 ? imgWidthRef.current * (h / w) : 0;
  };

  const clampOff = (ox: number, oy: number, w: number, h: number) => ({
    x: Math.min(0, Math.max(CROP_SIZE - w, ox)),
    y: Math.min(0, Math.max(CROP_SIZE - h, oy)),
  });

  const applyWidth = (newW: number) => {
    const { w: nw, h: nh } = naturalRef.current;
    if (!nw || !nh) return;
    const minW = CROP_SIZE * Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    const clamped = Math.max(minW, Math.min(newW, minW * 4));
    imgWidthRef.current = clamped;
    setImgWidth(clamped);
    const h = clamped * (nh / nw);
    const next = clampOff(offsetRef.current.x, offsetRef.current.y, clamped, h);
    offsetRef.current = next;
    setOffset(next);
  };

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth: nw, naturalHeight: nh } = img;
    naturalRef.current = { w: nw, h: nh };
    const base = Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    const w = nw * base;
    const h = nh * base;
    imgWidthRef.current = w;
    setImgWidth(w);
    const start = clampOff((CROP_SIZE - w) / 2, (CROP_SIZE - h) / 2, w, h);
    offsetRef.current = start;
    setOffset(start);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (pinchDistRef.current !== null && d > 0) {
          applyWidth(imgWidthRef.current * (d / pinchDistRef.current));
        }
        pinchDistRef.current = d;
        return;
      }
      if (!dragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const dx = clientX - lastPos.current.x;
      const dy = clientY - lastPos.current.y;
      lastPos.current = { x: clientX, y: clientY };
      const h = renderedH();
      const next = clampOff(offsetRef.current.x + dx, offsetRef.current.y + dy, imgWidthRef.current, h);
      offsetRef.current = next;
      setOffset({ ...next });
    };
    const onUp = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length < 2) pinchDistRef.current = null;
      dragging.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyWidth(imgWidthRef.current * (e.deltaY < 0 ? 1.1 : 0.9));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('wheel', onWheel);
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
    // Use the actual rendered image element dimensions for the canvas draw
    const img = imgRef.current!;
    ctx.drawImage(img, offsetRef.current.x, offsetRef.current.y, img.width, img.height);
    canvas.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-stone-100">
          <p className="text-sm font-semibold text-neutral-900">Crop photo</p>
          <p className="text-xs text-stone-400 mt-0.5">Drag to reposition · pinch or scroll to zoom</p>
        </div>

        <div className="flex justify-center py-6">
          <div
            className="relative overflow-hidden rounded-full select-none"
            style={{ width: CROP_SIZE, height: CROP_SIZE, cursor: 'grab', touchAction: 'none' }}
            onMouseDown={e => startDrag(e.clientX, e.clientY)}
            onTouchStart={e => {
              if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onLoad}
              draggable={false}
              style={{ position: 'absolute', left: offset.x, top: offset.y, width: imgWidth, height: 'auto', pointerEvents: 'none', userSelect: 'none' }}
            />
          </div>
        </div>

        {/* Zoom slider */}
        <div className="px-5 pb-2">
          <input
            type="range"
            min={0}
            max={100}
            value={(() => {
              const { w: nw, h: nh } = naturalRef.current;
              if (!nw) return 0;
              const minW = CROP_SIZE * Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
              return Math.round(((imgWidth - minW) / (minW * 3)) * 100);
            })()}
            onChange={e => {
              const { w: nw, h: nh } = naturalRef.current;
              if (!nw) return;
              const minW = CROP_SIZE * Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
              applyWidth(minW + minW * 3 * (Number(e.target.value) / 100));
            }}
            className="w-full accent-neutral-900"
          />
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
  const [interests, setInterests] = useState<string[]>([]);
  const [bio,       setBio]       = useState('');

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
      if (p.bio) setBio(p.bio);
      if (p.interests) {
        const allTags = INTEREST_CATEGORIES.flatMap(c => c.tags);
        const normalized = p.interests
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((s: string) => {
            const exact = allTags.find(t => t.toLowerCase() === s.toLowerCase());
            if (exact) return exact;
            const migrationKey = Object.keys(INTEREST_MIGRATION).find(k => k.toLowerCase() === s.toLowerCase());
            return migrationKey ? INTEREST_MIGRATION[migrationKey] : null;
          })
          .filter(Boolean) as string[];
        const deduped = [...new Set(normalized)].slice(0, 5);
        setInterests(deduped);
        // Write normalized value back to localStorage so loadMatch reads clean data
        const stored = localStorage.getItem('mutua_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.interests = deduped.join(', ');
          localStorage.setItem('mutua_profile', JSON.stringify(parsed));
        }
      }
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

  const [uploadError, setUploadError] = useState('');

  const handleCropConfirm = async (blob: Blob) => {
    if (!profile) return;
    setCropSrc(null);
    setUploadError('');

    // Show immediately via object URL
    const localUrl = URL.createObjectURL(blob);
    setAvatarUrl(localUrl);

    setUploading(true);
    const formData = new FormData();
    formData.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    formData.append('sessionId', profile.session_id);

    const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setAvatarUrl(url);
      const stored = localStorage.getItem('mutua_profile');
      if (stored) localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(stored), avatar_url: url }));
      // Notify nav to refresh avatar
      window.dispatchEvent(new Event('mutua:profile-updated'));
    } else {
      const body = await res.json().catch(() => ({}));
      setUploadError(body.error ?? 'Upload failed. Try again.');
      setAvatarUrl(avatarUrl); // revert to previous
    }
    setUploading(false);
  };

  const handleSaveIdentity = async () => {
    if (!profile || !draftName.trim()) return;
    setSaving(true);
    const trimmed = draftName.trim();
    const bioTrimmed = bio.trim();
    await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: profile.session_id, name: trimmed, bio: bioTrimmed }),
    });
    const stored = localStorage.getItem('mutua_profile');
    if (stored) localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(stored), name: trimmed, bio: bioTrimmed || undefined }));
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
      interests:          interests.length ? interests.join(', ') : undefined,
      bio:                bio.trim() || undefined,
    };
    localStorage.setItem('mutua_profile', JSON.stringify(updated));
    setProfile(updated);
    try { await saveProfile(updated); } catch { /* offline */ }
    track('profile_updated', { has_bio: !!bio.trim(), interests_count: interests.length });
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

        <h1 className="font-serif font-semibold text-2xl text-[#171717]">Profile</h1>

        {profile ? (
          <>
            {/* ── Identity card ── */}
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">

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
                          // Clear state so initials show; also wipe stale blob URLs from localStorage
                          setAvatarUrl('');
                          if (avatarUrl.startsWith('blob:')) {
                            const s = localStorage.getItem('mutua_profile');
                            if (s) localStorage.setItem('mutua_profile', JSON.stringify({ ...JSON.parse(s), avatar_url: '' }));
                          }
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
                  {uploadError && <p className="text-xs text-rose-500 mb-1.5">{uploadError}</p>}
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

              {/* About me */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-400">About me</p>
                  {editingIdentity && <span className="text-xs text-stone-400">{bio.length}/150</span>}
                </div>
                {editingIdentity ? (
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 150))}
                    placeholder="Tell your partner a bit about yourself..."
                    rows={3}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm text-neutral-900 placeholder:text-stone-300 focus:outline-none focus:border-neutral-400 transition-all resize-none leading-relaxed"
                  />
                ) : (
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    {bio || <span className="text-stone-300">Not set</span>}
                  </p>
                )}
              </div>

              {editingIdentity && (
                <button onClick={handleSaveIdentity} disabled={saving} className="w-full py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              )}

            </div>

            {/* ── Preferences card ── */}
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">

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
                ].map(({ label, value, editor }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                    <span className="text-xs font-semibold text-stone-400">{label}</span>
                    {editing ? editor : <span className="text-sm font-semibold text-neutral-500">{value}</span>}
                  </div>
                ))}
              </div>

              {/* Interests tag picker */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-400">Interests</span>
                  <span className="text-xs text-stone-400">{editing ? `${interests.length}/5` : interests.length > 0 ? `${interests.length} selected` : ''}</span>
                </div>
                {editing ? (
                  <div className="space-y-3">
                    {INTEREST_CATEGORIES.map(cat => (
                      <div key={cat.label}>
                        <p className="text-xs text-stone-400 mb-1.5">{cat.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.tags.map(tag => {
                            const selected = interests.includes(tag);
                            const maxed = interests.length >= 5 && !selected;
                            return (
                              <button
                                key={tag}
                                type="button"
                                disabled={maxed}
                                onClick={() => setInterests(prev =>
                                  selected ? prev.filter(t => t !== tag) : [...prev, tag]
                                )}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                  selected
                                    ? 'bg-neutral-900 text-white'
                                    : maxed
                                    ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {interests.length > 0
                      ? interests.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-stone-100 text-xs font-medium text-stone-500 rounded-full">{tag}</span>
                        ))
                      : <span className="text-sm text-stone-400">—</span>
                    }
                  </div>
                )}
              </div>

              {editing && (
                <button onClick={handleSavePrefs} disabled={saving} className="w-full py-2.5 btn-primary text-white font-bold text-sm rounded-full shadow-md disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              )}

            </div>

            {/* ── Availability card ── */}
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
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
          <div className="bg-white rounded-2xl shadow-sm px-8 py-12 text-center space-y-3">
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
