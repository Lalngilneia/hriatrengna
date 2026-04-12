ALTER TABLE support_inbox
  ADD COLUMN IF NOT EXISTS thread_token TEXT,
  ADD COLUMN IF NOT EXISTS body_text TEXT,
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

UPDATE support_inbox
SET thread_token = COALESCE(thread_token, REPLACE(id::text, '-', '')),
    headers = COALESCE(headers, '{}'::jsonb),
    last_message_at = COALESCE(last_message_at, replied_at, received_at)
WHERE thread_token IS NULL
   OR headers IS NULL
   OR last_message_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_inbox_thread_token
  ON support_inbox(thread_token)
  WHERE thread_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_inbox_last_message_at
  ON support_inbox(last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  support_inbox_id UUID NOT NULL REFERENCES support_inbox(id) ON DELETE CASCADE,
  webhook_id       TEXT NOT NULL UNIQUE REFERENCES resend_webhook_events(webhook_id) ON DELETE CASCADE,
  email_id         TEXT,
  message_id       TEXT,
  in_reply_to      TEXT,
  references_header TEXT,
  from_email       VARCHAR(255),
  from_name        VARCHAR(255),
  to_email         VARCHAR(255),
  cc               JSONB DEFAULT '[]'::jsonb,
  bcc              JSONB DEFAULT '[]'::jsonb,
  subject          TEXT,
  attachment_count INTEGER DEFAULT 0,
  body_text        TEXT,
  body_html        TEXT,
  headers          JSONB DEFAULT '{}'::jsonb,
  payload          JSONB NOT NULL,
  received_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON support_messages(support_inbox_id, received_at ASC);

CREATE INDEX IF NOT EXISTS idx_support_messages_message_id
  ON support_messages(message_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_in_reply_to
  ON support_messages(in_reply_to);
