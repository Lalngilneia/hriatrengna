-- MemorialQR Migration 008: Wedding Album Support
-- Run: psql $DATABASE_URL -f migrations/008_wedding_albums.sql

-- ── ALBUM COLLECTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS album_collections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(50)  DEFAULT 'wedding',
  slug        VARCHAR(255) UNIQUE,
  cover_key   TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS album_collections_user_idx ON album_collections(user_id);

-- ── WEDDING FIELDS ON ALBUMS ──────────────────────────────────
ALTER TABLE albums ADD COLUMN IF NOT EXISTS wedding_date       DATE;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS partner1_name      VARCHAR(255);
ALTER TABLE albums ADD COLUMN IF NOT EXISTS partner2_name      VARCHAR(255);
ALTER TABLE albums ADD COLUMN IF NOT EXISTS venue_name         VARCHAR(255);
ALTER TABLE albums ADD COLUMN IF NOT EXISTS collection_id      UUID REFERENCES album_collections(id) ON DELETE SET NULL;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS album_label        VARCHAR(100); -- 'pre-wedding','ceremony','reception','honeymoon','anniversary'

-- ── GUEST WISHES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_wishes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id     UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  guest_name   VARCHAR(255),
  guest_email  VARCHAR(255),
  message      TEXT NOT NULL,
  video_key    TEXT,
  video_size   BIGINT,
  status       VARCHAR(20) DEFAULT 'pending', -- pending | approved | rejected
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS guest_wishes_album_idx  ON guest_wishes(album_id);
CREATE INDEX IF NOT EXISTS guest_wishes_status_idx ON guest_wishes(album_id, status);

-- ── WEDDING PRICING PLANS ────────────────────────────────────
-- These are separate from memorial plans
INSERT INTO pricing_plans
  (name, slug, price_inr, interval, interval_count, features, max_photos, max_videos, is_featured, sort_order, is_active)
VALUES
  ('Wedding Basic', 'wedding-basic', 99900, 'yearly', 12,
   '["1 wedding album","200 photos","5 videos (50MB each)","Guest wishes","1 theme","QR code","1 year access"]',
   200, 5, FALSE, 10, TRUE),
  ('Wedding Classic', 'wedding-classic', 249900, 'yearly', 12,
   '["3 linked albums (pre-shoot, wedding, honeymoon)","1,000 photos","20 videos (100MB each)","Guest wishes + video wishes","All themes","QR code + print PDF","2 years access"]',
   1000, 20, TRUE, 11, TRUE),
  ('Wedding Premium', 'wedding-premium', 999900, 'yearly', 12,
   '["Unlimited albums","5,000 photos","100 videos (200MB each)","Guest wishes + video wishes","All themes","Custom QR code","Priority support","5 years access"]',
   5000, 100, FALSE, 12, TRUE),
  ('Wedding Lifetime', 'wedding-lifetime', 1999900, 'lifetime', 1,
   '["Unlimited albums","10,000 photos","200 videos (200MB each)","Guest wishes + video wishes","All 6 themes","Custom QR code","Priority support","10 years preservation"]',
   10000, 200, FALSE, 13, TRUE)
ON CONFLICT (slug) DO NOTHING;
