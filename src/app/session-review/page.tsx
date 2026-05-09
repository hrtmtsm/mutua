'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { LANG_AVATAR_COLOR } from '@/lib/constants';

const OPTIONS = [
  { id: 'technical',  label: 'Technical issues' },
  { id: 'topics',     label: 'Ran out of things to say' },
  { id: 'nervous',    label: 'Felt nervous' },
  { id: 'nothing',    label: 'Nothing, it was great!' },
];

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

function AvatarCircle({ name, lang, avatarUrl }: { name: string; lang: string; avatarUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const bg = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <div
      className="w-20 h-20 rounded-full border-4 border-white overflow-hidden flex items-center justify-center font-black text-white text-xl shrink-0"
      style={{ backgroundColor: bg }}
    >
      {avatarUrl && !failed
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
        : <span>{initials}</span>
      }
    </div>
  );
}

export default function SessionReviewPage() {
  const router = useRouter();
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [note,          setNote]          = useState('');
  const [duration,      setDuration]      = useState(0);
  const [partnerName,   setPartnerName]   = useState('your partner');
  const [matchId,       setMatchId]       = useState<string | null>(null);
  const [userId,        setUserId]        = useState<string | null>(null);
  const [partnerId,     setPartnerId]     = useState<string | null>(null);
  const [myAvatar,      setMyAvatar]      = useState<{ name: string; lang: string; url: string | null } | null>(null);
  const [partnerAvatar, setPartnerAvatar] = useState<{ name: string; lang: string; url: string | null } | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('mutua_last_session');
    const sid = localStorage.getItem('mutua_session_id');
    setUserId(sid);

    if (raw) {
      const { duration: d, partnerName: n, matchId: mid, partnerId: pid } = JSON.parse(raw);
      setDuration(d ?? 0);
      setPartnerName(n ?? 'your partner');
      setMatchId(mid ?? null);
      setPartnerId(pid ?? null);

      // Fetch both avatars
      if (sid && pid) {
        supabase
          .from('profiles')
          .select('session_id, name, avatar_url, native_language')
          .in('session_id', [sid, pid])
          .then(({ data }) => {
            if (!data) return;
            const me      = data.find(r => r.session_id === sid);
            const partner = data.find(r => r.session_id === pid);
            if (me)      setMyAvatar({ name: me.name ?? 'Me', lang: me.native_language ?? '', url: me.avatar_url ?? null });
            if (partner) setPartnerAvatar({ name: partner.name ?? n, lang: partner.native_language ?? '', url: partner.avatar_url ?? null });
          });
      }
    }
  }, []);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (id === 'nothing') return next.has('nothing') ? new Set() : new Set(['nothing']);
      next.delete('nothing');
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit(skipped: boolean) {
    if (!skipped) {
      track('session_feedback', {
        tags:          Array.from(selected),
        note:          note.trim(),
        partner_name:  partnerName,
        duration_secs: duration,
        match_id:      matchId,
      });
    }
    if (matchId && userId && partnerId) {
      fetch('/api/rematch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId, userId, partnerId }),
      }).catch(() => {});
    }
    router.replace('/app');
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col gap-7">

        {/* Avatars + duration */}
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Overlapping avatars */}
          <div className="flex items-center justify-center">
            <div className="z-10">
              {myAvatar
                ? <AvatarCircle name={myAvatar.name} lang={myAvatar.lang} avatarUrl={myAvatar.url} />
                : <div className="w-20 h-20 rounded-full border-4 border-white bg-stone-200" />
              }
            </div>
            <div className="-ml-5">
              {partnerAvatar
                ? <AvatarCircle name={partnerAvatar.name} lang={partnerAvatar.lang} avatarUrl={partnerAvatar.url} />
                : <div className="w-20 h-20 rounded-full border-4 border-white bg-stone-300" />
              }
            </div>
          </div>

          <div className="flex items-center gap-2">
            <img
              src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
              alt="🔥"
              className="w-10 h-10"
            />
            <p className="text-5xl font-black text-neutral-900">{formatDuration(duration)}</p>
          </div>
        </div>

        {/* Question */}
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xl font-bold text-neutral-900">How was this session?</p>
            <p className="text-sm text-stone-400 mt-1">Select all that apply</p>
          </div>

          <div className="flex flex-col gap-3">
            {OPTIONS.map(opt => {
              const active = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className={`w-full px-4 py-3.5 rounded-xl border text-sm font-medium text-left transition-colors ${
                    active
                      ? 'border-[#2B8FFF] bg-sky-50 text-[#2B8FFF]'
                      : 'bg-white border-stone-200 text-neutral-700 hover:border-[#2B8FFF]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything else you want to share? (optional)"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-neutral-700 placeholder:text-stone-400 resize-none focus:outline-none focus:border-[#2B8FFF]"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => submit(false)}
            className="w-full py-3.5 btn-primary text-white font-bold rounded-xl text-sm"
          >
            Done
          </button>
          <button
            onClick={() => submit(true)}
            className="w-full py-2 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            Skip
          </button>
        </div>

      </div>
    </div>
  );
}
