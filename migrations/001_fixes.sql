-- MemorialQR Migration 001: Bug Fixes
-- Run: psql -U memorialqr_user -d memorialqr -h localhost -f 001_fixes.sql

-- FIX: Allow NULL password_hash for Google OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- FIX: Add grace period column for failed Razorpay payments
ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ;

-- FIX: Ensure google_id column exists (schema v2 has it, but just in case)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id) WHERE google_id IS NOT NULL;

-- FIX: Ensure token_version exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- FIX: Ensure albums has updated_at
ALTER TABLE albums ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE albums ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS death_date DATE;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS cover_key TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
