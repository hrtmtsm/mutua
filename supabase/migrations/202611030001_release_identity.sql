begin;
alter table public.profiles add column if not exists practice_level text;
-- Explicit legacy identity mapping. No inference from email addresses.
create table if not exists public.legacy_identity_links (
 legacy_session_id text primary key,
 user_id uuid not null references auth.users(id),
 source text not null check(source in ('auth_id','verified_app_metadata','authenticated_creation','reviewed_mapping')),
 created_at timestamptz not null default now()
);
alter table public.legacy_identity_links enable row level security;
revoke all on public.legacy_identity_links from public,anon,authenticated;
insert into public.legacy_identity_links(legacy_session_id,user_id,source)
 select p.session_id,u.id,'auth_id' from public.profiles p join auth.users u on p.session_id=u.id::text
 on conflict do nothing;
-- This field can be written only by the Auth administrator, never by a user.
insert into public.legacy_identity_links(legacy_session_id,user_id,source)
 select p.session_id,u.id,'verified_app_metadata' from auth.users u
 cross join lateral jsonb_array_elements_text(case when jsonb_typeof(u.raw_app_meta_data->'mutua_legacy_session_ids')='array' then u.raw_app_meta_data->'mutua_legacy_session_ids' else '[]'::jsonb end) sid
 join public.profiles p on p.session_id=sid.value
 on conflict do nothing;
-- Production reality check (2026-11-03, read-only count against prod): the
-- auth_id bootstrap above matches 0 of 229 legacy profiles (session_id was
-- never actually set to the owning account's auth.users.id), while
-- lower(email) = lower(email) matches all 229 1:1 with no ambiguity (229
-- pairs, 229 distinct profiles, zero profiles matching more than one auth
-- user). Without this backfill, every legacy user loses access to their own
-- matches/session_logs/messages the instant this migration's policies below
-- replace the current email-based RLS (1006 matches rows would become
-- unreadable by either participant). This is exactly the case the
-- 'reviewed_mapping' source value was defined for.
insert into public.legacy_identity_links(legacy_session_id,user_id,source)
 select p.session_id,u.id,'reviewed_mapping' from public.profiles p join auth.users u on lower(p.email)=lower(u.email)
 on conflict do nothing;
create or replace function public.owns_legacy_id(sid text) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.legacy_identity_links l where l.legacy_session_id=sid and l.user_id=auth.uid())
$$;
revoke all on function public.owns_legacy_id(text) from public,anon;
grant execute on function public.owns_legacy_id(text) to authenticated;

-- Remove all broad legacy policies rather than relying on permissive OR rules.
do $$ declare t text;r record;begin
 foreach t in array array['session_logs','session_feedback','messages','matches','profiles'] loop
  for r in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',r.policyname,t);
  end loop;
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- Existing authenticated profile lookups stay available for an unlinked legacy
-- identity, but private history is not guessed or reassigned by email.
create policy own_profile on public.profiles for select to authenticated using(
 public.owns_legacy_id(session_id) or lower(email)=lower(auth.jwt()->>'email'));
grant select on public.profiles to authenticated;
create policy own_profile_update on public.profiles for update to authenticated using(public.owns_legacy_id(session_id)) with check(public.owns_legacy_id(session_id));
grant update(name,bio,interests,goal,comm_style,availability,practice_frequency,native_language,learning_language,avatar_url,country_code,practice_level) on public.profiles to authenticated;
create policy own_log_read on public.session_logs for select to authenticated using(public.owns_legacy_id(user_id));
create policy own_log_insert on public.session_logs for insert to authenticated with check(public.owns_legacy_id(user_id));
grant select,insert on public.session_logs to authenticated;
create policy own_feedback_insert on public.session_feedback for insert to authenticated with check(public.owns_legacy_id(user_id));
create policy own_feedback_read on public.session_feedback for select to authenticated using(public.owns_legacy_id(user_id));
grant select,insert on public.session_feedback to authenticated;
create policy own_match_read on public.matches for select to authenticated using(public.owns_legacy_id(session_id_a) or public.owns_legacy_id(session_id_b));
create policy own_match_insert on public.matches for insert to authenticated with check(public.owns_legacy_id(session_id_a) or public.owns_legacy_id(session_id_b));
create policy own_match_update on public.matches for update to authenticated using(public.owns_legacy_id(session_id_a) or public.owns_legacy_id(session_id_b)) with check(public.owns_legacy_id(session_id_a) or public.owns_legacy_id(session_id_b));
grant select,insert,update on public.matches to authenticated;
create policy participant_message_read on public.messages for select to authenticated using(exists(
 select 1 from public.matches m where m.id=match_id and (public.owns_legacy_id(m.session_id_a) or public.owns_legacy_id(m.session_id_b))));
create policy participant_message_insert on public.messages for insert to authenticated with check(public.owns_legacy_id(sender_id) and exists(
 select 1 from public.matches m where m.id=match_id and sender_id in(m.session_id_a,m.session_id_b)));
grant select,insert on public.messages to authenticated;
-- Shared profile cards expose display fields, never email/moderation/auth data.
create or replace view public.public_profile_cards as
 select id,session_id,name,avatar_url,native_language,learning_language,country_code,bio,interests,goal,comm_style,availability,practice_frequency,created_at
 from public.profiles;
revoke all on public.public_profile_cards from public,anon,authenticated;
grant select on public.public_profile_cards to authenticated;
commit;
