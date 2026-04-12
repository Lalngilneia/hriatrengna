-- ────────────────────────────────────────────────────────────────
-- Migration 021: New Pricing Plan Structure
-- Memorial: Basic (₹499/mo), Standard (₹3499/yr), Premium (₹14999 one-time)
-- Wedding:  Basic (₹999/6mo), Classic (₹4599/yr), Premium (₹24999 one-time)
-- Removes: monthly, yearly, lifetime, wedding-lifetime slugs (deactivated)
-- ────────────────────────────────────────────────────────────────

-- ── 1. Add max_albums column (if not already present) ───────────
ALTER TABLE pricing_plans
  ADD COLUMN IF NOT EXISTS max_albums INTEGER DEFAULT 1;

-- ── 2. Add plan_type column to distinguish memorial vs wedding ──
ALTER TABLE pricing_plans
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'memorial'
    CHECK (plan_type IN ('memorial', 'wedding'));

-- ── 3. Deactivate all old plans (preserve for transaction history)
UPDATE pricing_plans
  SET is_active = FALSE, is_featured = FALSE
  WHERE slug IN ('monthly','yearly','lifetime','wedding-basic','wedding-classic','wedding-premium','wedding-lifetime');

-- ── 4. Insert new Memorial plans ────────────────────────────────
INSERT INTO pricing_plans
  (name, slug, plan_type, price_inr, interval, interval_count,
   features, max_photos, max_videos, max_albums, is_active, is_featured, sort_order)
VALUES (
  'Basic',
  'memorial-basic',
  'memorial',
  49900,       -- ₹499 in paise
  'monthly',
  1,
  '["1 Memorial Album","100 Photos","5 Videos","Unlimited Tributes","QR Code","Email Support","Cancel any time"]'::jsonb,
  100, 5, 1,
  TRUE, FALSE, 10
),
(
  'Standard',
  'memorial-standard',
  'memorial',
  349900,      -- ₹3,499 in paise
  'yearly',
  12,
  '["1 Memorial Album","200 Photos","10 Videos","Unlimited Tributes","QR Code + Print-Ready PDF","Email Support","90-Day Cancellation Notice","Save vs monthly"]'::jsonb,
  200, 10, 1,
  TRUE, TRUE, 11   -- featured
),
(
  'Premium',
  'memorial-premium',
  'memorial',
  1499900,     -- ₹14,999 in paise
  'one_time',
  1,
  '["Multiple Memorial Albums","1,000 Photos","30 Videos","10-Year Preservation","QR Code & NFC Support","PDF Plaque Designer","Priority Support","No Renewals Ever"]'::jsonb,
  1000, 30, 3,   -- starts with 3 albums; user can add more
  TRUE, FALSE, 12
)
ON CONFLICT (slug) DO UPDATE SET
  name           = EXCLUDED.name,
  plan_type      = EXCLUDED.plan_type,
  price_inr      = EXCLUDED.price_inr,
  interval       = EXCLUDED.interval,
  interval_count = EXCLUDED.interval_count,
  features       = EXCLUDED.features,
  max_photos     = EXCLUDED.max_photos,
  max_videos     = EXCLUDED.max_videos,
  max_albums     = EXCLUDED.max_albums,
  is_active      = EXCLUDED.is_active,
  is_featured    = EXCLUDED.is_featured,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

-- ── 5. Insert new Wedding plans ──────────────────────────────────
INSERT INTO pricing_plans
  (name, slug, plan_type, price_inr, interval, interval_count,
   features, max_photos, max_videos, max_albums, is_active, is_featured, sort_order)
VALUES (
  'Wedding Basic',
  'wedding-basic',
  'wedding',
  99900,       -- ₹999 in paise
  'half_yearly',
  6,
  '["1 Wedding Album","100 Photos","5 Videos (100MB each)","Guest Wishes","1 Theme","QR Code","6-Month Access"]'::jsonb,
  100, 5, 1,
  TRUE, FALSE, 20
),
(
  'Wedding Classic',
  'wedding-classic',
  'wedding',
  459900,      -- ₹4,599 in paise
  'yearly',
  12,
  '["3 Wedding Albums","200 Photos","20 Videos (100MB each)","Guest Wishes + Video Wishes","All Themes","QR Code + Print PDF","2-Year Access"]'::jsonb,
  200, 20, 3,
  TRUE, TRUE, 21   -- featured
),
(
  'Wedding Premium',
  'wedding-premium',
  'wedding',
  2499900,     -- ₹24,999 in paise
  'one_time',
  1,
  '["10 Wedding Albums","1,000 Photos","50 Videos (200MB each)","Guest Wishes + Video Wishes","All Themes","QR Code + Print PDF","10-Year Access","Priority Support"]'::jsonb,
  1000, 50, 10,
  TRUE, FALSE, 22
)
ON CONFLICT (slug) DO UPDATE SET
  name           = EXCLUDED.name,
  plan_type      = EXCLUDED.plan_type,
  price_inr      = EXCLUDED.price_inr,
  interval       = EXCLUDED.interval,
  interval_count = EXCLUDED.interval_count,
  features       = EXCLUDED.features,
  max_photos     = EXCLUDED.max_photos,
  max_videos     = EXCLUDED.max_videos,
  max_albums     = EXCLUDED.max_albums,
  is_active      = EXCLUDED.is_active,
  is_featured    = EXCLUDED.is_featured,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

-- ── 6. Migrate existing active users to closest new plan ─────────
-- Users on old 'monthly' → 'memorial-basic'
-- Users on old 'yearly'  → 'memorial-standard'
-- Users on old 'lifetime'→ 'memorial-premium'
-- (wedding users keep existing slugs which are now deactivated but still work)
UPDATE users SET subscription_plan = 'memorial-basic'    WHERE subscription_plan = 'monthly'  AND subscription_status = 'active';
UPDATE users SET subscription_plan = 'memorial-standard' WHERE subscription_plan = 'yearly'   AND subscription_status = 'active';
UPDATE users SET subscription_plan = 'memorial-premium'  WHERE subscription_plan = 'lifetime' AND subscription_status IN ('active','lifetime');
