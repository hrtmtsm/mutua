import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function userScopedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

/** Verifies the caller's Bearer token server-side and checks ban status.
 *  Every write-capable /api/presence/* route must call this — the client-side
 *  SetupModal gating is UX only, never the security boundary.
 *
 *  Returns two clients:
 *  - `db`: service-role, bypasses RLS — for reads/writes that must cross
 *    users (ban check, reading another user's coarse profile).
 *  - `rpcDb`: user-scoped (anon key + the caller's own access token) — use
 *    this, never `db`, for every `.rpc()` call. The SECURITY DEFINER
 *    functions read `auth.uid()` from the request's JWT, which only
 *    resolves correctly when the request is made as the user, not as the
 *    service role (service-role requests have no `auth.uid()`). */
export async function requireAuth(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false as const, status: 401 as const, error: 'unauthorized' };

  const db = adminClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user?.email) return { ok: false as const, status: 401 as const, error: 'unauthorized' };

  const { data: profile } = await db
    .from('profiles')
    .select('banned_until')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
    return { ok: false as const, status: 403 as const, error: 'banned' };
  }

  return {
    ok: true as const,
    db,
    rpcDb: userScopedClient(token),
    userId: user.id,
    email: user.email,
  };
}

/** Optional-auth variant for the two public read endpoints (available, profile/[userId]):
 *  returns the caller's userId when a valid, non-banned session is present, otherwise null —
 *  never rejects, since anonymous reads of coarse fields are intentionally allowed. */
export async function optionalAuth(request: Request) {
  const db = adminClient();
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return { db, userId: null as string | null };

  const { data: { user } } = await db.auth.getUser(token);
  return { db, userId: (user?.id ?? null) as string | null };
}
