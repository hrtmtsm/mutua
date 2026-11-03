-- Legacy history access-control fix — audit item "1. 履歴のアクセス制御"
--
-- Current production/staging state (confirmed read-only against the
-- yuponpfvhclhfqtihuok staging clone on 2026-11-03):
--   - matches:      row level security is DISABLED entirely. The anon role
--                    has full SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants.
--                    Anyone with the public anon key can read, modify, or
--                    wipe every match row — no ownership check exists at all.
--   - session_logs:  RLS is enabled, but both the INSERT and SELECT policies
--                    have qual/with_check literally `true` — i.e. no real
--                    restriction. Anyone can read every user's call history
--                    (who they talked to, when, for how long) and insert
--                    forged entries.
--
-- Why this fix (auth.jwt()->>'email', not a server-side bearer token):
--   Every legacy user already gets a real Supabase Auth account — the old
--   /onboarding flow's final step calls supabase.auth.signUp() the same way
--   the new instant-exchange flow does (see src/app/onboarding/page.tsx).
--   profiles.email is the existing bridge between that identity and the
--   legacy session_id used throughout matches/session_logs — the same
--   pattern the one existing profiles policy, "live_own_profile_read",
--   already relies on. So a user with an active session (same-device, or
--   freshly logged in via the existing /login, /auth/send pages) keeps
--   working with no code change in the client pages that read these tables
--   — they already share the same `supabase` client instance. A user with
--   no active session on that device gets correctly refused (not silently
--   degraded) until they log in — this is "prove who you are", not data
--   loss or forced re-registration.
--
-- All writes to `matches` from server API routes (cron/admin/auto-match/
-- rematch/schedule-match/set-availability/etc.) already use
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely — confirmed by
-- reading every server route that writes to `matches`. Only two places
-- write to `matches` directly from the browser with the anon/authenticated
-- role: src/app/find-match/page.tsx (creating a new match — upsert) and
-- src/app/session/page.tsx (archiving the match the session just ended).
-- Both are participant-scoped, which the policies below allow.
--
-- Idempotent: safe to run more than once (DROP POLICY IF EXISTS + re-create).
-- Nothing here is applied to production by this session — see
-- release-audit-report.md for the production rollout/rollback steps.

-- ── matches ──────────────────────────────────────────────────────────────
alter table public.matches enable row level security;

drop policy if exists "participant can read own matches" on public.matches;
create policy "participant can read own matches" on public.matches
  for select using (
    exists (
      select 1 from public.profiles p
      where (p.session_id = matches.session_id_a or p.session_id = matches.session_id_b)
        and lower(p.email) = lower(auth.jwt()->>'email')
    )
  );

-- find-match/page.tsx upserts a new match naming itself as one of the two
-- participants (deterministic a/b ordering by session_id) — never a
-- pre-existing match with someone else already in both slots.
drop policy if exists "participant can create own matches" on public.matches;
create policy "participant can create own matches" on public.matches
  for insert with check (
    exists (
      select 1 from public.profiles p
      where (p.session_id = matches.session_id_a or p.session_id = matches.session_id_b)
        and lower(p.email) = lower(auth.jwt()->>'email')
    )
  );

-- session/page.tsx archives its own match on session end; find-match's
-- upsert can also hit this path on conflict.
drop policy if exists "participant can update own matches" on public.matches;
create policy "participant can update own matches" on public.matches
  for update using (
    exists (
      select 1 from public.profiles p
      where (p.session_id = matches.session_id_a or p.session_id = matches.session_id_b)
        and lower(p.email) = lower(auth.jwt()->>'email')
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where (p.session_id = matches.session_id_a or p.session_id = matches.session_id_b)
        and lower(p.email) = lower(auth.jwt()->>'email')
    )
  );

-- No client ever deletes a match directly — no delete policy, so RLS
-- defaults to deny for anon/authenticated (service role still bypasses RLS).

-- Narrow the table-level grants to match: no anon access at all (anon users
-- are never a legitimate "owner" — auth.jwt() is null for them, so the
-- policies above already deny them, but removing the grant is defense in
-- depth per the audit's "RLS、GRANTの両方を確認する").
revoke all on public.matches from anon;
grant select, insert, update on public.matches to authenticated;

-- ── session_logs ─────────────────────────────────────────────────────────
-- Already enabled on staging as of 2026-11-03, but don't assume it — make
-- this migration correct from a cold start too.
alter table public.session_logs enable row level security;

drop policy if exists "users can insert their own logs" on public.session_logs;
drop policy if exists "users can read their own logs" on public.session_logs;

drop policy if exists "owner can insert own session logs" on public.session_logs;
create policy "owner can insert own session logs" on public.session_logs
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.session_id = session_logs.user_id
        and lower(p.email) = lower(auth.jwt()->>'email')
    )
  );

drop policy if exists "owner can read own session logs" on public.session_logs;
create policy "owner can read own session logs" on public.session_logs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.session_id = session_logs.user_id
        and lower(p.email) = lower(auth.jwt()->>'email')
    )
  );

-- No client updates or deletes session_logs rows — no policy for those,
-- so RLS denies them by default.

revoke all on public.session_logs from anon;
grant select, insert on public.session_logs to authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- To revert to the exact pre-fix state (NOT recommended — this restores
-- the vulnerability — kept here only for emergency rollback reference):
--
-- alter table public.matches disable row level security;
-- grant all on public.matches to anon;
-- drop policy if exists "participant can read own matches" on public.matches;
-- drop policy if exists "participant can create own matches" on public.matches;
-- drop policy if exists "participant can update own matches" on public.matches;
--
-- drop policy if exists "owner can insert own session logs" on public.session_logs;
-- drop policy if exists "owner can read own session logs" on public.session_logs;
-- create policy "users can insert their own logs" on public.session_logs for insert with check (true);
-- create policy "users can read their own logs" on public.session_logs for select using (true);
-- grant all on public.session_logs to anon;
