export const GOAL_DETAILS: Record<string, string> = {
  'Casual conversation': 'Low-pressure chats about everyday life',
  'Travel':              'Practical language for getting around',
  'Work / professional': 'Formal vocabulary and professional settings',
  'Cultural exchange':   'Share perspectives, traditions, and ways of life',
  'Making friends':      'Natural conversation and genuine connection',
};

export const COMM_STYLE_DETAILS: Record<string, string> = {
  'Voice call': 'Audio only — full focus on speaking and listening',
  'Video call': 'Face-to-face with full non-verbal context',
  'Text first': 'Start with messages before moving to voice',
};

export const AVAILABILITY_DETAILS: Record<string, string> = {
  'Weekday mornings': 'Before noon, Monday to Friday',
  'Weekday evenings': 'After 5pm, Monday to Friday',
  'Weekends':         'Saturday or Sunday, any time',
  'Flexible':         'Open to different times — easy to coordinate',
};

// deprecated: AVAILABILITY_DETAILS kept for legacy display only
export const FREQUENCY_DETAILS: Record<string, string> = {
  'Once a week':       'One focused session per week',
  '2–3 times a week':  'Regular practice with a consistent partner',
  'Every day':         'High commitment — daily short or long sessions',
  'No fixed schedule': 'Practice when it works for both of you',
};

export const INTEREST_CATEGORIES: { label: string; tags: string[] }[] = [
  { label: 'Music & Arts',      tags: ['Music', 'Live music', 'Singing', 'Photography', 'Art & design'] },
  { label: 'Sports & Fitness',  tags: ['Sports', 'Gym & fitness', 'Running', 'Hiking', 'Yoga'] },
  { label: 'Gaming & Anime',    tags: ['Gaming', 'Anime & manga', 'Board games', 'Esports'] },
  { label: 'Food & Drink',      tags: ['Cooking', 'Baking', 'Cafés', 'Trying new food', 'Drinks'] },
  { label: 'Film & Media',      tags: ['Movies & TV', 'Documentaries', 'Podcasts'] },
  { label: 'Travel & Culture',  tags: ['Travel', 'Solo travel', 'Culture', 'Languages'] },
  { label: 'Reading & Learning',tags: ['Reading', 'Tech', 'Psychology', 'Writing', 'Philosophy'] },
];

// Migration map: old persisted tag → new canonical tag
export const INTEREST_MIGRATION: Record<string, string> = {
  'Guitar':           'Music',
  'Piano':            'Music',
  'Drawing':          'Art & design',
  'Dance':            'Music',
  'Soccer':           'Sports',
  'Basketball':       'Sports',
  'Tennis':           'Sports',
  'Swimming':         'Sports',
  'Cycling':          'Sports',
  'Gym':              'Gym & fitness',
  'Video games':      'Gaming',
  'Anime':            'Anime & manga',
  'Manga':            'Anime & manga',
  'Coffee':           'Cafés',
  'Tea':              'Cafés',
  'Street food':      'Trying new food',
  'Movies':           'Movies & TV',
  'TV shows':         'Movies & TV',
  'K-drama':          'Movies & TV',
  'History':          'Culture',
  'Culture exchange': 'Culture',
  'Books':            'Reading',
  'Science':          'Tech',
};

export const LANG_FLAGS: Record<string, string> = {
  English:    '🇺🇸',
  Japanese:   '🇯🇵',
  Spanish:    '🇪🇸',
  French:     '🇫🇷',
  Korean:     '🇰🇷',
  Mandarin:   '🇨🇳',
  Portuguese: '🇧🇷',
  German:     '🇩🇪',
  Italian:    '🇮🇹',
  Arabic:     '🇸🇦',
  Hindi:      '🇮🇳',
  Turkish:    '🇹🇷',
  Vietnamese: '🇻🇳',
  Thai:       '🇹🇭',
  Indonesian: '🇮🇩',
  Dutch:      '🇳🇱',
  Polish:     '🇵🇱',
  Swedish:    '🇸🇪',
  Russian:    '🇷🇺',
  Tagalog:    '🇵🇭',
  Swahili:    '🇰🇪',
};

export const LANG_COUNTRY_CODE: Record<string, string> = {
  English:    'US',
  Japanese:   'JP',
  Spanish:    'ES',
  French:     'FR',
  Korean:     'KR',
  Mandarin:   'CN',
  Portuguese: 'BR',
  German:     'DE',
  Italian:    'IT',
  Arabic:     'SA',
  Hindi:      'IN',
  Turkish:    'TR',
  Vietnamese: 'VN',
  Thai:       'TH',
  Indonesian: 'ID',
  Dutch:      'NL',
  Polish:     'PL',
  Swedish:    'SE',
  Russian:    'RU',
  Tagalog:    'PH',
  Swahili:    'KE',
};

// Lowercase for flag-icons CSS classes (fi fi-xx fis)
export const LANG_FLAG_CODE: Record<string, string> = {
  English:    'us',
  Japanese:   'jp',
  Spanish:    'es',
  French:     'fr',
  Korean:     'kr',
  Mandarin:   'cn',
  Portuguese: 'br',
  German:     'de',
  Italian:    'it',
  Arabic:     'sa',
  Hindi:      'in',
  Turkish:    'tr',
  Vietnamese: 'vn',
  Thai:       'th',
  Indonesian: 'id',
  Dutch:      'nl',
  Polish:     'pl',
  Swedish:    'se',
  Russian:    'ru',
  Tagalog:    'ph',
  Swahili:    'ke',
};

// Hex values so they work as inline styles (avoids Tailwind JIT detection issues)
export const LANG_AVATAR_COLOR: Record<string, string> = {
  Japanese:   '#3b82f6',
  Korean:     '#8b5cf6',
  Mandarin:   '#ef4444',
  Spanish:    '#f59e0b',
  French:     '#10b981',
  English:    '#6366f1',
  Portuguese: '#f97316',
  German:     '#64748b',
  Italian:    '#ec4899',
  Arabic:     '#14b8a6',
  Hindi:      '#f43f5e',
  Turkish:    '#dc2626',
  Vietnamese: '#16a34a',
  Thai:       '#7c3aed',
  Indonesian: '#b45309',
  Dutch:      '#0369a1',
  Polish:     '#be123c',
  Swedish:    '#1d4ed8',
  Russian:    '#1e40af',
  Tagalog:    '#0891b2',
  Swahili:    '#15803d',
};
