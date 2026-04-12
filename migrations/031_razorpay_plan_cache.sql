-- ============================================================
-- Migration 031: Razorpay Plan Cache
-- Caches dynamically-created Razorpay plan IDs by amount
-- so we never create duplicate plans and avoid race conditions.
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS razorpay_plan_cache (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The key: what uniquely identifies a Razorpay plan
  plan_type        VARCHAR(20)  NOT NULL CHECK (plan_type IN ('memorial','wedding')),
  length_months    INTEGER      NOT NULL,
  amount_paise     INTEGER      NOT NULL,   -- total monthly paise (base + addons)
  -- The value: the Razorpay plan ID to reuse
  razorpay_plan_id TEXT         NOT NULL,
  -- Housekeeping
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  last_used_at     TIMESTAMPTZ  DEFAULT NOW(),
  use_count        INTEGER      DEFAULT 1,
  UNIQUE (plan_type, length_months, amount_paise)
);

CREATE INDEX IF NOT EXISTS idx_rzp_plan_cache_lookup
  ON razorpay_plan_cache (plan_type, length_months, amount_paise);

COMMENT ON TABLE razorpay_plan_cache IS
  'Caches Razorpay plan IDs for dynamic subscription amounts. '
  'Keyed by (plan_type, length_months, amount_paise). '
  'Avoids creating a new Razorpay plan for every checkout and '
  'eliminates the plan-not-indexed race condition.';
