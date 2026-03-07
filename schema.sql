-- Run this in your Supabase SQL editor to set up the database.
-- The app works without this (demo mode), but real matching requires it.

create table if not exists profiles (
  id                 uuid        primary key default gen_random_uuid(),
  session_id         text        unique not null,
  native_language    text        not null,
  learning_language  text        not null,
  goal               text        not null,
  comm_style         text        not null,
  availability       text        not null,
  created_at         timestamptz default now()
);

create index if not exists profiles_language_idx
  on profiles (native_language, learning_language);

-- Row Level Security
-- Minimal policies for MVP. Lock these down before any public launch.
alter table profiles enable row level security;

create policy "allow_select" on profiles for select using (true);
create policy "allow_insert" on profiles for insert with check (true);
create policy "allow_update" on profiles for update using (true);

-- Waitlist: users who searched but no match was found yet
create table if not exists waitlist_matches (
  id                   uuid        primary key default gen_random_uuid(),
  email                text        not null,
  native_language      text        not null,
  target_language      text        not null,
  goal                 text        not null,
  communication_style  text        not null,
  availability         text        not null,
  created_at           timestamptz default now()
);

create index if not exists waitlist_language_idx
  on waitlist_matches (native_language, target_language);

alter table waitlist_matches enable row level security;

create policy "waitlist_insert" on waitlist_matches for insert with check (true);
create policy "waitlist_select" on waitlist_matches for select using (true);
