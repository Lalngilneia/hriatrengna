-- MemorialQR Migration 002: Invoices
-- Run: psql -U memorialqr_user -d memorialqr -h localhost -f 002_invoices.sql

-- Invoice number sequence (starts at 1001)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001 INCREMENT 1;

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number   TEXT UNIQUE NOT NULL DEFAULT ('INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 5, '0')),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  transaction_id   UUID REFERENCES transactions(id) ON DELETE SET NULL,
  amount_inr       NUMERIC(10,2) NOT NULL,
  plan             VARCHAR(20),
  status           VARCHAR(20) DEFAULT 'paid',
  user_name        TEXT,
  user_email       TEXT,
  issued_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices(created_at DESC);

-- email_log table (if not exists)
CREATE TABLE IF NOT EXISTS email_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email_to    TEXT,
  type        TEXT,
  resend_id   TEXT,
  status      TEXT DEFAULT 'sent',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
