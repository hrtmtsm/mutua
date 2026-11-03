import { LANG_AVATAR_COLOR } from '@/lib/constants';

// Shared mock data for the instant-call experience — used by the dev-only
// globe prototype AND the mock mode of the real /app integration. No DB/API
// involved; this is purely local fixture data.

export interface MockUser {
  id:                string;
  name:              string;
  nativeLanguage:    string;
  learningLanguage:  string;
  countryFlag:       string;
  bio:               string;
  sharedInterests:   string[];
  lat:               number;
  lon:               number;
}

export function avatarColorFor(nativeLanguage: string) {
  return LANG_AVATAR_COLOR[nativeLanguage] ?? '#2b8fff';
}

export const AI_PARTNER = {
  name: 'AI パートナー',
  bio: '言語学習のためのAI会話相手です。',
  avatarColor: '#64748b',
};

// A small flavor-text pool reused across the "filler" mock users below, so the
// cluster feels lively without hand-writing dozens of unique bios.
const FLAVOR: { bio: string; interests: string[] }[] = [
  { bio: 'Likes slow, easy conversations about daily life.', interests: ['Travel', 'Cafés'] },
  { bio: '週末はもっぱら映画かゲーム。', interests: ['Gaming', 'Movies & TV'] },
  { bio: 'Student, free most evenings.', interests: ['Reading', 'Music'] },
  { bio: '料理とカフェ巡りが好きです。', interests: ['Cooking', 'Cafés'] },
  { bio: 'New to language exchange, be nice!', interests: ['Culture', 'Travel'] },
  { bio: 'Into anime, games, and casual chats.', interests: ['Anime & manga', 'Gaming'] },
];

const DETAILED_USERS: MockUser[] = [
  { id: 'u1', name: 'Mika',  nativeLanguage: 'Japanese',   learningLanguage: 'English',  countryFlag: '🇯🇵', bio: '東京でカフェ巡りをしています。映画も好き。', sharedInterests: ['Cafés', 'Movies & TV'], lat: 36, lon: 138 },
  { id: 'u2', name: 'Liam',  nativeLanguage: 'English',    learningLanguage: 'Japanese', countryFlag: '🇺🇸', bio: 'Trying to get better at casual Japanese before a trip.', sharedInterests: ['Travel', 'Gaming'], lat: 38, lon: -97 },
  { id: 'u3', name: 'Sofia', nativeLanguage: 'Portuguese', learningLanguage: 'English',  countryFlag: '🇧🇷', bio: 'Music producer, always up for a chat about anything.', sharedInterests: ['Music', 'Travel'], lat: -15, lon: -48 },
  { id: 'u4', name: 'Noor',  nativeLanguage: 'Arabic',     learningLanguage: 'English',  countryFlag: '🇸🇦', bio: 'Studying abroad soon, want to practice daily conversation.', sharedInterests: ['Reading', 'Culture'], lat: 24, lon: 45 },
  { id: 'u5', name: 'Chloé', nativeLanguage: 'French',     learningLanguage: 'English',  countryFlag: '🇫🇷', bio: 'Pâtissière. Let’s talk about food and travel.', sharedInterests: ['Cooking', 'Travel'], lat: 47, lon: 3 },
  { id: 'u6', name: 'Wei',   nativeLanguage: 'Mandarin',   learningLanguage: 'Japanese', countryFlag: '🇨🇳', bio: 'Anime fan, learning Japanese to read manga untranslated.', sharedInterests: ['Anime & manga', 'Gaming'], lat: 35, lon: 105 },
  { id: 'u7', name: 'Priya', nativeLanguage: 'Hindi',      learningLanguage: 'English',  countryFlag: '🇮🇳', bio: 'Yoga instructor, enjoys slow and easy conversations.', sharedInterests: ['Yoga', 'Reading'], lat: 22, lon: 79 },
];

// Lightweight filler users — hand-placed with small lat/lon jitter around the
// same hubs so several avatars naturally cluster together, like the reference.
const FILLER_SEED: { name: string; nativeLanguage: string; learningLanguage: string; flag: string; lat: number; lon: number }[] = [
  { name: 'Kenji',  nativeLanguage: 'Japanese',   learningLanguage: 'English',    flag: '🇯🇵', lat: 34, lon: 133 },
  { name: 'Yuna',    nativeLanguage: 'Korean',     learningLanguage: 'English',    flag: '🇰🇷', lat: 37, lon: 127 },
  { name: 'Jiho',    nativeLanguage: 'Korean',     learningLanguage: 'Japanese',   flag: '🇰🇷', lat: 36, lon: 129 },
  { name: 'Mei',     nativeLanguage: 'Mandarin',   learningLanguage: 'English',    flag: '🇨🇳', lat: 31, lon: 121 },
  { name: 'Dewi',    nativeLanguage: 'Indonesian', learningLanguage: 'English',    flag: '🇮🇩', lat: -6,  lon: 107 },
  { name: 'Arjun',   nativeLanguage: 'Hindi',      learningLanguage: 'English',    flag: '🇮🇳', lat: 19,  lon: 73 },
  { name: 'Emma',    nativeLanguage: 'English',    learningLanguage: 'French',     flag: '🇺🇸', lat: 41,  lon: -74 },
  { name: 'Mateo',   nativeLanguage: 'Spanish',    learningLanguage: 'English',    flag: '🇲🇽', lat: 19,  lon: -99 },
  { name: 'Valentina', nativeLanguage: 'Spanish',  learningLanguage: 'English',    flag: '🇲🇽', lat: 20,  lon: -103 },
  { name: 'Lucas',   nativeLanguage: 'Portuguese', learningLanguage: 'English',    flag: '🇧🇷', lat: -23, lon: -46 },
  { name: 'Hannah',  nativeLanguage: 'German',     learningLanguage: 'English',    flag: '🇩🇪', lat: 52,  lon: 13 },
  { name: 'Oliver',  nativeLanguage: 'English',    learningLanguage: 'German',     flag: '🇬🇧', lat: 51,  lon: 0 },
  { name: 'Giulia',  nativeLanguage: 'Italian',    learningLanguage: 'English',    flag: '🇮🇹', lat: 45,  lon: 9 },
  { name: 'Mehmet',  nativeLanguage: 'Turkish',    learningLanguage: 'English',    flag: '🇹🇷', lat: 41,  lon: 29 },
  { name: 'Aiko',    nativeLanguage: 'Japanese',   learningLanguage: 'Korean',     flag: '🇯🇵', lat: 35,  lon: 136 },
  { name: 'Ngozi',   nativeLanguage: 'English',    learningLanguage: 'French',     flag: '🇳🇬', lat: 6,   lon: 3 },
  { name: 'Amara',   nativeLanguage: 'Swahili',    learningLanguage: 'English',    flag: '🇰🇪', lat: -1,  lon: 37 },
  { name: 'Linh',    nativeLanguage: 'Vietnamese', learningLanguage: 'English',    flag: '🇻🇳', lat: 21,  lon: 106 },
  { name: 'Nok',     nativeLanguage: 'Thai',       learningLanguage: 'English',    flag: '🇹🇭', lat: 14,  lon: 101 },
];

const FILLER_USERS: MockUser[] = FILLER_SEED.map((u, i) => {
  const f = FLAVOR[i % FLAVOR.length];
  return {
    id: `f${i + 1}`,
    name: u.name,
    nativeLanguage: u.nativeLanguage,
    learningLanguage: u.learningLanguage,
    countryFlag: u.flag,
    bio: f.bio,
    sharedInterests: f.interests,
    lat: u.lat,
    lon: u.lon,
  };
});

export const MOCK_USERS: MockUser[] = [...DETAILED_USERS, ...FILLER_USERS];
