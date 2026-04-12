-- ============================================================
-- Migration 034: Allow multiple active subscriptions per user+type
-- Drops legacy uniqueness constraint that prevented stacking
-- ============================================================

DO $$
BEGIN
  -- Drop the legacy constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_user_subs_active_type'
      AND table_name = 'user_subscriptions'
  ) THEN
    ALTER TABLE user_subscriptions
      DROP CONSTRAINT uq_user_subs_active_type;
  END IF;
END$$;

-- In case it was created as a unique index instead of a constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_user_subs_active_type'
  ) THEN
    EXECUTE 'DROP INDEX uq_user_subs_active_type';
  END IF;
END$$;

-- Done
