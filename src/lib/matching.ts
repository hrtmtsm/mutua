import type { UserProfile, MatchResult } from './types';
import { getStarters } from './prompts';

// Demo names by native language (used when no real match exists)
const DEMO_NAMES: Record<string, string[]> = {
  English:    ['James', 'Emma', 'Oliver', 'Sophia'],
  Japanese:   ['Haruto', 'Yuki', 'Sakura', 'Kenji'],
  Spanish:    ['Carlos', 'Sofia', 'Diego', 'Isabella'],
  French:     ['Pierre', 'Camille', 'Lucas', 'Marie'],
  Korean:     ['Minho', 'Jisoo', 'Junho', 'Yuna'],
  Mandarin:   ['Wei', 'Mei', 'Jian', 'Xiao'],
  Portuguese: ['Rafael', 'Beatriz', 'Marco', 'Ana'],
  German:     ['Klaus', 'Lena', 'Hans', 'Anna'],
  Italian:    ['Lorenzo', 'Giulia', 'Marco', 'Sofia'],
  Arabic:     ['Omar', 'Layla', 'Ahmad', 'Fatima'],
};

export function scoreMatch(user: UserProfile, candidate: UserProfile): number {
  let score = 60;

  if (user.comm_style === candidate.comm_style) score += 20;
  if (user.goal === candidate.goal) score += 15;

  // frequency match (preferred) — fall back to legacy availability if neither has frequency
  if (user.practice_frequency && candidate.practice_frequency) {
    if (user.practice_frequency === candidate.practice_frequency) score += 10;
  } else if (user.availability && candidate.availability) {
    const availabilityMatch =
      user.availability === candidate.availability ||
      user.availability === 'Flexible' ||
      candidate.availability === 'Flexible';
    if (availabilityMatch) score += 10;
  }

  return Math.min(score, 99);
}

export function buildReasons(user: UserProfile, partner: UserProfile): string[] {
  const reasons: string[] = [
    `Native ${partner.native_language} speaker — exactly the language you want to practice`,
    `Learning ${partner.learning_language} — your native language`,
  ];

  if (user.goal === partner.goal) {
    reasons.push(`Same goal: ${user.goal}`);
  }

  if (user.comm_style === partner.comm_style) {
    reasons.push(`Both prefer ${user.comm_style.toLowerCase()}`);
  }

  if (user.practice_frequency && partner.practice_frequency) {
    if (user.practice_frequency === partner.practice_frequency) {
      reasons.push(`Both want to practice ${user.practice_frequency.toLowerCase()}`);
    }
  } else if (user.availability && partner.availability) {
    if (user.availability === partner.availability) {
      reasons.push(`Both available ${user.availability.toLowerCase()}`);
    } else if (partner.availability === 'Flexible') {
      reasons.push(`Your partner is flexible with timing`);
    }
  }

  return reasons;
}

export function createDemoPartner(user: UserProfile): UserProfile {
  const pool = DEMO_NAMES[user.learning_language] ?? ['Alex'];
  const name = pool[Math.floor(Math.random() * pool.length)];
  return {
    session_id:        'demo-' + Math.random().toString(36).slice(2, 8),
    native_language:   user.learning_language,
    learning_language: user.native_language,
    goal:               user.goal,
    comm_style:         user.comm_style,
    practice_frequency: user.practice_frequency,
    name,
  };
}

export function buildMatchResult(user: UserProfile, candidates: UserProfile[]): MatchResult {
  const partner =
    candidates.length > 0
      ? candidates.reduce((best, c) => (scoreMatch(user, c) > scoreMatch(user, best) ? c : best))
      : createDemoPartner(user);

  const score    = scoreMatch(user, partner);
  const reasons  = buildReasons(user, partner);
  const starters = getStarters(user.goal);

  return { partner, score, reasons, starters };
}
