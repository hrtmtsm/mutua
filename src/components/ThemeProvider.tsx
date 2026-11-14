'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import './liveExchange.css';
import { Clock3, Sun, Moon } from 'lucide-react';
import { useLocale } from './LocaleProvider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';

export type ThemePreference = 'auto' | 'light' | 'night';
export function localTheme(hour: number): 'light' | 'night' {
  return hour >= 7 && hour < 19 ? 'light' : 'night';
}
const ThemeContext = createContext({
  theme: 'night' as 'light' | 'night',
  preference: 'auto' as ThemePreference,
  setPreference: (_value: ThemePreference) => {},
});
export const useTheme = () => useContext(ThemeContext);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('auto');
  const [theme, setTheme] = useState<'light' | 'night'>('night');
  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem('yonder-theme');
        return stored === 'light' || stored === 'night' ? stored : 'auto';
      } catch { return 'auto'; }
    };
    const apply = () => {
      const preference = read();
      const resolved = preference === 'auto' ? localTheme(new Date().getHours()) : preference;
      setPreferenceState(preference);
      setTheme(resolved);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved === 'night' ? 'dark' : 'light';
    };
    apply();
    const interval = window.setInterval(apply, 30000);
    window.addEventListener('storage', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('yonder:theme', apply);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', apply);
      window.removeEventListener('focus', apply);
      window.removeEventListener('yonder:theme', apply);
    };
  }, []);
  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    const resolved = value === 'auto' ? localTheme(new Date().getHours()) : value;
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved === 'night' ? 'dark' : 'light';
    try { localStorage.setItem('yonder-theme', value); } catch { /* session-only preference */ }
    window.dispatchEvent(new Event('yonder:theme'));
  };
  return <ThemeContext.Provider value={{ theme, preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitcher({ compact }: { compact?: boolean | null } = {}) {
  const { preference, setPreference } = useTheme();
  const { t } = useLocale();

  const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Clock3 }[] = [
    { value: 'auto',  label: t('theme.auto'),  Icon: Clock3 },
    { value: 'light', label: t('theme.light'), Icon: Sun },
    { value: 'night', label: t('theme.night'), Icon: Moon },
  ];
  const current = OPTIONS.find(o => o.value === preference) ?? OPTIONS[0];

  return (
    <DropdownMenu>
      <span className="lang-picker theme-switcher">
        <DropdownMenuTrigger
          className={`live-select lang-picker-trigger whitespace-nowrap ${compact === false ? "" : compact === true ? "md:!w-11 md:justify-center md:!px-0" : compact === null ? "md:max-xl:!w-11 md:max-xl:justify-center md:max-xl:!px-0" : ""}`}
          aria-label={t('theme.switcherLabel')}
          title={t('theme.switcherTitle')}
        >
          <current.Icon className="lang-picker-icon" aria-hidden="true" />
          <span className={compact === true ? 'md:hidden' : compact === null ? 'md:max-xl:hidden' : undefined}>{current.label}</span>
          <span className={`lang-picker-caret ${compact === true ? "md:!hidden" : compact === null ? "md:max-xl:!hidden" : ""}`} aria-hidden="true">▾</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="locale-switcher-menu">
          <DropdownMenuRadioGroup value={preference} onValueChange={next => setPreference(next as ThemePreference)}>
            {OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <option.Icon className="lang-picker-icon" aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </span>
    </DropdownMenu>
  );
}
