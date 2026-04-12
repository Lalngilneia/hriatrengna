-- MemorialQR Migration 005: Plan Media Limits
-- Run after 004_new_features.sql
-- psql -U memorialqr_user -d memorialqr -h localhost -f 005_plan_media_limits.sql

UPDATE pricing_plans
SET
  features = '["1 memorial album","200 photos","10 videos","Unlimited tributes","QR code included","Email support","Cancel any time"]'::jsonb,
  max_photos = 200,
  max_videos = 10,
  updated_at = NOW()
WHERE slug = 'monthly';

UPDATE pricing_plans
SET
  features = '["1 memorial album","500 photos","30 videos","Unlimited tributes","QR code + print-ready PDF","Priority support","90-day cancellation notice"]'::jsonb,
  max_photos = 500,
  max_videos = 30,
  updated_at = NOW()
WHERE slug = 'yearly';

UPDATE pricing_plans
SET
  features = '["1 memorial album","2000 photos","50 videos","10-year preservation","QR code & NFC support","PDF plaque designer","Priority support"]'::jsonb,
  max_photos = 2000,
  max_videos = 50,
  updated_at = NOW()
WHERE slug = 'lifetime';
