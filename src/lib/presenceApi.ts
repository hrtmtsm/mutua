import { supabase } from '@/lib/supabase';

// Thin wrappers around /api/presence/* — the REAL mode of the instant-call
// integration. Every call attaches the caller's actual Supabase access
// token. Every result is a discriminated {ok:true,...} | {ok:false,error}
// — callers MUST check `ok` and show `error` directly. Never catch-and-treat
// a failed real call as a mock success; that would hide exactly the signal
// this mode exists to surface (the DB migration isn't applied yet, so every
// one of these is expected to fail with a clear DB error until it is).

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const IS_DEV = process.env.NODE_ENV !== 'production';
const GENERIC_ERROR = '接続できませんでした。しばらくしてからもう一度お試しください。';

// The raw error (DB/column/table names, stack-ish detail) is ALWAYS logged
// to the console for debugging, in every environment. What gets shown in the
// UI differs: full detail in dev (so wiring/DB issues are easy to diagnose
// locally), a generic user-safe message in production (never leak schema/
// implementation details to real users). This must never silently succeed —
// `ok` stays false either way, only the displayed string changes.
function userFacingError(raw: string): string {
  console.error('[presenceApi] real API error:', raw);
  return IS_DEV ? raw : GENERIC_ERROR;
}

async function authedFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: userFacingError('unauthorized: no Supabase session') };
  }
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: userFacingError(body?.error ?? `HTTP ${res.status}`) };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return { ok: false, error: userFacingError(err instanceof Error ? err.message : 'network error') };
  }
}

export function togglePresence(isAvailable: boolean) {
  return authedFetch<{ success: true }>('/api/presence/toggle', {
    method: 'POST',
    body: JSON.stringify({ isAvailable }),
  });
}

export function fetchAvailable() {
  // Public endpoint, but we still call it the same way (no Bearer needed —
  // fetch directly, not authedFetch, since anonymous/unauthenticated users
  // can browse the globe too).
  return fetch('/api/presence/available')
    .then(async res => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false as const, error: userFacingError(body?.error ?? `HTTP ${res.status}`) };
      return { ok: true as const, data: body as { users: unknown[] } };
    })
    .catch(err => ({ ok: false as const, error: userFacingError(err instanceof Error ? err.message : 'network error') }));
}

export function inviteUser(targetUserId: string) {
  return authedFetch<{ inviteId: string }>('/api/presence/invite', {
    method: 'POST',
    body: JSON.stringify({ to: targetUserId }),
  });
}

export function respondInvite(inviteId: string, accept: boolean) {
  return authedFetch<{ result: 'accepted' | 'declined' | 'expired'; sessionId?: string }>(
    `/api/presence/invite/${inviteId}/respond`,
    { method: 'POST', body: JSON.stringify({ accept }) },
  );
}

export function cancelInvite(inviteId: string) {
  return authedFetch<{ success: true }>(`/api/presence/invite/${inviteId}/cancel`, { method: 'POST' });
}

export function joinRandomQueue() {
  return authedFetch<{ sessionId: string | null }>('/api/presence/random/join', { method: 'POST' });
}

export function cancelRandomQueue() {
  return authedFetch<{ success: true }>('/api/presence/random/cancel', { method: 'POST' });
}

export function endSession(sessionId: string, reason?: string) {
  return authedFetch<{ success: true }>(`/api/presence/session/${sessionId}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? null }),
  });
}
