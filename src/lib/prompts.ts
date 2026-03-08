import type { Goal } from './types';

const STARTERS: Record<Goal, string[]> = {
  'Casual conversation': [
    "What's something small that made you happy this week?",
    "What's a habit you've picked up recently — good or bad?",
    "If you could describe your city in three words, what would they be?",
    "What's the most interesting thing you've seen or heard lately?",
    "What does a typical evening look like for you?",
  ],
  'Travel': [
    "What's the most useful phrase you've learned for getting around in another country?",
    "What's a destination on your list that most people haven't heard of?",
    "What's the biggest mistake you or someone you know made while traveling?",
    "How do you usually prepare for a trip to a country where you don't speak the language?",
    "What's one thing that surprised you about a place you visited?",
  ],
  'Work / professional': [
    "How do people typically address each other in a work setting in your culture — formal or first names?",
    "Is small talk common in your country's work culture, or do people get straight to business?",
    "How do people politely disagree in a meeting where you work?",
    "What's a professional phrase or expression you find yourself using a lot?",
    "How do you handle a situation where you don't understand something in a work call?",
  ],
  'Cultural exchange': [
    "What's a tradition or celebration in your culture that you think outsiders would find surprising?",
    "How does your culture typically handle disagreement or conflict — directly or indirectly?",
    "What's something about daily life in your country that you think is underrated?",
    "Is there a local food, custom, or place that you think everyone should experience?",
    "What's something you've learned about another culture that genuinely changed how you see things?",
  ],
  'Making friends': [
    "What's something you're genuinely passionate about that most people don't expect?",
    "How do friendships typically start in your culture — through school, work, introductions?",
    "What's something you'd want a new friend to know about you early on?",
    "What's something you've always wanted to try but haven't gotten around to yet?",
    "What do you usually do when you want to meet new people?",
  ],
};

export function getStarters(goal: Goal): string[] {
  const pool = [...STARTERS[goal]].sort(() => Math.random() - 0.5);
  return pool.slice(0, 3);
}

// Pre-session starters — about the practice session itself, not the topic
export function getSessionStarters(targetLanguage: string): string[] {
  return [
    `Why are you learning ${targetLanguage}?`,
    'What would you like to focus on in this session?',
    'Do you prefer corrections while speaking, or after?',
  ];
}
