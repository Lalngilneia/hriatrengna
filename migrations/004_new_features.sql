-- MemorialQR Migration 004: New Features
-- Run AFTER 001, 002, 003
-- psql -U memorialqr_user -d memorialqr -h localhost -f 004_new_features.sql

-- ─────────────────────────────────────────────────────────────
-- ALBUM ENHANCEMENTS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE albums ADD COLUMN IF NOT EXISTS theme                  VARCHAR(50)  DEFAULT 'classic';
ALTER TABLE albums ADD COLUMN IF NOT EXISTS background_music_key   TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS background_music_name  TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_password_protected  BOOLEAN      DEFAULT FALSE;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS password_hash          TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS language               VARCHAR(10)  DEFAULT 'en';
ALTER TABLE albums ADD COLUMN IF NOT EXISTS heir_email             TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS nfc_uid                TEXT;

-- ─────────────────────────────────────────────────────────────
-- LIFE EVENTS / TIMELINE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS life_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id       UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  event_date     DATE,
  event_year     INTEGER,
  icon           VARCHAR(50)  DEFAULT 'star',
  display_order  INTEGER      DEFAULT 0,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS life_events_album_idx ON life_events(album_id);

-- ─────────────────────────────────────────────────────────────
-- VISITOR ANALYTICS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS album_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id    UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  visitor_ip  TEXT,
  city        TEXT,
  country     TEXT,
  device      TEXT,
  referrer    TEXT,
  viewed_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS album_views_album_idx   ON album_views(album_id);
CREATE INDEX IF NOT EXISTS album_views_date_idx    ON album_views(viewed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- LIFETIME PLAN (10-year one-time purchase)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_expires_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS razorpay_order_id    TEXT;

-- Add lifetime plan to pricing_plans if not already present
INSERT INTO pricing_plans (name, slug, price_inr, interval, interval_count, features, max_photos, max_videos, is_active, is_featured, sort_order)
VALUES (
  'Lifetime',
  'lifetime',
  1499900,  -- ₹14,999 in paise
  'one_time',
  1,
  '["1 memorial album","2000 photos","50 videos","10-year preservation","QR code & NFC support","PDF plaque designer","Priority support"]'::jsonb,
  2000,
  50,
  TRUE,
  TRUE,   -- featured plan
  3
)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- B2B / BUSINESS ACCOUNTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  contact_name  VARCHAR(255),
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  address       TEXT,
  gstin         VARCHAR(20),
  album_quota   INTEGER     DEFAULT 10,
  albums_used   INTEGER     DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'active',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users   ADD COLUMN IF NOT EXISTS business_id          UUID REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE albums  ADD COLUMN IF NOT EXISTS assigned_by_business UUID REFERENCES businesses(id) ON DELETE SET NULL;

-- Auto-update updated_at on businesses (reuses function from original schema)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'businesses_updated_at'
  ) THEN
    CREATE TRIGGER businesses_updated_at
      BEFORE UPDATE ON businesses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- ALBUM GIFTING
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gifter_name         VARCHAR(255),
  gifter_email        VARCHAR(255),
  recipient_email     VARCHAR(255) NOT NULL,
  plan                VARCHAR(20)  DEFAULT 'yearly',
  amount_inr          NUMERIC(10,2),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  status              VARCHAR(20)  DEFAULT 'pending',
  redeem_token        TEXT UNIQUE,
  redeemed_by_user    UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ  DEFAULT (NOW() + INTERVAL '1 year'),
  message             TEXT,
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PHYSICAL PRODUCT UPSELL
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  album_id          UUID REFERENCES albums(id) ON DELETE SET NULL,
  product_type      VARCHAR(50),
  quantity          INTEGER      DEFAULT 1,
  amount_inr        NUMERIC(10,2),
  razorpay_order_id TEXT,
  status            VARCHAR(20)  DEFAULT 'pending',
  shipping_name     VARCHAR(255),
  shipping_address  TEXT,
  shipping_phone    VARCHAR(20),
  tracking_number   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2FA (TOTP)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled  BOOLEAN DEFAULT FALSE;
