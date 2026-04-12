-- ============================================================
-- Migration 032: Prepaid Recharge Model
-- Removes the 'monthly' option from payment_mode constraints
-- since all consumer payments are now upfront Orders.
-- Safe to re-run.
-- ============================================================

-- Allow 'upfront' only going forward.
-- We keep 'monthly' in the CHECK so existing rows don't break.
-- The application layer simply never writes 'monthly' anymore.

-- subscription_configs: widen payment_mode to remove constraint
-- (we can't ALTER CHECK constraints directly in Postgres, so drop + add)
ALTER TABLE subscription_configs
  DROP CONSTRAINT IF EXISTS subscription_configs_payment_mode_check;

ALTER TABLE subscription_configs
  ADD CONSTRAINT subscription_configs_payment_mode_check
    CHECK (payment_mode IN ('monthly', 'upfront', 'prepaid'));

-- user_subscriptions: same
ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_payment_mode_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_payment_mode_check
    CHECK (payment_mode IN ('monthly', 'upfront', 'prepaid'));

-- ── Recover stuck payments ────────────────────────────────────
-- Run these manually with the actual payment IDs and user IDs.
-- Template (replace values before running):
--
-- UPDATE user_subscriptions
--   SET status = 'active',
--       current_period_end = NOW() + INTERVAL '1 month',
--       updated_at = NOW()
--   WHERE user_id = '<your-user-id>'
--     AND plan_type = 'memorial'
--     AND status != 'active';
--
-- UPDATE users
--   SET subscription_status = 'active',
--       memorial_plan = 'memorial-custom',
--       current_period_end = NOW() + INTERVAL '1 month',
--       grace_period_until = NULL
--   WHERE id = '<your-user-id>';
--
-- INSERT INTO transactions
--   (user_id, razorpay_payment_id, amount_paise, amount_inr,
--    status, plan, description)
-- VALUES
--   ('<your-user-id>', 'pay_SbtIiPlZHjFujs', 36708, '367.08',
--    'captured', 'memorial-custom', 'Memorial — 1 Month Recharge (manual recovery)'),
--   ('<your-user-id>', 'pay_Sc04zECETcnIxd', 36708, '367.08',
--    'captured', 'memorial-custom', 'Memorial — 1 Month Recharge (manual recovery)')
-- ON CONFLICT (razorpay_payment_id) DO NOTHING;
