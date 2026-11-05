import { supabase } from './supabase';

export interface LiveMessage { id: number; conversation_id: string; sender_id: string; client_id: string; body: string; created_at: string }
export interface LiveCall { id: string; conversation_id: string; from_user: string; status: 'ringing'|'accepted'|'declined'|'cancelled'|'expired'|'ended'; expires_at: string; ended_reason: string|null }
export interface LiveSnapshot {
 voice?: import('./practice').VoiceSession|null;
 userId: string;
 people?: { id: string; name: string|null; avatarUrl: string|null; countryCode: string|null }[];
 queue: { kind: 'text'|'voice'; expires_at: string } | null;
 conversation: { id: string; user_a: string; user_b: string; kind: 'text'|'voice'; status: 'active'|'ended'; ended_reason: string|null } | null;
 partner?: { id: string; name: string|null; avatarUrl: string|null; nativeLanguage: string; learningLanguage: string; countryCode: string|null };
 call?: LiveCall|null;
 messages: LiveMessage[];
}
export async function liveAction(action: string, data: Record<string, unknown> = {}): Promise<LiveSnapshot> {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) throw new Error('ログインしてください。');
 const request = (token: string) => fetch('/api/live-exchange', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ action, data }), signal: AbortSignal.timeout(15000),
 }).catch(() => { throw new Error('通信がタイムアウトしました。もう一度お試しください。'); });
 let response = await request(session.access_token);
 // A rejected token has not executed the action. Refresh it once before retrying.
 if (response.status === 401) {
  const refreshed = await supabase.auth.refreshSession();
  if (!refreshed.data.session || refreshed.error) {
   await supabase.auth.signOut({ scope: 'local' });
   throw new Error('ログインの有効期限が切れました。もう一度ログインしてください。');
  }
  response = await request(refreshed.data.session.access_token);
 }
 const result = await response.json();
 if (!response.ok || result.error) throw new Error(result.error || '接続できませんでした。');
 return result;
}
