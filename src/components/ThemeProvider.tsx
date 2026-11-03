'use client';

import { createContext, useContext, useEffect, useState } from 'react';

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
  return <select aria-label="表示モード" title="自動: 7:00〜19:00はライト、それ以外はナイト"
    value={preference} onChange={e => setPreference(e.target.value as ThemePreference)}
    className="theme-switcher rounded-full border px-2 py-1.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
    <option value="auto">◐ 自動</option><option value="light">☀ ライト</option><option value="night">☾ ナイト</option>
  </select>;
}
