-- Migration 035: Fix album_quota for existing subscriptions
-- Run after: 034_allow_multiple_user_subscriptions.sql
-- Safe to re-run: all statements use UPDATE with proper conditions

-- First, let's see what we're dealing with
-- SELECT id, user_id, plan_type, status, album_quota FROM user_subscriptions;

-- Fix: Ensure album_quota is at least 1 for all active subscriptions
-- This is needed because the syncLegacyConsumerSubscription function was not
-- updating album_quota in the UPDATE path (only INSERT path had it hardcoded to 1)
UPDATE user_subscriptions
SET album_quota = 1
WHERE (album_quota IS NULL OR album_quota < 1)
  AND status IN ('active', 'trialing', 'pending');

-- Also fix past_due and other statuses that should have valid album_quota
UPDATE user_subscriptions
SET album_quota = COALESCE(album_quota, 1)
WHERE album_quota IS NULL;

-- Verify the fix
-- SELECT id, plan_type, status, album_quota FROM user_subscriptions ORDER BY user_id, plan_type;
-- Should show album_quota = 1 for all rows
