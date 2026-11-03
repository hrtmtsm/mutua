'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { DICTIONARIES, type DictionaryKey } from '@/lib/i18n/dictionary';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locale';

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE as Locale,
  setLocale: (_value: Locale) => {},
  t: (key: DictionaryKey) => DICTIONARIES[DEFAULT_LOCALE][key],
});

export const useLocale = () => useContext(LocaleContext);

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('yonder-locale');
      if (isLocale(stored)) { setLocaleState(stored); document.documentElement.lang = stored; return; }
    } catch { /* localStorage unavailable — stay on the default locale */ }
    document.documentElement.lang = DEFAULT_LOCALE;
  }, []);

  const setLocale = (value: Locale) => {
    setLocaleState(value);
    document.documentElement.lang = value;
    try { localStorage.setItem('yonder-locale', value); } catch { /* session-only preference */ }
  };

  const t = (key: DictionaryKey) => DICTIONARIES[locale][key] ?? DICTIONARIES[DEFAULT_LOCALE][key];

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}
