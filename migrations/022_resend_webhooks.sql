CREATE TABLE IF NOT EXISTS resend_webhook_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id        TEXT NOT NULL UNIQUE,
  event_type        VARCHAR(100) NOT NULL,
  email_id          TEXT,
  recipient_email   VARCHAR(255),
  sender_email      VARCHAR(255),
  subject           TEXT,
  event_created_at  TIMESTAMPTZ,
  received_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  status            VARCHAR(50) DEFAULT 'received',
  error_message     TEXT,
  payload           JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_event_type
  ON resend_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_email_id
  ON resend_webhook_events(email_id);

CREATE INDEX IF NOT EXISTS idx_resend_webhook_events_received_at
  ON resend_webhook_events(received_at DESC);

CREATE TABLE IF NOT EXISTS support_inbox (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id        TEXT NOT NULL UNIQUE REFERENCES resend_webhook_events(webhook_id) ON DELETE CASCADE,
  email_id          TEXT,
  message_id        TEXT,
  from_email        VARCHAR(255),
  from_name         VARCHAR(255),
  to_email          VARCHAR(255),
  cc                JSONB DEFAULT '[]'::jsonb,
  bcc               JSONB DEFAULT '[]'::jsonb,
  subject           TEXT,
  attachment_count  INTEGER DEFAULT 0,
  payload           JSONB NOT NULL,
  received_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_inbox_received_at
  ON support_inbox(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_inbox_from_email
  ON support_inbox(from_email);
