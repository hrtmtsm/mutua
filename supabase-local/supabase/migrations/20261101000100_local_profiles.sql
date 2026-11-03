-- Local verification bootstrap ONLY. Never apply this baseline to an existing project.
create table public.profiles (
 id uuid primary key default gen_random_uuid(), session_id text unique not null,
 email text not null, name text, native_language text not null, learning_language text not null,
 avatar_url text, country_code text, goal text, comm_style text, bio text, interests text,
 availability text, practice_frequency text, slot_template integer[],
 banned_until timestamptz, ban_reason text, ban_claimed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy own_profile_read on public.profiles for select to authenticated
 using (lower(email) = lower(auth.jwt()->>'email'));
grant select on public.profiles to authenticated;
