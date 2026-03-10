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
