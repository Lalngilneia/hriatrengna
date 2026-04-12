-- Migration 010: Invoice fixes
-- Run: psql -h 127.0.0.1 -U memorialqr_user -d memorialqr -f 010_invoice_fixes.sql

-- 1. Add description column if not exists (stores human-readable plan name)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Ensure unique index exists on transaction_id so ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS invoices_transaction_id_unique ON invoices(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- 3. Backfill description from plan slug for existing invoices
UPDATE invoices SET description = CASE
  WHEN plan = 'lifetime'         THEN 'Memorial Lifetime Plan'
  WHEN plan = 'wedding-lifetime' THEN 'Wedding Lifetime Plan'
  WHEN plan = 'wedding-premium'  THEN 'Wedding Premium Plan'
  WHEN plan = 'wedding-classic'  THEN 'Wedding Classic Plan'
  WHEN plan = 'wedding-basic'    THEN 'Wedding Basic Plan'
  WHEN plan = 'yearly'           THEN 'Memorial Yearly Plan'
  WHEN plan = 'monthly'          THEN 'Memorial Monthly Plan'
  ELSE 'Hriatrengna Subscription'
END
WHERE description IS NULL;

-- 4. Fix any ₹0 invoices by joining to transactions table for the real amount
UPDATE invoices i
SET amount_inr = t.amount_inr
FROM transactions t
WHERE i.transaction_id = t.id
  AND (i.amount_inr = 0 OR i.amount_inr IS NULL)
  AND t.amount_inr > 0;

-- 5. Verify
SELECT invoice_number, amount_inr, plan, description FROM invoices ORDER BY created_at DESC LIMIT 10;
