-- MemorialQR Migration 009: Chat Conversations
-- Run: psql $DATABASE_URL -f migrations/009_chat_conversations.sql

CREATE TABLE IF NOT EXISTS chat_conversations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL UNIQUE,
  title        TEXT,
  messages     JSONB NOT NULL DEFAULT '[]',
  language     VARCHAR(10) DEFAULT 'en',   -- 'en' | 'hindi' | 'mizo'
  is_escalated BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_user_idx       ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS chat_session_idx    ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS chat_updated_idx    ON chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_escalated_idx  ON chat_conversations(is_escalated) WHERE is_escalated = TRUE;

-- If table already exists, add missing columns safely
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS language     VARCHAR(10) DEFAULT 'en';

-- Clean up guest chats older than 90 days (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_guest_chats() RETURNS void AS $$
BEGIN
  DELETE FROM chat_conversations
  WHERE user_id IS NULL AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
