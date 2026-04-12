-- ============================================================
-- Migration 026: Studio Billing & Entitlement Refactor
-- - Adds studio_subscriptions (studio-scoped billing)
-- - Adds studio_invites (email token invite flow)
-- - Adds album_client_access (scoped client access, no b2b bleed)
-- - Adds studio_audit_log
-- - Adds studio_usage_events
-- - Adds product_type column to pricing_plans
-- ============================================================

-- ── 1. Add product_type to pricing_plans ──────────────────────
ALTER TABLE pricing_plans
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(30) DEFAULT 'consumer_memorial';

UPDATE pricing_plans SET product_type = 'consumer_wedding'
  WHERE slug LIKE 'wedding%' AND product_type = 'consumer_memorial';

-- ── 2. Studio Subscriptions (studio-scoped, not user-scoped) ──
CREATE TABLE IF NOT EXISTS studio_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id                 UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  plan_slug                 VARCHAR(100) NOT NULL,
  status                    VARCHAR(50)  NOT NULL DEFAULT 'pending',
  razorpay_subscription_id  TEXT UNIQUE,
  razorpay_order_id         TEXT,
  album_quota               INTEGER NOT NULL DEFAULT 10,
  seat_quota                INTEGER NOT NULL DEFAULT 5,
  branding_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  custom_domain_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  whitelabel_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN DEFAULT FALSE,
  grace_period_until        TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_subs_studio   ON studio_subscriptions(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_subs_rzp      ON studio_subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_studio_subs_status   ON studio_subscriptions(status);

-- ── 3. Studio Invites (email token flow) ──────────────────────
CREATE TABLE IF NOT EXISTS studio_invites (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id    UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  email        VARCHAR(255) NOT NULL,
  role         VARCHAR(50)  NOT NULL DEFAULT 'photographer',
  token        TEXT UNIQUE NOT NULL,
  invited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(studio_id, email)
);

CREATE INDEX IF NOT EXISTS idx_studio_invites_token  ON studio_invites(token);
CREATE INDEX IF NOT EXISTS idx_studio_invites_studio ON studio_invites(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_invites_email  ON studio_invites(email);

-- ── 4. Album Client Access ────────────────────────────────────
-- Replaces the b2b ownership-transfer pattern.
-- Claimed clients get a scoped access record here, NOT user_id ownership.
CREATE TABLE IF NOT EXISTS album_client_access (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id   UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role       VARCHAR(50) NOT NULL DEFAULT 'client_viewer',
  -- 'client_viewer'  = read + add wishes
  -- 'client_editor'  = read + upload media + edit album details
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(album_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_album_client_access_album ON album_client_access(album_id);
CREATE INDEX IF NOT EXISTS idx_album_client_access_user  ON album_client_access(user_id);

-- ── 5. Studio Audit Log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS studio_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id   UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(255) NOT NULL,
  target_type VARCHAR(100),
  target_id   TEXT,
  details     JSONB,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_audit_studio  ON studio_audit_log(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_audit_created ON studio_audit_log(created_at DESC);

-- ── 6. Studio Usage Events ────────────────────────────────────
CREATE TABLE IF NOT EXISTS studio_usage_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id  UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  -- album_created | album_deleted | seat_added | seat_removed
  -- subscription_activated | subscription_cancelled
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_usage_studio  ON studio_usage_events(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_usage_created ON studio_usage_events(created_at DESC);

-- ── 7. Studio Pricing Plans ───────────────────────────────────
INSERT INTO pricing_plans
  (name, slug, product_type, price_inr, interval, interval_count,
   features, max_photos, max_videos, max_albums, is_active, is_featured, sort_order)
VALUES
  ('Studio Starter', 'studio-starter', 'studio_photographer',
   299900, 'monthly', 1,
   '["10 client album slots","5 team seats","Studio branding on albums","Bulk QR PDF export","Email support"]',
   9999, 9999, 10, TRUE, FALSE, 10),
  ('Studio Pro', 'studio-pro', 'studio_photographer',
   599900, 'monthly', 1,
   '["20 active client albums","5 team seats","Custom domain","White-label albums","Priority support","Album customizer"]',
   9999, 9999, 20, TRUE, TRUE, 11),
  ('Studio Agency', 'studio-agency', 'studio_photographer',
   999900, 'monthly', 1,
   '["50 active client albums","12 team seats","White-label","Custom domain","Dedicated support","API access"]',
   9999, 9999, 50, TRUE, FALSE, 12)
ON CONFLICT (slug) DO NOTHING;

-- ── 8. Triggers ───────────────────────────────────────────────
CREATE TRIGGER studio_subs_updated_at
  BEFORE UPDATE ON studio_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
