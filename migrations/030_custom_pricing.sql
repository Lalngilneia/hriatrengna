-- ============================================================
-- Migration 030: Custom Pricing Overhaul
-- Replaces fixed-tier consumer plans with a fully configurable
-- subscription model for Memorial and Wedding products.
--
-- Run after: 029_refund_requests.sql
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT
-- ============================================================

-- ── 0. Ensure user_subscriptions exists (table is live on server
--       but was never committed to migrations — this is safe with
--       IF NOT EXISTS on all columns) ──────────────────────────
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_slug                 VARCHAR(100) NOT NULL,
  plan_type                 VARCHAR(20)  NOT NULL DEFAULT 'memorial'
                              CHECK (plan_type IN ('memorial','wedding')),
  status                    VARCHAR(50)  NOT NULL DEFAULT 'pending',
  razorpay_subscription_id  TEXT UNIQUE,
  razorpay_order_id         TEXT,
  album_quota               INTEGER      NOT NULL DEFAULT 1,
  current_period_end        TIMESTAMPTZ,
  lifetime_expires_at       TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN      DEFAULT FALSE,
  grace_period_until        TIMESTAMPTZ,
  created_at                TIMESTAMPTZ  DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subs_user
  ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subs_rzp
  ON user_subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subs_status
  ON user_subscriptions(user_id, plan_type, status);

DROP TRIGGER IF EXISTS user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 0b. Widen transactions.plan — VARCHAR(20) is too narrow ──
ALTER TABLE transactions
  ALTER COLUMN plan TYPE VARCHAR(50);

-- ── 1. Add config_id + payment_mode to user_subscriptions ────
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS config_id    UUID,      -- FK added after table created below
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'monthly'
    CHECK (payment_mode IN ('monthly','upfront'));

-- ── 2. subscription_configs ───────────────────────────────────
-- Stores each user's custom plan configuration at purchase time.
-- Pricing is snapshotted so historical records are always accurate
-- even if admin later changes base_pricing or addon_pricing.
CREATE TABLE IF NOT EXISTS subscription_configs (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type                  VARCHAR(20) NOT NULL
                               CHECK (plan_type IN ('memorial','wedding')),

  -- Subscription length
  length_months              INTEGER NOT NULL
                               CHECK (length_months IN (1,3,6,12,24,36,60)),

  -- Base limits included in plan
  base_photos                INTEGER NOT NULL DEFAULT 100,
  base_videos                INTEGER NOT NULL DEFAULT 3,

  -- Add-on quantities chosen by customer
  extra_photo_packs          INTEGER NOT NULL DEFAULT 0 CHECK (extra_photo_packs >= 0),
  extra_video_packs          INTEGER NOT NULL DEFAULT 0 CHECK (extra_video_packs >= 0),
  audio_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  themes_enabled             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Computed limits (denormalised for fast enforcement)
  total_photos               INTEGER NOT NULL,
  total_videos               INTEGER NOT NULL,

  -- Pricing snapshot in paise (at time of purchase)
  base_price_monthly_paise   INTEGER NOT NULL CHECK (base_price_monthly_paise > 0),
  addon_price_monthly_paise  INTEGER NOT NULL DEFAULT 0 CHECK (addon_price_monthly_paise >= 0),
  total_monthly_paise        INTEGER NOT NULL CHECK (total_monthly_paise > 0),
  length_discount_pct        NUMERIC(5,2) NOT NULL DEFAULT 0
                               CHECK (length_discount_pct >= 0 AND length_discount_pct <= 100),
  upfront_discount_pct       NUMERIC(5,2) NOT NULL DEFAULT 0
                               CHECK (upfront_discount_pct >= 0 AND upfront_discount_pct <= 100),
  total_charged_paise        INTEGER NOT NULL CHECK (total_charged_paise > 0),

  -- Payment mode
  payment_mode               VARCHAR(20) NOT NULL DEFAULT 'monthly'
                               CHECK (payment_mode IN ('monthly','upfront')),

  -- Admin override fields (set manually by admin, NULL = no override)
  override_photos            INTEGER,
  override_videos            INTEGER,
  override_audio             BOOLEAN,
  override_themes            BOOLEAN,
  override_expiry            TIMESTAMPTZ,
  override_note              TEXT,
  overridden_by              UUID REFERENCES admins(id) ON DELETE SET NULL,
  overridden_at              TIMESTAMPTZ,

  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_configs_user
  ON subscription_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_configs_user_type
  ON subscription_configs(user_id, plan_type);

DROP TRIGGER IF EXISTS subscription_configs_updated_at ON subscription_configs;
CREATE TRIGGER subscription_configs_updated_at
  BEFORE UPDATE ON subscription_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Now add the FK from user_subscriptions → subscription_configs
-- (safe to re-run: ADD CONSTRAINT IF NOT EXISTS requires Postgres 9.6+,
--  so we drop+add pattern is safer across versions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_user_subs_config'
      AND table_name = 'user_subscriptions'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT fk_user_subs_config
      FOREIGN KEY (config_id) REFERENCES subscription_configs(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- ── 3. base_pricing ───────────────────────────────────────────
-- Admin-editable base prices per plan_type + length_months.
-- Prices are stored in paise (integer) to avoid float rounding.
-- All monthly rates are pre-floored at seed time.
CREATE TABLE IF NOT EXISTS base_pricing (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_type                  VARCHAR(20) NOT NULL
                               CHECK (plan_type IN ('memorial','wedding')),
  length_months              INTEGER NOT NULL
                               CHECK (length_months IN (1,3,6,12,24,36,60)),
  discount_pct               NUMERIC(5,2) NOT NULL
                               CHECK (discount_pct >= 0 AND discount_pct <= 100),
  -- monthly_rate_paise is FLOOR(base * (1 - discount_pct/100)) * 100
  -- computed and floored at seed/update time — never derived at runtime
  monthly_rate_paise         INTEGER NOT NULL CHECK (monthly_rate_paise > 0),
  is_active                  BOOLEAN DEFAULT TRUE,
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_by                 UUID REFERENCES admins(id) ON DELETE SET NULL,
  UNIQUE (plan_type, length_months)
);

DROP TRIGGER IF EXISTS base_pricing_updated_at ON base_pricing;
CREATE TRIGGER base_pricing_updated_at
  BEFORE UPDATE ON base_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed base_pricing
-- Memorial base: ₹499/mo = 49900 paise
-- Wedding base:  ₹699/mo = 69900 paise
-- Formula: FLOOR(base_paise * (1 - discount/100)) — no fractional paise
INSERT INTO base_pricing (plan_type, length_months, discount_pct, monthly_rate_paise) VALUES
  -- Memorial
  ('memorial',  1,  0.00, 49900),   -- ₹499.00
  ('memorial',  3,  5.00, 47400),   -- FLOOR(499 * 0.95)  = FLOOR(474.05)  = 474 → 47400
  ('memorial',  6, 10.00, 44900),   -- FLOOR(499 * 0.90)  = FLOOR(449.10)  = 449 → 44900
  ('memorial', 12, 15.00, 42400),   -- FLOOR(499 * 0.85)  = FLOOR(424.15)  = 424 → 42400
  ('memorial', 24, 20.00, 39900),   -- FLOOR(499 * 0.80)  = FLOOR(399.20)  = 399 → 39900
  ('memorial', 36, 25.00, 37400),   -- FLOOR(499 * 0.75)  = FLOOR(374.25)  = 374 → 37400
  ('memorial', 60, 30.00, 34900),   -- FLOOR(499 * 0.70)  = FLOOR(349.30)  = 349 → 34900
  -- Wedding
  ('wedding',   1,  0.00, 69900),   -- ₹699.00
  ('wedding',   3,  5.00, 66400),   -- FLOOR(699 * 0.95)  = FLOOR(664.05)  = 664 → 66400
  ('wedding',   6, 10.00, 62900),   -- FLOOR(699 * 0.90)  = FLOOR(629.10)  = 629 → 62900
  ('wedding',  12, 15.00, 59400),   -- FLOOR(699 * 0.85)  = FLOOR(594.15)  = 594 → 59400
  ('wedding',  24, 20.00, 55900),   -- FLOOR(699 * 0.80)  = FLOOR(559.20)  = 559 → 55900
  ('wedding',  36, 25.00, 52400),   -- FLOOR(699 * 0.75)  = FLOOR(524.25)  = 524 → 52400
  ('wedding',  60, 30.00, 48900)    -- FLOOR(699 * 0.70)  = FLOOR(489.30)  = 489 → 48900
ON CONFLICT (plan_type, length_months) DO NOTHING;

-- ── 4. addon_pricing ─────────────────────────────────────────
-- Admin-editable add-on prices. Keyed by slug.
-- Recurring add-ons: photo_pack, video_pack, audio_toggle, themes_toggle
-- One-time add-ons:  qr_print, nfc_tag (handled via physical_orders)
CREATE TABLE IF NOT EXISTS addon_pricing (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(50) UNIQUE NOT NULL,
  label        TEXT NOT NULL,
  price_paise  INTEGER NOT NULL CHECK (price_paise >= 0),
  unit         VARCHAR(100),
  is_recurring BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = one-time physical
  is_active    BOOLEAN DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_by   UUID REFERENCES admins(id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS addon_pricing_updated_at ON addon_pricing;
CREATE TRIGGER addon_pricing_updated_at
  BEFORE UPDATE ON addon_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO addon_pricing (key, label, price_paise, unit, is_recurring) VALUES
  ('photo_pack',    '+10 Photos Pack',        1900,  'per pack / month',  TRUE),
  ('video_pack',    '+3 Videos Pack',          5900,  'per pack / month',  TRUE),
  ('audio_toggle',  'Audio Uploads',           4900,  'per month',         TRUE),
  ('themes_toggle', 'Extra Themes',            4900,  'per month',         TRUE),
  ('qr_print',      'Physical QR Code Print', 29900,  'one-time',          FALSE),
  ('nfc_tag',       'Physical NFC Tag',       29900,  'one-time',          FALSE)
ON CONFLICT (key) DO NOTHING;

-- ── 5. physical_orders ────────────────────────────────────────
-- Tracks Physical QR and NFC print orders.
-- These are one-time Razorpay Orders, manually fulfilled by admin.
CREATE TABLE IF NOT EXISTS physical_orders (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id              UUID REFERENCES albums(id) ON DELETE SET NULL,
  order_type            VARCHAR(20) NOT NULL
                          CHECK (order_type IN ('qr_print','nfc_tag')),

  -- Pricing snapshot
  amount_paise          INTEGER NOT NULL DEFAULT 29900,

  -- Razorpay
  razorpay_order_id     TEXT UNIQUE,
  razorpay_payment_id   TEXT UNIQUE,
  payment_status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (payment_status IN ('pending','paid','failed','refunded')),

  -- Shipping address (required at purchase)
  shipping_name         TEXT NOT NULL,
  shipping_phone        TEXT NOT NULL,
  shipping_address_1    TEXT NOT NULL,
  shipping_address_2    TEXT,
  shipping_city         TEXT NOT NULL,
  shipping_state        TEXT NOT NULL,
  shipping_pincode      TEXT NOT NULL,

  -- Fulfillment (managed by admin)
  fulfillment_status    VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (fulfillment_status IN
                            ('pending','processing','shipped','delivered','cancelled')),
  tracking_number       TEXT,
  tracking_carrier      TEXT,
  admin_notes           TEXT,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physical_orders_user
  ON physical_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_physical_orders_fulfillment
  ON physical_orders(fulfillment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_physical_orders_payment
  ON physical_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_physical_orders_rzp_order
  ON physical_orders(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

DROP TRIGGER IF EXISTS physical_orders_updated_at ON physical_orders;
CREATE TRIGGER physical_orders_updated_at
  BEFORE UPDATE ON physical_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 6. Deactivate old consumer pricing plans ──────────────────
-- Keeps rows for transaction history and studio plan lookups.
-- Studio plans (product_type = 'studio_*') are NOT touched.
UPDATE pricing_plans
  SET is_active = FALSE, is_featured = FALSE, updated_at = NOW()
WHERE slug IN (
  'memorial-basic','memorial-standard','memorial-premium',
  'wedding-basic','wedding-classic','wedding-premium',
  'monthly','yearly','lifetime','wedding-lifetime'
)
  AND (product_type IS NULL
       OR product_type IN ('consumer_memorial','consumer_wedding'));

-- ── 7. admin_log entries for audit trail ─────────────────────
-- No data inserted here — admin_log is written at runtime.
-- Reminder: every addon_pricing and base_pricing update must
-- INSERT into admin_log (handled in admin.controller.js).

-- ── Done ─────────────────────────────────────────────────────
-- Tables created:  subscription_configs, base_pricing,
--                  addon_pricing, physical_orders
-- Tables altered:  user_subscriptions (+config_id, +payment_mode)
--                  transactions (plan widened to VARCHAR(50))
-- Plans deactivated: all consumer pricing_plans slugs
