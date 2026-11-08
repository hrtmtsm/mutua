'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Clock3, Sun, Moon } from 'lucide-react';
import { useLocale } from './LocaleProvider';

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

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  const { t } = useLocale();
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

  const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Clock3 }[] = [
    { value: 'auto',  label: t('theme.auto'),  Icon: Clock3 },
    { value: 'light', label: t('theme.light'), Icon: Sun },
    { value: 'night', label: t('theme.night'), Icon: Moon },
  ];
  const current = OPTIONS.find(o => o.value === preference) ?? OPTIONS[0];

  return (
    <div className="lang-picker theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="live-select lang-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('theme.switcherLabel')}
        title={t('theme.switcherTitle')}
        onClick={() => setOpen(value => !value)}
      >
        <current.Icon className="lang-picker-icon" aria-hidden="true" />
        {current.label}
        <span className="lang-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="lang-picker-menu locale-switcher-menu" role="listbox">
          {OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={preference === option.value}
              data-active={preference === option.value}
              className="lang-picker-option"
              onClick={() => { setPreference(option.value); setOpen(false); }}
            >
              <option.Icon className="lang-picker-icon" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
