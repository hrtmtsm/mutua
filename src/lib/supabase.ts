import { createClient } from '@supabase/supabase-js';
import type { UserProfile } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');

export const isConfigured = Boolean(url && key);

export async function saveProfile(
  profile: Omit<UserProfile, 'id' | 'created_at'>,
): Promise<void> {
  if (!isConfigured) return;
  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'session_id' });
  if (error) throw error;
}

export async function findCandidates(profile: UserProfile): Promise<UserProfile[]> {
  if (!isConfigured) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('native_language', profile.learning_language)
    .eq('learning_language', profile.native_language)
    .neq('session_id', profile.session_id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export interface WaitlistEntry {
  id?:                  string;
  email:                string;
  native_language:      string;
  target_language:      string;
  goal:                 string;
  communication_style:  string;
  availability?:        string;   // deprecated — kept for legacy rows
  practice_frequency?:  string;
  created_at?:          string;
}

export async function isEmailOnWaitlist(email: string): Promise<boolean> {
  if (!isConfigured) return false;
  const { data, error } = await supabase
    .from('waitlist_matches')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function saveToWaitlist(
  entry: Omit<WaitlistEntry, 'id' | 'created_at'>,
): Promise<void> {
  if (!isConfigured) return;
  const { error } = await supabase.from('waitlist_matches').insert(entry);
  if (error) throw error;
}

export async function checkWaitlistForMatch(profile: UserProfile): Promise<WaitlistEntry[]> {
  if (!isConfigured) return [];
  const { data, error } = await supabase
    .from('waitlist_matches')
    .select('*')
    .eq('native_language', profile.learning_language)
    .eq('target_language', profile.native_language);
  if (error) throw error;
  return (data ?? []) as WaitlistEntry[];
}

// ── Matches table ─────────────────────────────────────────────────────────────
// SQL to create in Supabase:
//
// CREATE TABLE matches (
//   id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   session_id_a        TEXT NOT NULL,
//   session_id_b        TEXT NOT NULL,
//   name_a              TEXT,
//   name_b              TEXT,
//   email_a             TEXT,
//   email_b             TEXT,
//   native_language_a   TEXT NOT NULL,
//   native_language_b   TEXT NOT NULL,
//   goal                TEXT,
//   comm_style          TEXT,
//   practice_frequency  TEXT,
//   score               INTEGER DEFAULT 0,
//   reasons             TEXT[],
//   suggested_time      TIMESTAMPTZ,
//   status              TEXT DEFAULT 'pending',
//   created_at          TIMESTAMPTZ DEFAULT NOW()
// );

export type SchedulingState =
  | 'pending_both'
  | 'pending_a'
  | 'pending_b'
  | 'computing'
  | 'no_overlap'
  | 'scheduled'
  | 'archived';

export interface Match {
  id:                       string;
  session_id_a:             string;
  session_id_b:             string;
  name_a?:                  string;
  name_b?:                  string;
  email_a?:                 string;
  email_b?:                 string;
  native_language_a:        string;
  native_language_b:        string;
  goal?:                    string;
  comm_style?:              string;
  practice_frequency?:      string;
  score?:                   number;
  reasons?:                 string[];
  suggested_time?:          string;
  status?:                  string;
  // Scheduling system
  scheduling_state?:        SchedulingState;
  scheduled_at?:            string;       // UTC ISO string
  availability_a_set_at?:   string;
  availability_b_set_at?:   string;
  expires_at?:              string;
  created_at?:              string;
}

export interface UserAvailability {
  id?:          string;
  user_id:      string;
  day_of_week:  number;   // 0=Mon … 6=Sun
  start_minute: number;   // 0–1410, step 30
  timezone:     string;   // IANA
  updated_at?:  string;
}

export interface ConfirmedSession {
  id?:        string;
  match_id:   string;
  user_id:    string;
  starts_at:  string;   // UTC ISO
  ends_at:    string;   // UTC ISO (starts_at + 30 min)
  created_at?: string;
}

// ── Messages table ────────────────────────────────────────────────────────────
// Run in Supabase SQL editor:
//
// CREATE TABLE messages (
//   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
//   sender_id   TEXT NOT NULL,
//   text        TEXT NOT NULL,
//   created_at  TIMESTAMPTZ DEFAULT NOW()
// );
// ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "open_read"   ON messages FOR SELECT USING (true);
// CREATE POLICY "open_insert" ON messages FOR INSERT WITH CHECK (true);

export interface Message {
  id:         string;
  match_id:   string;
  sender_id:  string;
  text:       string;
  created_at: string;
}

export async function getMessages(matchId: string): Promise<Message[]> {
  if (!isConfigured) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(matchId: string, senderId: string, text: string): Promise<void> {
  if (!isConfigured) return;
  const res = await fetch('/api/send-message', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ matchId, senderId, text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to send message');
  }
}

export async function getMatchBySessionId(sessionId: string): Promise<Match | null> {
  if (!isConfigured) return null;
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
    .neq('scheduling_state', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Match | null;
}

export async function getMatchesBySessionId(sessionId: string): Promise<Match[]> {
  if (!isConfigured) return [];
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
    .neq('scheduling_state', 'archived')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as Match[];
}
