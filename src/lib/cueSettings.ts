export const cueTopics = ['Casual conversation', 'Travel', 'Work', 'Culture', 'Daily life'];
export const cueLevels = ['', 'Beginner', 'Intermediate', 'Advanced'];
export const cueVoices = ['marin', 'cedar'] as const;
export type CueVoice = 'random' | typeof cueVoices[number];

export function readCueSettings(value: unknown) {
 const settings = (value ?? {}) as Record<string, unknown>;
 const { topic, level, voice } = settings;
 return {
  topic: typeof topic === 'string' && cueTopics.includes(topic) ? topic : cueTopics[0],
  level: typeof level === 'string' && cueLevels.includes(level) ? level : '',
  voice: (voice === 'marin' || voice === 'cedar' ? voice : 'random') as CueVoice,
 };
}
