-- Run: psql $DATABASE_URL -f migrations/014_fcm_tokens.sql

-- Create FCM tokens table for Firebase Cloud Messaging
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID REFERENCES admins(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    fcm_token       TEXT NOT NULL,
    device_name     TEXT,
    user_agent      TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at    TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS fcm_tokens_admin_idx ON fcm_tokens(admin_id) WHERE admin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fcm_tokens_user_idx ON fcm_tokens(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fcm_tokens_token_idx ON fcm_tokens(fcm_token);

-- Prevent duplicate tokens per admin/user
CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_admin_unique ON fcm_tokens(admin_id, fcm_token) WHERE admin_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_unique ON fcm_tokens(user_id, fcm_token) WHERE user_id IS NOT NULL;
