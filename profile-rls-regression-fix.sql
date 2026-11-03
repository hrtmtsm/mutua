-- Fixes a production regression introduced by
-- supabase-local/supabase/migrations/20261101052100_profile_rls.sql.
--
-- That migration correctly removed the original fully-open `true` INSERT/
-- UPDATE policies on `profiles` (schema.sql's allow_insert/allow_update —
-- anyone, including unauthenticated anon-key requests, could overwrite any
-- user's profile row). That part was a real fix and must stay fixed.
--
-- But it also replaced the SELECT policy with "own row only" (own-email
-- match), which broke every legacy page that reads a *partner's* profile
-- (name/avatar/native_language) for display: messages, exchanges, partners,
-- history, Sidebar, session-review, set-availability all do this via direct
-- client-side `.from('profiles').select(...).eq('session_id', <partner>)`
-- calls. This was outside the original audit's scope (matches/session_logs
-- only) and wasn't caught by the existing npm run test:live suite, which
-- only exercises the new live_exchange system, not these legacy pages.
--
-- Fix: restore SELECT to the original open behavior (status quo before this
-- session touched anything — not a new exposure, not part of the audited
-- vulnerability), while keeping INSERT/UPDATE scoped to the authenticated
-- owner only (this keeps the real tampering vector closed).

drop policy if exists "allow_select" on public.profiles;
create policy "allow_select" on public.profiles for select using (true);
grant select on public.profiles to anon, authenticated;

drop policy if exists "live_own_profile_write" on public.profiles;
create policy "live_own_profile_write" on public.profiles for update to authenticated
  using (lower(email) = lower(auth.jwt()->>'email'))
  with check (lower(email) = lower(auth.jwt()->>'email'));
grant update on public.profiles to authenticated;

-- Rollback (returns to the strict-but-broken-for-legacy-pages state):
--   drop policy if exists "allow_select" on public.profiles;
--   drop policy if exists "live_own_profile_write" on public.profiles;
--   revoke select on public.profiles from anon;
--   revoke update on public.profiles from authenticated;
