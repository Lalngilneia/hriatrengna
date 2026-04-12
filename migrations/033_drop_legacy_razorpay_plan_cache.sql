-- Migration 033: retire legacy Razorpay subscription-plan cache
-- Orders API is now the only supported billing flow.

DROP TABLE IF EXISTS razorpay_plan_cache;
