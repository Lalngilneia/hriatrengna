-- ============================================================
-- MemorialQR Database Schema — v2
-- Includes: Razorpay (INR), Super Admin, App Settings
-- ============================================================
--
-- ⚠️  IMPORTANT — READ BEFORE RUNNING ON A FRESH SERVER
-- ─────────────────────────────────────────────────────
-- This file creates the BASE tables only (users, albums, media,
-- transactions, pricing_plans, admins, app_settings, email_log,
-- support inbox, admin_log).
--
-- Many production tables (user_subscriptions, subscription_configs,
-- base_pricing, addon_pricing, physical_orders, refund_requests,
-- invoices, studios, studio_subscriptions, affiliates, businesses,
-- and more) are created by the incremental migration files in:
--
--   backend/migrations/001_fixes.sql … 030_custom_pricing.sql
--
-- CORRECT setup order on a fresh server:
--   1. psql -U <user> -d <db> -f schema.sql
--   2. node backend/scripts/run-migrations.js
--
-- DO NOT skip step 2. The app will crash on startup if the
-- migration tables are missing.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ─────────────────────────────────────────────────────
CREATE TABLE users (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      VARCHAR(255) NOT NULL,
  email                     VARCHAR(255) UNIQUE NOT NULL,
  password_hash             TEXT NOT NULL,
  phone                     VARCHAR(20),
  is_email_verified         BOOLEAN DEFAULT FALSE,
  email_verify_token        TEXT,
  email_verify_expires      TIMESTAMPTZ,
  reset_token               TEXT,
  reset_token_expires       TIMESTAMPTZ,
  razorpay_customer_id      TEXT,
  subscription_status       VARCHAR(50) DEFAULT 'inactive',
  subscription_plan         VARCHAR(20),
  razorpay_subscription_id  TEXT,
  current_period_end        TIMESTAMPTZ,
  cancel_at_period_end      BOOLEAN DEFAULT FALSE,
  is_active                 BOOLEAN DEFAULT TRUE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUPER ADMINS ──────────────────────────────────────────────
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(50) DEFAULT 'super_admin',
  is_active     BOOLEAN DEFAULT TRUE,
  token_version INTEGER DEFAULT 0,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── APP SETTINGS ──────────────────────────────────────────────
CREATE TABLE app_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  type        VARCHAR(20) DEFAULT 'string',
  label       VARCHAR(255),
  description TEXT,
  group_name  VARCHAR(100) DEFAULT 'general',
  updated_by  UUID REFERENCES admins(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRICING PLANS ─────────────────────────────────────────────
CREATE TABLE pricing_plans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(100) NOT NULL,
  slug              VARCHAR(50) UNIQUE NOT NULL,
  price_inr         INTEGER NOT NULL,
  interval          VARCHAR(20) NOT NULL,
  interval_count    INTEGER DEFAULT 1,
  razorpay_plan_id  TEXT,
  features          JSONB DEFAULT '[]',
  max_photos        INTEGER DEFAULT 200,
  max_videos        INTEGER DEFAULT 10,
  is_active         BOOLEAN DEFAULT TRUE,
  is_featured       BOOLEAN DEFAULT FALSE,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── ALBUMS ────────────────────────────────────────────────────
CREATE TABLE albums (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  birth_year    VARCHAR(10),
  death_year    VARCHAR(10),
  biography     TEXT,
  type          VARCHAR(50) DEFAULT 'memorial',
  avatar_key    TEXT,
  cover_key     TEXT,
  is_published  BOOLEAN DEFAULT FALSE,
  view_count    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEDIA ─────────────────────────────────────────────────────
CREATE TABLE media (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id      UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL,
  r2_key        TEXT,
  file_name     TEXT,
  file_size     BIGINT,
  mime_type     VARCHAR(100),
  duration_sec  INTEGER,
  tribute_text  TEXT,
  tribute_from  VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSACTIONS ──────────────────────────────────────────────
CREATE TABLE transactions (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
  razorpay_payment_id       TEXT UNIQUE,
  razorpay_subscription_id  TEXT,
  razorpay_order_id         TEXT,
  amount_paise              INTEGER NOT NULL,
  amount_inr                NUMERIC(10,2),
  currency                  VARCHAR(10) DEFAULT 'INR',
  status                    VARCHAR(50),
  plan                      VARCHAR(20),
  payment_method            VARCHAR(50),
  description               TEXT,
  raw_payload               JSONB,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── EMAIL LOG ─────────────────────────────────────────────────
CREATE TABLE email_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email_to    VARCHAR(255) NOT NULL,
  type        VARCHAR(100) NOT NULL,
  resend_id   TEXT,
  status      VARCHAR(50) DEFAULT 'sent',
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── RESEND WEBHOOK EVENTS ─────────────────────────────────────
CREATE TABLE resend_webhook_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id        TEXT NOT NULL UNIQUE,
  event_type        VARCHAR(100) NOT NULL,
  email_id          TEXT,
  recipient_email   VARCHAR(255),
  sender_email      VARCHAR(255),
  subject           TEXT,
  event_created_at  TIMESTAMPTZ,
  received_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  status            VARCHAR(50) DEFAULT 'received',
  error_message     TEXT,
  payload           JSONB NOT NULL
);

-- ── SUPPORT INBOX ─────────────────────────────────────────────
CREATE TABLE support_inbox (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id        TEXT NOT NULL UNIQUE REFERENCES resend_webhook_events(webhook_id) ON DELETE CASCADE,
  email_id          TEXT,
  message_id        TEXT,
  thread_token      TEXT UNIQUE,
  from_email        VARCHAR(255),
  from_name         VARCHAR(255),
  to_email          VARCHAR(255),
  cc                JSONB DEFAULT '[]'::jsonb,
  bcc               JSONB DEFAULT '[]'::jsonb,
  subject           TEXT,
  attachment_count  INTEGER DEFAULT 0,
  ticket_status     VARCHAR(50) DEFAULT 'open',
  assigned_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  replied_at        TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  body_text         TEXT,
  body_html         TEXT,
  headers           JSONB DEFAULT '{}'::jsonb,
  payload           JSONB NOT NULL,
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  received_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  support_inbox_id  UUID NOT NULL REFERENCES support_inbox(id) ON DELETE CASCADE,
  webhook_id        TEXT NOT NULL UNIQUE REFERENCES resend_webhook_events(webhook_id) ON DELETE CASCADE,
  email_id          TEXT,
  message_id        TEXT,
  in_reply_to       TEXT,
  references_header TEXT,
  from_email        VARCHAR(255),
  from_name         VARCHAR(255),
  to_email          VARCHAR(255),
  cc                JSONB DEFAULT '[]'::jsonb,
  bcc               JSONB DEFAULT '[]'::jsonb,
  subject           TEXT,
  attachment_count  INTEGER DEFAULT 0,
  body_text         TEXT,
  body_html         TEXT,
  headers           JSONB DEFAULT '{}'::jsonb,
  payload           JSONB NOT NULL,
  received_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_replies (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  support_inbox_id UUID NOT NULL REFERENCES support_inbox(id) ON DELETE CASCADE,
  admin_id         UUID REFERENCES admins(id) ON DELETE SET NULL,
  to_email         VARCHAR(255) NOT NULL,
  subject          TEXT NOT NULL,
  body_text        TEXT NOT NULL,
  resend_id        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── ADMIN ACTIVITY LOG ────────────────────────────────────────
CREATE TABLE admin_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
  action      VARCHAR(255) NOT NULL,
  target_type VARCHAR(100),
  target_id   TEXT,
  details     JSONB,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_reset          ON users(reset_token);
CREATE INDEX idx_users_verify         ON users(email_verify_token);
CREATE INDEX idx_users_sub_status     ON users(subscription_status);
CREATE INDEX idx_albums_user_id       ON albums(user_id);
CREATE INDEX idx_albums_slug          ON albums(slug);
CREATE INDEX idx_media_album_id       ON media(album_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_resend_webhook_events_event_type ON resend_webhook_events(event_type);
CREATE INDEX idx_resend_webhook_events_email_id ON resend_webhook_events(email_id);
CREATE INDEX idx_resend_webhook_events_received_at ON resend_webhook_events(received_at DESC);
CREATE INDEX idx_support_inbox_received_at ON support_inbox(received_at DESC);
CREATE INDEX idx_support_inbox_from_email ON support_inbox(from_email);
CREATE INDEX idx_support_inbox_ticket_status ON support_inbox(ticket_status);
CREATE INDEX idx_support_inbox_assigned_admin ON support_inbox(assigned_admin_id);
CREATE INDEX idx_support_inbox_last_message_at ON support_inbox(last_message_at DESC);
CREATE INDEX idx_support_messages_ticket ON support_messages(support_inbox_id, received_at ASC);
CREATE INDEX idx_support_messages_message_id ON support_messages(message_id);
CREATE INDEX idx_support_messages_in_reply_to ON support_messages(in_reply_to);
CREATE INDEX idx_support_replies_ticket ON support_replies(support_inbox_id, created_at DESC);
CREATE INDEX idx_admin_log_created    ON admin_log(created_at DESC);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER albums_updated_at        BEFORE UPDATE ON albums        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pricing_plans_updated_at BEFORE UPDATE ON pricing_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER admins_updated_at        BEFORE UPDATE ON admins        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── DEFAULT APP SETTINGS ──────────────────────────────────────
INSERT INTO app_settings (key, value, type, label, description, group_name) VALUES
  ('app_name',              'MemorialQR',           'string',  'Application Name',        'Shown in emails and UI',                     'general'),
  ('app_tagline',           'Preserving legacies, one QR code at a time', 'string', 'Tagline', 'Shown on landing page',               'general'),
  ('support_email',         'support@yourdomain.com','string', 'Support Email',            'Shown to users for help',                    'general'),
  ('maintenance_mode',      'false',                'boolean', 'Maintenance Mode',         'Puts site in read-only mode for users',       'general'),
  ('allow_registrations',   'true',                 'boolean', 'Allow New Registrations',  'Toggle to pause new signups',                'general'),
  ('grace_period_days',     '90',                   'number',  'Grace Period (days)',       'Days data is kept after subscription ends',  'billing'),
  ('renewal_reminder_days', '7',                    'number',  'Renewal Reminder (days)',   'Days before renewal to send reminder email', 'billing'),
  ('expiry_warning_days',   '14',                   'number',  'Expiry Warning (days)',     'Days before expiry to send warning email',   'billing'),
  ('razorpay_key_id',       '',                     'string',  'Razorpay Key ID',           'Public key from Razorpay dashboard',          'payment'),
  ('razorpay_key_secret',   '',                     'string',  'Razorpay Key Secret',       'Secret key — never expose to frontend',       'payment'),
  ('razorpay_webhook_secret','',                    'string',  'Razorpay Webhook Secret',   'Set in Razorpay Dashboard → Webhooks',        'payment'),
  ('r2_bucket',             'memorialqr-media',     'string',  'R2 Bucket Name',            'Cloudflare R2 bucket for media storage',      'storage'),
  ('max_photo_size_mb',     '20',                   'number',  'Max Photo Size (MB)',        'Maximum upload size for photos',              'storage'),
  ('max_video_size_mb',     '500',                  'number',  'Max Video Size (MB)',        'Maximum upload size for videos',              'storage'),
  ('max_audio_size_mb',     '50',                   'number',  'Max Audio Size (MB)',        'Maximum upload size for audio',               'storage'),
  ('resend_api_key',        '',                     'string',  'Resend API Key',             'API key for sending transactional emails',    'email'),
  ('email_from',            'MemorialQR <hello@yourdomain.com>', 'string', 'From Email',    'From address for all emails',                 'email');

-- ── DEFAULT PRICING PLANS (INR, stored in paise) ─────────────
INSERT INTO pricing_plans (name, slug, price_inr, interval, interval_count, features, max_photos, max_videos, is_featured, sort_order) VALUES
  ('Monthly', 'monthly', 74900, 'monthly', 1,
   '["1 memorial album","Up to 200 photos","10 videos","Unlimited tributes","QR code included","Email support","Cancel any time"]',
   200, 10, FALSE, 1),
  ('Yearly', 'yearly', 699900, 'yearly', 12,
   '["1 memorial album","Unlimited photos","Unlimited videos","Unlimited tributes","QR code + print-ready PDF","Priority support","90-day cancellation notice"]',
   9999, 9999, TRUE, 2);

-- ── DEFAULT SUPER ADMIN ───────────────────────────────────────
-- Default password: NewSecureAdminPass123!  — CHANGE IMMEDIATELY after first login
-- Regenerate: node -e "console.log(require('bcryptjs').hashSync('NewPass',12))"
INSERT INTO admins (name, email, password_hash, role) VALUES
  ('Super Admin', 'admin@memorialqr.com',
   '$2a$12$PvuqGZASXGk/NA4LPmodte9cO136SGALIeKnPa.crsJExxEmrUheS', 'super_admin');
