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
};

// Hex values so they work as inline styles (avoids Tailwind JIT detection issues)
export const LANG_AVATAR_COLOR: Record<string, string> = {
  English:    '#3B82F6',
  Japanese:   '#EF4444',
  Spanish:    '#EAB308',
  French:     '#2563EB',
  Korean:     '#8B5CF6',
  Mandarin:   '#DC2626',
  Portuguese: '#10B981',
  German:     '#64748B',
  Italian:    '#22C55E',
  Arabic:     '#F59E0B',
};
