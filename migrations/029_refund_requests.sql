-- Migration 029: Refund requests and admin refund processing

CREATE TABLE IF NOT EXISTS refund_requests (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id         UUID REFERENCES transactions(id) ON DELETE SET NULL,
  invoice_id             UUID REFERENCES invoices(id) ON DELETE SET NULL,
  user_id                UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_amount_paise INTEGER NOT NULL,
  requested_amount_inr   NUMERIC(10,2) NOT NULL,
  approved_amount_paise  INTEGER,
  approved_amount_inr    NUMERIC(10,2),
  reason                 TEXT,
  status                 VARCHAR(30) NOT NULL DEFAULT 'requested',
  requested_by_user      BOOLEAN NOT NULL DEFAULT TRUE,
  admin_notes            TEXT,
  reviewer_admin_id      UUID REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  processed_at           TIMESTAMPTZ,
  rejected_at            TIMESTAMPTZ,
  razorpay_payment_id    TEXT,
  razorpay_refund_id     TEXT UNIQUE,
  razorpay_refund_status VARCHAR(50),
  raw_payload            JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refund_requests_status_check CHECK (
    status IN ('requested', 'approved', 'rejected', 'processing', 'processed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS refund_requests_user_id_idx
  ON refund_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS refund_requests_tx_id_idx
  ON refund_requests(transaction_id);

CREATE INDEX IF NOT EXISTS refund_requests_status_idx
  ON refund_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS refund_requests_updated_at ON refund_requests;
CREATE TRIGGER refund_requests_updated_at
BEFORE UPDATE ON refund_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
