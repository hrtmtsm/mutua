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

// Language-specific conversation starters for the session prompt card
const LANG_STARTERS: Record<string, string[]> = {
  English: [
    "What's a phrase in English you find confusing or funny?",
    "Is there a movie or show that helped your English the most?",
    "What's the hardest part of English pronunciation for you?",
    "How different is American vs. British English to you?",
    "What's an English idiom that took you a while to understand?",
  ],
  Japanese: [
    "What made you want to start learning Japanese?",
    "Do you find kanji, hiragana, or katakana hardest to learn?",
    "Is there a Japanese word or phrase you love that doesn't translate well?",
    "How do you feel about the formal vs. casual speech levels in Japanese?",
    "What's something about Japanese culture you're curious about?",
  ],
  Spanish: [
    "Which dialect of Spanish are you learning — Latin American or Spanish from Spain?",
    "What's a Spanish word that sounds nothing like what it means to you?",
    "Have you tried any Spanish-language media like shows or music?",
    "What's the trickiest part of Spanish grammar for you — ser vs. estar?",
    "Is there a Spanish-speaking country you'd most like to visit?",
  ],
  French: [
    "What made you decide to learn French?",
    "Do you find French pronunciation as hard as people say?",
    "What's a French expression you've picked up that you love?",
    "How do you feel about the silent letters in French?",
    "Is there a French film or book that's helped your learning?",
  ],
  Korean: [
    "What got you interested in learning Korean?",
    "How long did it take you to get comfortable reading Hangul?",
    "What's a Korean word or expression you find really satisfying to say?",
    "Do you find the honorific speech levels in Korean confusing?",
    "Has K-pop or K-dramas played a role in your learning?",
  ],
  Mandarin: [
    "What motivated you to start learning Mandarin?",
    "How do you approach learning tones — do you have a method?",
    "What's a character you always mix up with another?",
    "Do you find simplified or traditional characters easier to read?",
    "What's something about Mandarin that surprised you?",
  ],
  Portuguese: [
    "Are you learning Brazilian or European Portuguese?",
    "What's a Portuguese word that you find beautiful?",
    "How similar or different does Portuguese feel compared to Spanish to you?",
    "What's been the biggest challenge in learning Portuguese so far?",
    "Is there a Portuguese-speaking country or culture you're especially drawn to?",
  ],
  German: [
    "What got you started with German?",
    "How are you finding the grammatical cases — nominative, accusative, dative?",
    "What's a German compound word that blew your mind?",
    "Do you find German pronunciation easier or harder than you expected?",
    "Have you watched any German shows or films for practice?",
  ],
  Italian: [
    "What drew you to learning Italian?",
    "Do you find Italian easier because of its connection to other Romance languages?",
    "What's a word or phrase in Italian you find really expressive?",
    "How are you finding the verb conjugations in Italian?",
    "Is there a region of Italy you're particularly curious about?",
  ],
  Arabic: [
    "Which dialect of Arabic are you focusing on, or Modern Standard?",
    "How are you finding the Arabic script — left to right feels natural yet?",
    "What's the most challenging sound in Arabic for you?",
    "What drew you to learning Arabic?",
    "Have you found any resources that really helped you get started?",
  ],
  Hindi: [
    "What made you want to learn Hindi?",
    "How are you finding the Devanagari script?",
    "What's a Hindi word or phrase you really like the sound of?",
    "Do you find Bollywood films helpful for picking up Hindi?",
    "What's something about Indian culture you'd love to know more about?",
  ],
  Turkish: [
    "What got you interested in learning Turkish?",
    "How do you find the vowel harmony rules in Turkish?",
    "What's a Turkish word or expression that surprised you?",
    "Is there a part of Turkey or Turkish culture you're particularly drawn to?",
    "Do you find Turkish grammar very different from languages you know?",
  ],
  Vietnamese: [
    "What drew you to learning Vietnamese?",
    "How are you finding the six tones in Vietnamese?",
    "Is there a Vietnamese word or phrase you find particularly fun to say?",
    "Are you learning Northern or Southern Vietnamese?",
    "What's something about Vietnamese culture you're curious about?",
  ],
  Thai: [
    "What made you decide to learn Thai?",
    "How are you finding the Thai script — does it feel manageable yet?",
    "What's the trickiest part of Thai tones for you?",
    "Is there a Thai word or phrase you love?",
    "What aspect of Thai culture are you most curious about?",
  ],
  Indonesian: [
    "What got you started with Indonesian?",
    "Do you find Indonesian grammar more straightforward than other languages?",
    "What's a word in Indonesian you find interesting?",
    "Are you learning Indonesian for travel, work, or something else?",
    "What's something about Indonesia you'd love to learn more about?",
  ],
  Dutch: [
    "What made you want to learn Dutch?",
    "Do you find Dutch pronunciation as tricky as people say?",
    "What's a Dutch word you've come across that surprised you?",
    "Have you tried any Dutch media — films, music, podcasts?",
    "Is there something about Dutch or Belgian culture you're curious about?",
  ],
  Polish: [
    "What drew you to learning Polish?",
    "How are you finding the Polish consonant clusters?",
    "What's a Polish word or phrase you like?",
    "Do you have family or personal connections to Poland?",
    "What's the hardest part of Polish grammar for you so far?",
  ],
  Swedish: [
    "What got you interested in learning Swedish?",
    "How do you find the Swedish pitch accent?",
    "What's a Swedish word you find particularly interesting?",
    "Have you explored any Swedish music, films, or shows?",
    "Is there something about Scandinavian culture you're curious about?",
  ],
  Russian: [
    "What motivated you to start learning Russian?",
    "How are you finding the Cyrillic alphabet — does it feel natural yet?",
    "What's a Russian word or phrase you find fascinating?",
    "Do you find the Russian case system challenging?",
    "What's something about Russian culture or history you'd love to know more about?",
  ],
  Tagalog: [
    "What made you want to learn Tagalog?",
    "Do you have family or personal connections to the Philippines?",
    "What's a Tagalog word or expression you really like?",
    "How do you find the focus system in Tagalog grammar?",
    "What's something about Filipino culture you're most curious about?",
  ],
  Swahili: [
    "What drew you to learning Swahili?",
    "How are you finding the noun class system in Swahili?",
    "What's a Swahili word or phrase you find really expressive?",
    "Are you learning Swahili for travel, work, or personal reasons?",
    "Which part of East Africa are you most interested in visiting or connecting with?",
  ],
};

// Pre-session starters — language-specific conversation prompts
export function getSessionStarters(targetLanguage: string): string[] {
  const pool = [...(LANG_STARTERS[targetLanguage] ?? [
    `Why are you learning ${targetLanguage}?`,
    'What would you like to focus on in this session?',
    'Do you prefer corrections while speaking, or after?',
  ])].sort(() => Math.random() - 0.5);
  return pool.slice(0, 3);
}
