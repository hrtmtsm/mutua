-- Staging verification: retire the legacy open profile write policies.
-- Profile writes use authenticated, owner-checked app endpoints.
do $$ declare policy_row record; begin
 for policy_row in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop
  execute format('drop policy %I on public.profiles',policy_row.policyname);
 end loop;
end $$;
alter table public.profiles enable row level security;
create policy live_own_profile_read on public.profiles for select to authenticated
 using(lower(email)=lower(auth.jwt()->>'email'));
grant select on public.profiles to authenticated;
revoke insert,update,delete on public.profiles from anon,authenticated;
