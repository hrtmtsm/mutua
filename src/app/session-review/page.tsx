'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import { supabase, isConfigured } from '@/lib/supabase';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { useLocale } from '@/components/LocaleProvider';
import type { DictionaryKey } from '@/lib/i18n/dictionary';

const OPTIONS: { id: string; labelKey: DictionaryKey }[] = [
  { id: 'technical',  labelKey: 'sessionReview.optionTechnical' },
  { id: 'topics',     labelKey: 'sessionReview.optionTopics' },
  { id: 'no_practice', labelKey: 'sessionReview.optionNoPractice' },
  { id: 'no_show',    labelKey: 'sessionReview.optionNoShow' },
  { id: 'nothing',    labelKey: 'sessionReview.optionNothing' },
];

const NO_SHOW_THRESHOLD = 120; // seconds

function formatDuration(s: number, t: (key: DictionaryKey) => string) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return t('sessionReview.durationSecOnly').replace('{s}', String(sec));
  if (sec === 0) return t('sessionReview.durationMinOnly').replace('{m}', String(m));
  return t('sessionReview.durationMinSec').replace('{m}', String(m)).replace('{s}', String(sec));
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
  const { t } = useLocale();
  const router = useRouter();
  const [selected,      setSelected]      = useState<string | null>(null);
  const [note,          setNote]          = useState('');
  const [duration,      setDuration]      = useState(0);
  const [partnerName,   setPartnerName]   = useState(t('sessionReview.yourPartnerFallback'));
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
      setPartnerName(n ?? t('sessionReview.yourPartnerFallback'));
      setMatchId(mid ?? null);
      setPartnerId(pid ?? null);

      // Fetch both avatars
      if (sid && pid) {
        supabase
          .from('public_profile_cards')
          .select('session_id, name, avatar_url, native_language')
          .in('session_id', [sid, pid])
          .then(({ data }) => {
            if (!data) return;
            const me      = data.find(r => r.session_id === sid);
            const partner = data.find(r => r.session_id === pid);
            if (me)      setMyAvatar({ name: me.name ?? t('sessionReview.meFallback'), lang: me.native_language ?? '', url: me.avatar_url ?? null });
            if (partner) setPartnerAvatar({ name: partner.name ?? n, lang: partner.native_language ?? '', url: partner.avatar_url ?? null });
          });
      }
    }
  }, []);

  function toggle(id: string) {
    setSelected(prev => prev === id ? null : id);
  }

  function submit(skipped: boolean) {
    if (!skipped) {
      track('session_feedback', {
        tag:           selected,
        note:          note.trim(),
        partner_name:  partnerName,
        duration_secs: duration,
        match_id:      matchId,
      });
      if (isConfigured && userId) {
        supabase.from('session_feedback').insert({
          match_id:      matchId,
          user_id:       userId,
          partner_id:    partnerId,
          tag:           selected,
          note:          note.trim() || null,
          duration_secs: duration,
        }).then(() => {});
      }
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

          <div className="flex items-center gap-1.5">
            <img
              src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif"
              alt="🔥"
              className="w-6 h-6"
            />
            <p className="text-2xl font-black text-neutral-900">{formatDuration(duration, t)}</p>
          </div>
        </div>

        {/* Question */}
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xl font-bold text-neutral-900">{t('sessionReview.heading')}</p>
          </div>

          <div className="flex flex-col gap-3">
            {OPTIONS.filter(opt => opt.id !== 'no_show' || duration < NO_SHOW_THRESHOLD).map(opt => {
              const active = selected === opt.id;
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
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('sessionReview.notePlaceholder')}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-neutral-700 placeholder:text-stone-400 resize-none focus:outline-none focus:border-[#2B8FFF]"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => submit(false)}
            disabled={!selected && !note.trim()}
            className="w-full py-3.5 btn-primary text-white font-bold rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('sessionReview.submit')}
          </button>
          <button
            onClick={() => submit(true)}
            className="w-full py-2 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            {t('sessionReview.skip')}
          </button>
        </div>

      </div>
    </div>
  );
}
