export const LANGUAGES = [
  'English', 'Japanese', 'Spanish', 'French', 'Korean',
  'Mandarin', 'Portuguese', 'German', 'Italian', 'Arabic',
] as const;

export const GOALS = [
  'Casual conversation',
  'Travel',
  'Work / professional',
  'Cultural exchange',
  'Making friends',
] as const;

export const COMM_STYLES = [
  'Voice call',
  'Video call',
  'Text first',
] as const;

export const AVAILABILITY = [
  'Weekday mornings',
  'Weekday evenings',
  'Weekends',
  'Flexible',
] as const;

export const FREQUENCY = [
  'Once a week',
  '2–3 times a week',
  'Every day',
  'No fixed schedule',
] as const;

export type Language     = typeof LANGUAGES[number];
export type Goal         = typeof GOALS[number];
export type CommStyle    = typeof COMM_STYLES[number];
export type Availability = typeof AVAILABILITY[number];
export type Frequency    = typeof FREQUENCY[number];

export interface UserProfile {
  id?:                 string;
  session_id:          string;
  email?:              string;
  native_language:     Language;
  learning_language:   Language;
  goal:                Goal;
  comm_style:          CommStyle;
  availability?:       Availability;      // deprecated — kept for legacy rows
  practice_frequency?: Frequency;
  name?:               string;            // display name — not persisted to DB
  created_at?:         string;
}

// A partner the user has saved to their active partners list
export interface SavedPartner {
  partner_id:          string;
  name:                string;
  native_language:     Language;
  learning_language:   Language;
  goal:                Goal;
  comm_style:          CommStyle;
  availability?:       Availability;      // deprecated — kept for legacy rows
  practice_frequency?: Frequency;
  saved_at:            string;
}

export interface MatchResult {
  partner:  UserProfile;
  score:    number;
  reasons:  string[];
  starters: string[];
}
