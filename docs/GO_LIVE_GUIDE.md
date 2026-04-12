# Hriatrengna — Go-Live Checklist & Razorpay Live Mode Guide
Last updated: 2025

---

## PART 1 — RAZORPAY: TEST → LIVE MODE

### Step 1: Activate Your Razorpay Account
1. Log in to dashboard.razorpay.com
2. Complete KYC: Business Details → Upload Aadhar/PAN/Bank statement
3. Wait for activation email (usually 1–3 business days)
4. Once active: top-right dropdown → switch from **Test Mode** to **Live Mode**

### Step 2: Get Live API Keys
In Razorpay Dashboard (Live Mode):
- Settings → API Keys → Generate Key
- Copy **Key ID** (starts with `rzp_live_...`)
- Copy **Key Secret** (shown only once — save it immediately)

### Step 3: Create Live Subscription Plans
In Razorpay Dashboard → Products → Subscriptions → Plans → Create Plan:

**Monthly Plan:**
- Period: Monthly, Interval: 1
- Amount: 74900 paise (₹749)
- Name: "Hriatrengna Monthly"
- Save the Plan ID (e.g., plan_XXXXXXXXXXX)

**Yearly Plan:**
- Period: Yearly, Interval: 1
- Amount: 699900 paise (₹6,999)
- Name: "Hriatrengna Yearly"
- Save the Plan ID

> Note: Lifetime plan uses a one-time Order (not a Plan) — no extra setup needed.

### Step 4: Set Up Live Webhook
In Razorpay Dashboard → Webhooks → Add New Webhook:
- URL: `https://api.hriatrengna.in/api/payments/webhook`
- Secret: Generate a strong random string (min 32 chars) and save it
- Events to enable (tick all):
  - ✅ subscription.activated
  - ✅ subscription.charged
  - ✅ subscription.cancelled
  - ✅ subscription.completed
  - ✅ subscription.halted
  - ✅ payment.failed

### Step 5: Update Backend .env (on server)
SSH into your server and edit `/var/www/memorialqr/backend/.env`:

```bash
# REPLACE these test values with live values:
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET_FROM_DASHBOARD

# Also update these:
APP_URL=https://hriatrengna.in
NODE_ENV=production
ADMIN_NOTIFY_EMAIL=lalngilneia@live.com
SUPPORT_EMAIL=lalngilneia@live.com
```

### Step 6: Update Frontend .env.local (on server)
Edit `/var/www/memorialqr/frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://api.hriatrengna.in
NEXT_PUBLIC_APP_URL=https://hriatrengna.in
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXXXXXX
```
> ⚠️ NEXT_PUBLIC_RAZORPAY_KEY_ID must match RAZORPAY_KEY_ID in backend .env

### Step 7: Update Razorpay Plan IDs in Database
After creating Live plans in Razorpay, update them in your database:

```sql
-- Replace plan IDs with your actual live plan IDs
UPDATE pricing_plans SET razorpay_plan_id = 'plan_LIVE_MONTHLY_ID'  WHERE slug = 'monthly';
UPDATE pricing_plans SET razorpay_plan_id = 'plan_LIVE_YEARLY_ID'   WHERE slug = 'yearly';
-- Lifetime uses orders, not plans — no update needed
```

Run this via psql:
```bash
psql $DATABASE_URL
```
Or in the Admin Dashboard → Pricing Plans → Edit each plan.

### Step 8: Rebuild and Restart
```bash
cd /var/www/memorialqr
bash scripts/fix-build.sh
pm2 restart all
```

---

## PART 2 — PRE-LAUNCH SECURITY & CODE AUDIT

### ✅ Authentication
- [x] Passwords hashed with bcrypt (cost 12)
- [x] JWT tokens expire in 7 days
- [x] Token version invalidated on password change
- [x] Separate JWT secret for admin (ADMIN_JWT_SECRET)
- [x] Rate limiting on all auth endpoints (10/15min)
- [x] Email verification required before login
- [x] Constant-time comparison for affiliate login (timing attack prevention)
- [ ] **ACTION**: Set strong random JWT_SECRET (min 64 chars): `openssl rand -base64 64`
- [ ] **ACTION**: Set strong ADMIN_JWT_SECRET (different from JWT_SECRET)

### ✅ API Security
- [x] Helmet.js security headers
- [x] CORS locked to your domain only
- [x] Express rate limiting on all /api/ routes (100/15min)
- [x] SQL injection: parameterised queries throughout
- [x] Input validation and length limits on all endpoints
- [x] Razorpay webhook signature verification (HMAC-SHA256)
- [ ] **ACTION**: Verify ALLOWED_ORIGINS in backend .env = `https://hriatrengna.in,https://www.hriatrengna.in`

### ✅ Payments
- [x] Payment signature verified before activating subscription
- [x] Webhook processes recurring payment events
- [x] album_quota updated on every renewal cycle
- [x] Grace period (3 days) on payment failure
- [ ] **ACTION**: Test one payment with Live key in Razorpay test mode before going fully public

### ✅ Data Security
- [x] R2 media served via public URL (no private key exposed to frontend)
- [x] Biography HTML sanitized before public display
- [x] Tribute text escaped (XSS prevention)
- [x] Album slug validated (alphanumeric/hyphens only)
- [x] Admin SELECT * removed from affiliate queries
- [x] Life event icon whitelist enforced

### ✅ Legal (India — DPDP Act 2023 + IT Act 2000)
- [x] Terms of Service published at /terms
- [x] Privacy Policy published at /privacy — includes Grievance Officer
- [x] Refund Policy published at /refund — Razorpay merchant requirement
- [x] Email consent notice on signup form
- [x] Address: Aizawl, Mizoram, India
- [x] Contact: lalngilneia@live.com

### ✅ Email
- [ ] **ACTION**: Verify your Resend sending domain (resend.com → Domains)
- [ ] **ACTION**: Set EMAIL_FROM=`Hriatrengna <noreply@hriatrengna.in>`
- [ ] **ACTION**: Set EMAIL_FROM_NOREPLY=`Hriatrengna <noreply@hriatrengna.in>`
- [ ] **ACTION**: Test welcome email, verify email, and reset password flows

### ✅ Infrastructure
- [x] HTTPS enforced via nginx + Certbot
- [x] PM2 auto-restart on crash
- [x] Postgres backups script in /scripts/backup.sh
- [x] Nginx caches static assets, never caches HTML
- [ ] **ACTION**: Run `bash scripts/backup.sh` once manually to verify it works
- [ ] **ACTION**: Set up cron for automatic backups: `0 2 * * * /var/www/memorialqr/scripts/backup.sh`
- [ ] **ACTION**: Renew SSL auto: `certbot renew --dry-run` (should work)

---

## PART 3 — DATABASE: FINAL MIGRATION CHECKLIST

Run all migrations in order if not done already:

```bash
cd /var/www/memorialqr
psql $DATABASE_URL -f schema.sql               # Base schema
psql $DATABASE_URL -f migrations/001_fixes.sql
psql $DATABASE_URL -f migrations/002_invoices.sql
psql $DATABASE_URL -f migrations/003_affiliates.sql
psql $DATABASE_URL -f migrations/004_new_features.sql
psql $DATABASE_URL -f migrations/005_plan_media_limits.sql
psql $DATABASE_URL -f migrations/006_affiliate_auth_and_album_quota.sql
```

Verify key tables exist:
```sql
\dt   -- should list: users, albums, media, transactions, affiliates, commissions,
      -- pricing_plans, invoices, life_events, album_views, album_subscriptions
```

Set up your first super admin:
```sql
-- Create admin account (run once)
INSERT INTO admins (name, email, password_hash, role)
VALUES (
  'Your Name',
  'lalngilneia@live.com',
  -- Generate hash: node -e "require('bcryptjs').hash('YourPassword',12).then(console.log)"
  '$2b$12$YOUR_BCRYPT_HASH_HERE',
  'super_admin'
);
```

---

## PART 4 — FINAL PRE-LAUNCH CHECKLIST (do in order)

### Day before launch:
- [ ] Run all database migrations
- [ ] Update all .env values (Live Razorpay keys, correct domain, email)
- [ ] Update razorpay_plan_id in pricing_plans table
- [ ] Rebuild frontend: `bash scripts/fix-build.sh`
- [ ] Test admin login at hriatrengna.in/admin
- [ ] Test subscriber signup → verify email → payment (use ₹1 test amount in Razorpay live)
- [ ] Test album creation → publish → QR code → public URL
- [ ] Test affiliate portal at hriatrengna.in/affiliate
- [ ] Verify /terms, /privacy, /refund pages load

### On launch day:
- [ ] Set NODE_ENV=production in backend .env
- [ ] Confirm Razorpay webhook is receiving events (check Razorpay dashboard → Webhooks → Logs)
- [ ] Monitor PM2 logs for first 30 minutes: `pm2 logs --lines 200`
- [ ] Test a real payment end-to-end with your own account

### Ongoing (weekly):
- [ ] Check `pm2 status` — both processes online
- [ ] Check server disk space: `df -h` (media uploads grow over time)
- [ ] Check Razorpay dashboard for failed payments
- [ ] Check Admin → Automation → run Daily Digest manually to verify emails work

---

## PART 5 — ENV REFERENCE (Complete)

```bash
# /var/www/memorialqr/backend/.env

NODE_ENV=production
PORT=4000
APP_URL=https://hriatrengna.in
API_URL=https://api.hriatrengna.in

DATABASE_URL=postgresql://memorialqr_user:YOUR_PASSWORD@localhost:5432/memorialqr

JWT_SECRET=<64-char random string>
JWT_EXPIRES_IN=7d
ADMIN_JWT_SECRET=<different 64-char random string>
ADMIN_JWT_EXPIRES_IN=8h

R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=hriatrengna-media
R2_PUBLIC_URL=https://pub-XXXX.r2.dev

RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX        # Live key
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXX     # Live secret
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET  # From Razorpay Dashboard

RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXX
EMAIL_FROM=Hriatrengna <noreply@hriatrengna.in>
EMAIL_FROM_NOREPLY=Hriatrengna <noreply@hriatrengna.in>
ADMIN_NOTIFY_EMAIL=lalngilneia@live.com
SUPPORT_EMAIL=lalngilneia@live.com

ALLOWED_ORIGINS=https://hriatrengna.in,https://www.hriatrengna.in
```

```bash
# /var/www/memorialqr/frontend/.env.local

NEXT_PUBLIC_API_URL=https://api.hriatrengna.in
NEXT_PUBLIC_APP_URL=https://hriatrengna.in
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXX   # Must match backend
```
