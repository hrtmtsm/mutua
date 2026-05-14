'use client';

import { useState, useEffect } from 'react';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';

function usePartnerLocalTime(timezone: string | undefined) {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    if (!timezone) { setDisplay(''); return; }
    const update = () => {
      try {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
        const abbr = now.toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone: timezone }).split(' ').pop() ?? '';
        setDisplay(`${abbr} · ${time}`);
      } catch {
        setDisplay('');
      }
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [timezone]);
  return display;
}

export interface PartnerCardData {
  name:            string;
  nativeLang:      string;
  learningLang:    string;
  avatarUrl:       string | null;
  bio?:            string;
  goal:            string;
  commStyle:       string;
  frequency:       string;
  sharedInterests: string[];
  timezone?:       string;
}

export function Avatar({
  name, lang, avatarUrl, size = 'md',
}: {
  name: string; lang: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg';
}) {
  const bg  = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const cls = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'sm' ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base';
  const [imgFailed, setImgFailed] = useState(false);
  const initials = (() => {
    const p = name.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.trim().slice(0, 2)).toUpperCase();
  })();
  return (
    <div style={{ backgroundColor: bg }} className={`${cls} rounded-full flex items-center justify-center font-black text-white shrink-0 overflow-hidden relative`}>
      <span className="select-none">{initials}</span>
      {avatarUrl && !imgFailed && (
        <img src={avatarUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgFailed(true)} />
      )}
    </div>
  );
}

/**
 * Reusable card shell: identity block + bio + "In common" chips + action slot.
 * Pass action buttons as `children`.
 */
export function PartnerCardShell({
  partner,
  onViewProfile,
  topRight,
  children,
}: {
  partner:       PartnerCardData;
  onViewProfile?: () => void;
  topRight?:     React.ReactNode;
  children?:     React.ReactNode;
}) {
  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';
  const localTime    = usePartnerLocalTime(partner.timezone);
  const pills = [partner.goal, partner.commStyle, partner.frequency, ...partner.sharedInterests]
    .filter(Boolean).slice(0, 4);

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-stone-200">

      {/* Identity */}
      <div className="px-7 pt-6 pb-0 flex items-center gap-4">
        <button onClick={onViewProfile} className="shrink-0" type="button">
          <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} size="lg" />
        </button>
        <button onClick={onViewProfile} className="flex-1 min-w-0 text-left" type="button">
          <p className="font-serif font-bold text-[#171717] text-2xl leading-tight truncate">{partner.name}</p>
          {localTime && (
            <p className="text-xs text-stone-400 mt-0.5">{localTime}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-400 min-w-0">
            <span className="truncate">{nativeFlag} {partner.nativeLang}</span>
            <span className="shrink-0">↔</span>
            <span className="truncate">{learningFlag} {partner.learningLang}</span>
          </div>
        </button>
        {topRight && <div className="relative shrink-0 self-start">{topRight}</div>}
      </div>

      {/* Bio */}
      {partner.bio && (
        <div className="px-7 mt-4">
          <p className="text-sm text-neutral-700 leading-relaxed">{partner.bio}</p>
        </div>
      )}

      {/* In common chips */}
      {pills.length > 0 && (
        <div className="px-7 mt-4">
          <p className="text-xs text-stone-400 font-medium mb-2">In common</p>
          <div className="flex flex-wrap gap-1.5">
            {pills.map((v, i) => (
              <span key={i} className="px-3 py-1 bg-stone-100 text-sm font-medium text-stone-600 rounded-full">{v}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action slot */}
      {children && (
        <div className="px-7 mt-6 pb-7">
          {children}
        </div>
      )}
    </div>
  );
}
