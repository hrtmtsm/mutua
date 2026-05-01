-- ── Slot Template Migration ───────────────────────────────────────────────────
-- Run this in your Supabase SQL editor
-- Adds slot_template column to profiles for cross-device schedule reuse

alter table profiles
  add column if not exists slot_template integer[];
