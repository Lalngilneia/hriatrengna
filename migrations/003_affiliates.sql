-- MemorialQR Migration 003: Affiliate System
-- Run: psql -U memorialqr_user -d memorialqr -h localhost -f 003_affiliates.sql

CREATE TABLE IF NOT EXISTS affiliates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  phone            VARCHAR(20),
  business_name    VARCHAR(255),
  referral_code    TEXT UNIQUE NOT NULL,
  commission_rate  NUMERIC(5,2) DEFAULT 10.00,  -- percentage of subscription amount
  status           VARCHAR(20) DEFAULT 'pending', -- pending | active | suspended | rejected
  notes            TEXT,                          -- admin internal notes
  bank_details     JSONB,                         -- { account_name, account_number, ifsc, bank_name }
  total_referrals  INTEGER DEFAULT 0,
  total_earnings   NUMERIC(10,2) DEFAULT 0.00,
  total_paid_out   NUMERIC(10,2) DEFAULT 0.00,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id     UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  transaction_id   UUID REFERENCES transactions(id) ON DELETE SET NULL,
  subscription_amount NUMERIC(10,2) NOT NULL,    -- what the user paid
  commission_rate  NUMERIC(5,2) NOT NULL,
  amount_inr       NUMERIC(10,2) NOT NULL,        -- commission earned
  status           VARCHAR(20) DEFAULT 'pending', -- pending | paid | cancelled
  paid_at          TIMESTAMPTZ,
  payment_ref      TEXT,                          -- e.g. bank transfer reference
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Add referral tracking to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code_used TEXT; -- code entered at signup

CREATE INDEX IF NOT EXISTS affiliates_referral_code_idx ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS commissions_affiliate_id_idx  ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS commissions_status_idx        ON commissions(status);
CREATE INDEX IF NOT EXISTS users_affiliate_id_idx        ON users(affiliate_id);
