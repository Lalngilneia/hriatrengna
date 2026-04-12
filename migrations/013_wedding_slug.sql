-- Add wedding_slug column to users for subscriber-level QR code
ALTER TABLE users ADD COLUMN IF NOT EXISTS wedding_slug VARCHAR(255);
