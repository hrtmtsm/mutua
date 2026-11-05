// Site-wide interface language — separate from the native/learning language
// pair used for matching (see src/components/LanguagePicker.tsx + LANGUAGES
// in src/lib/types.ts). This is "what language the UI itself is written in."

export const LOCALES = ['ja', 'en', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'vi'] as const;
export type Locale = typeof LOCALES[number];

export const LOCALE_META: Record<Locale, { native: string; flagCode: string }> = {
  ja: { native: '日本語', flagCode: 'jp' },
  en: { native: 'English', flagCode: 'us' },
  ko: { native: '한국어', flagCode: 'kr' },
  zh: { native: '中文', flagCode: 'cn' },
  es: { native: 'Español', flagCode: 'es' },
  fr: { native: 'Français', flagCode: 'fr' },
  de: { native: 'Deutsch', flagCode: 'de' },
  pt: { native: 'Português', flagCode: 'pt' },
  vi: { native: 'Tiếng Việt', flagCode: 'vn' },
};

export const DEFAULT_LOCALE: Locale = 'ja';

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
