'use client';

import { useLocale } from './LocaleProvider';
import { LOCALES, LOCALE_META, type Locale } from '@/lib/i18n/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import './liveExchange.css';

export default function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <DropdownMenu>
      {/* Keeps the exact wrapper/trigger/content nesting the CSS
          (liveExchange.css's .locale-switcher, sky.css's
          .study-header-controls .locale-switcher quiet-style override)
          already matches on — Content must stay inside this wrapper too,
          not just a DropdownMenu sibling of it, or those selectors miss it. */}
      <span className={`lang-picker locale-switcher ${className}`}>
        <DropdownMenuTrigger className="live-select lang-picker-trigger" aria-label={t('locale.switcherLabel')}>
          <span className={`fi fi-${LOCALE_META[locale].flagCode} lang-picker-flag`} aria-hidden="true" />
          {LOCALE_META[locale].native}
          <span className="lang-picker-caret" aria-hidden="true">▾</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="locale-switcher-menu">
          <DropdownMenuRadioGroup value={locale} onValueChange={next => setLocale(next as Locale)}>
            {LOCALES.map(code => (
              <DropdownMenuRadioItem key={code} value={code}>
                <span className={`fi fi-${LOCALE_META[code].flagCode} lang-picker-flag`} aria-hidden="true" />
                {LOCALE_META[code].native}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </span>
    </DropdownMenu>
  );
}
