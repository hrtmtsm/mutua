-- Moderation: add ban fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banned_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason     TEXT,
  ADD COLUMN IF NOT EXISTS ban_claimed_at TIMESTAMPTZ;
