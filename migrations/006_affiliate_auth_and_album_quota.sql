-- MemorialQR Migration 006: Affiliate Auth + Multi-Album Quota
-- Run: psql $DATABASE_URL -f migrations/006_affiliate_auth_and_album_quota.sql

-- ── AFFILIATE AUTH COLUMNS ─────────────────────────────────────
-- Affiliates can now self-register with email/password (no Google)
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS password_hash        TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS is_email_verified    BOOLEAN DEFAULT FALSE;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS email_verify_token   TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMPTZ;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS reset_token          TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS reset_token_expires  TIMESTAMPTZ;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS last_login           TIMESTAMPTZ;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS token_version        INTEGER DEFAULT 0;

-- ── MULTI-ALBUM QUOTA ON USERS ─────────────────────────────────
-- How many albums the subscriber has paid for (default 1)
ALTER TABLE users ADD COLUMN IF NOT EXISTS album_quota INTEGER NOT NULL DEFAULT 1;

-- ── ALBUM-LEVEL SUBSCRIPTION TRACKING ─────────────────────────
-- Links a specific album to a specific payment slot (for multi-album orders)
CREATE TABLE IF NOT EXISTS album_subscriptions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id       UUID REFERENCES albums(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  slot_number    INTEGER NOT NULL DEFAULT 1,   -- which "seat" in the quota
  activated_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS album_subs_user_idx  ON album_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS album_subs_album_idx ON album_subscriptions(album_id);

-- ── INDEXES FOR AFFILIATE AUTH ─────────────────────────────────
CREATE INDEX IF NOT EXISTS affiliates_verify_token_idx ON affiliates(email_verify_token);
CREATE INDEX IF NOT EXISTS affiliates_reset_token_idx  ON affiliates(reset_token);
