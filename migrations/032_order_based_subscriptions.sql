-- ============================================================
-- Migration 032: Order-Based Consumer Subscriptions
-- - Adds internal subscriptions + payments tables
-- - Links legacy user_subscriptions rows to internal subscriptions
-- - Adds indexes needed for order/payment idempotency
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config_id                UUID REFERENCES subscription_configs(id) ON DELETE SET NULL,
  plan_slug                VARCHAR(100) NOT NULL,
  plan_type                VARCHAR(20) NOT NULL
                             CHECK (plan_type IN ('memorial','wedding')),
  amount                   INTEGER NOT NULL CHECK (amount > 0),
  status                   VARCHAR(20) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','active','past_due','cancelled')),
  payment_mode             VARCHAR(20) NOT NULL DEFAULT 'monthly'
                             CHECK (payment_mode IN ('monthly','upfront')),
  billing_interval_months  INTEGER NOT NULL DEFAULT 1 CHECK (billing_interval_months > 0),
  next_billing_date        TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  grace_period_until       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status, next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_type
  ON subscriptions(user_id, plan_type, created_at DESC);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS payments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id      UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  razorpay_order_id    TEXT NOT NULL UNIQUE,
  razorpay_payment_id  TEXT UNIQUE,
  amount               INTEGER NOT NULL CHECK (amount > 0),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','success','failed')),
  receipt              TEXT,
  raw_payload          JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_subscription
  ON payments(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status, created_at DESC);

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_subscription_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_user_subs_billing_subscription'
      AND table_name = 'user_subscriptions'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT fk_user_subs_billing_subscription
      FOREIGN KEY (billing_subscription_id) REFERENCES subscriptions(id)
      ON DELETE SET NULL;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subs_billing_subscription
  ON user_subscriptions(billing_subscription_id)
  WHERE billing_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subs_order_id
  ON user_subscriptions(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_subs_order_id
  ON studio_subscriptions(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
