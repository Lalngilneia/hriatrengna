-- Migration 011: Fix album_quota to match plan slug
-- Existing subscribers may have quota=1 due to old Razorpay quantity logic.
-- This sets the correct quota based on each user's subscription_plan.
-- Run: psql -h 127.0.0.1 -U memorialqr_user -d memorialqr -f 011_fix_album_quota_by_plan.sql

UPDATE users SET album_quota =
  CASE subscription_plan
    WHEN 'wedding-classic'  THEN 3
    WHEN 'wedding-premium'  THEN 99
    WHEN 'wedding-lifetime' THEN 99
    WHEN 'lifetime'         THEN 99
    WHEN 'b2b'              THEN 99
    ELSE 1  -- monthly, yearly, wedding-basic all get 1
  END
WHERE subscription_status IN ('active','trialing','lifetime','b2b');

-- Verify
SELECT subscription_plan, album_quota, COUNT(*) as users
FROM users
WHERE subscription_status IN ('active','trialing','lifetime','b2b')
GROUP BY subscription_plan, album_quota
ORDER BY subscription_plan;
