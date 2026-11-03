'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from './LocaleProvider';
import { LOCALES, LOCALE_META } from '@/lib/i18n/locale';
import './liveExchange.css';

export default function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`lang-picker locale-switcher ${className}`} ref={rootRef}>
      <button
        type="button"
        className="live-select lang-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('locale.switcherLabel')}
        onClick={() => setOpen(value => !value)}
      >
        <span className={`fi fi-${LOCALE_META[locale].flagCode} lang-picker-flag`} aria-hidden="true" />
        {LOCALE_META[locale].native}
        <span className="lang-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lang-picker-menu locale-switcher-menu" role="listbox">
          {LOCALES.map(code => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={locale === code}
              data-active={locale === code}
              className="lang-picker-option"
              onClick={() => { setLocale(code); setOpen(false); }}
            >
              <span className={`fi fi-${LOCALE_META[code].flagCode} lang-picker-flag`} aria-hidden="true" />
              {LOCALE_META[code].native}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
