-- Production migration: add all columns that exist in staging but not prod
-- Run this in Supabase SQL editor (prod project), then reload the schema cache:
-- Dashboard → API → Schema cache → Reload

-- ── profiles table ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS name               text,
  ADD COLUMN IF NOT EXISTS bio                text,
  ADD COLUMN IF NOT EXISTS interests          text,
  ADD COLUMN IF NOT EXISTS avatar_url         text;

-- ── matches table ─────────────────────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scheduling_state   text    DEFAULT 'pending_both',
  ADD COLUMN IF NOT EXISTS scheduled_at       timestamptz,
  ADD COLUMN IF NOT EXISTS availability_a_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_b_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at         timestamptz,
  ADD COLUMN IF NOT EXISTS email_a            text,
  ADD COLUMN IF NOT EXISTS email_b            text,
  ADD COLUMN IF NOT EXISTS score              integer,
  ADD COLUMN IF NOT EXISTS reasons            text[],
  ADD COLUMN IF NOT EXISTS goal               text,
  ADD COLUMN IF NOT EXISTS comm_style         text,
  ADD COLUMN IF NOT EXISTS practice_frequency text,
  ADD COLUMN IF NOT EXISTS name_a             text,
  ADD COLUMN IF NOT EXISTS name_b             text,
  ADD COLUMN IF NOT EXISTS status             text;
