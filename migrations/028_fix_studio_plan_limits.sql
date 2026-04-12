-- ============================================================
-- Migration 028: Align Studio plan limits with current pricing
-- - Studio Pro    => 20 active client albums, 5 team seats
-- - Studio Agency => 50 active client albums, 12 team seats
-- ============================================================

-- Keep pricing_plans in sync for current and fresh billing surfaces.
UPDATE pricing_plans
SET
  features = '["20 active client albums","5 team seats","Custom domain","White-label albums","Priority support","Album customizer"]'::jsonb,
  max_albums = 20,
  updated_at = NOW()
WHERE slug = 'studio-pro';

UPDATE pricing_plans
SET
  features = '["50 active client albums","12 team seats","White-label","Custom domain","Dedicated support","API access"]'::jsonb,
  max_albums = 50,
  updated_at = NOW()
WHERE slug = 'studio-agency';

-- Fix existing subscriptions that were created with the older limits.
UPDATE studio_subscriptions
SET
  album_quota = 20,
  seat_quota = 5,
  updated_at = NOW()
WHERE plan_slug = 'studio-pro';

UPDATE studio_subscriptions
SET
  album_quota = 50,
  seat_quota = 12,
  updated_at = NOW()
WHERE plan_slug = 'studio-agency';

-- Sync studio.album_quota from the latest active/trialing subscription.
WITH latest_active AS (
  SELECT DISTINCT ON (studio_id)
    studio_id,
    album_quota
  FROM studio_subscriptions
  WHERE status IN ('active', 'trialing')
  ORDER BY studio_id, created_at DESC
)
UPDATE studios s
SET
  album_quota = la.album_quota,
  updated_at = NOW()
FROM latest_active la
WHERE s.id = la.studio_id;
