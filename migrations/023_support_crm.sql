ALTER TABLE support_inbox
  ADD COLUMN IF NOT EXISTS ticket_status VARCHAR(50) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE support_inbox
SET ticket_status = 'open'
WHERE ticket_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_inbox_ticket_status
  ON support_inbox(ticket_status);

CREATE INDEX IF NOT EXISTS idx_support_inbox_assigned_admin
  ON support_inbox(assigned_admin_id);

CREATE TABLE IF NOT EXISTS support_replies (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  support_inbox_id UUID NOT NULL REFERENCES support_inbox(id) ON DELETE CASCADE,
  admin_id         UUID REFERENCES admins(id) ON DELETE SET NULL,
  to_email         VARCHAR(255) NOT NULL,
  subject          TEXT NOT NULL,
  body_text        TEXT NOT NULL,
  resend_id        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_replies_ticket
  ON support_replies(support_inbox_id, created_at DESC);
