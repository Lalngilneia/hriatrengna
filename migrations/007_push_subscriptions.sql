-- MemorialQR Migration 007: Web Push Subscriptions
-- Run: psql $DATABASE_URL -f migrations/007_push_subscriptions.sql

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id     UUID REFERENCES admins(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subs_admin_idx ON push_subscriptions(admin_id);

-- Notification log for deduplication
CREATE TABLE IF NOT EXISTS push_notification_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         VARCHAR(100) NOT NULL,
  payload      JSONB,
  sent_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_log_type_idx ON push_notification_log(type, sent_at DESC);
