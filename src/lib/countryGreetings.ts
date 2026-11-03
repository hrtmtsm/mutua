// A representative local greeting; multilingual countries may have several official languages.
const GREETINGS: Record<string, { text: string; lang: string }> = {
  '🇯🇵': { text: 'こんにちは！', lang: 'ja' }, '🇺🇸': { text: 'Hello!', lang: 'en' },
  '🇬🇧': { text: 'Hello!', lang: 'en' }, '🇦🇺': { text: "G’day!", lang: 'en' },
  '🇨🇦': { text: 'Hello!', lang: 'en' }, '🇳🇿': { text: 'Kia ora!', lang: 'mi' },
  '🇲🇽': { text: '¡Hola!', lang: 'es' }, '🇪🇸': { text: '¡Hola!', lang: 'es' },
  '🇦🇷': { text: '¡Hola!', lang: 'es' }, '🇨🇴': { text: '¡Hola!', lang: 'es' },
  '🇧🇷': { text: 'Olá!', lang: 'pt' }, '🇵🇹': { text: 'Olá!', lang: 'pt' },
  '🇫🇷': { text: 'Bonjour !', lang: 'fr' }, '🇩🇪': { text: 'Hallo!', lang: 'de' },
  '🇦🇹': { text: 'Hallo!', lang: 'de' }, '🇨🇭': { text: 'Grüezi!', lang: 'de-CH' },
  '🇮🇹': { text: 'Ciao!', lang: 'it' }, '🇸🇦': { text: 'مرحبًا!', lang: 'ar' },
  '🇦🇪': { text: 'مرحبًا!', lang: 'ar' }, '🇪🇬': { text: 'مرحبًا!', lang: 'ar' },
  '🇮🇳': { text: 'नमस्ते!', lang: 'hi' }, '🇨🇳': { text: '你好！', lang: 'zh' },
  '🇹🇼': { text: '你好！', lang: 'zh-Hant' }, '🇰🇷': { text: '안녕하세요!', lang: 'ko' },
  '🇮🇩': { text: 'Halo!', lang: 'id' }, '🇹🇭': { text: 'สวัสดี!', lang: 'th' },
  '🇻🇳': { text: 'Xin chào!', lang: 'vi' }, '🇵🇭': { text: 'Kumusta!', lang: 'tl' },
  '🇹🇷': { text: 'Merhaba!', lang: 'tr' }, '🇷🇺': { text: 'Привет!', lang: 'ru' },
  '🇳🇱': { text: 'Hallo!', lang: 'nl' }, '🇸🇪': { text: 'Hej!', lang: 'sv' },
  '🇵🇱': { text: 'Cześć!', lang: 'pl' }, '🇰🇪': { text: 'Jambo!', lang: 'sw' },
};
export function countryGreeting(flag: string) {
  return GREETINGS[flag] ?? { text: 'Hello!', lang: 'en' };
}
