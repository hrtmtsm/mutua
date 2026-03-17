-- Run this in your Supabase SQL editor to set up the database.
-- The app works without this (demo mode), but real matching requires it.

create table if not exists profiles (
  id                 uuid        primary key default gen_random_uuid(),
  session_id         text        unique not null,
  native_language    text        not null,
  learning_language  text        not null,
  goal               text        not null,
  comm_style         text        not null,
  availability       text,
  practice_frequency text,
  name               text,
  email              text,
  avatar_url         text,
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

-- ── Prompts ───────────────────────────────────────────────────────────────────
-- Content table: all session prompts with translations, difficulty level,
-- phase assignment, and optional follow-up hint.
-- Seed this with seed_prompts.sql after running this file.

create table if not exists prompts (
  id            uuid        primary key default gen_random_uuid(),
  phase         text        not null check (phase in ('ice', 'conv', 'reflect')),
  level         integer     not null check (level between 1 and 3),
  tags          text[]      default '{}',
  hint          text,
  translations  jsonb       not null,
  created_at    timestamptz default now()
);

create index if not exists prompts_phase_level_idx on prompts (phase, level);

alter table prompts enable row level security;
create policy "prompts_select" on prompts for select using (true);

-- ── Session prompt history ────────────────────────────────────────────────────
-- Tracks which prompts were shown to each partner pair so recently-seen
-- prompts are deprioritised on the next session.
-- session_id_a / session_id_b are stored in sorted order (a < b alphabetically).

create table if not exists session_prompts (
  id            uuid        primary key default gen_random_uuid(),
  session_id_a  text        not null,
  session_id_b  text        not null,
  prompt_id     uuid        not null references prompts (id),
  shown_at      timestamptz default now()
);

create index if not exists session_prompts_pair_idx
  on session_prompts (session_id_a, session_id_b);

alter table session_prompts enable row level security;
create policy "session_prompts_insert" on session_prompts for insert with check (true);
create policy "session_prompts_select" on session_prompts for select using (true);
