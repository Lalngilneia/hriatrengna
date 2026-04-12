const Razorpay = require('razorpay');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const slugify = require('slugify');
const db      = require('../utils/db');
const r2      = require('../services/r2.service');
const emailService = require('../services/email.service');
const invoiceService = require('../services/invoice.service');
const { generateBackupZip } = require('../services/backup.service');
const { sanitizeBiographyHtml } = require('../utils/content-sanitizer');

// ── HELPERS ───────────────────────────────────────────────────
const signAdminToken = (adminId, tokenVersion = 0) =>
  jwt.sign({ adminId, type: 'admin', tokenVersion }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h',
  });

const logAction = (adminId, action, targetType, targetId, details, ip) =>
  db.query(
    `INSERT INTO admin_log (admin_id, action, target_type, target_id, details, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [adminId, action, targetType, targetId, JSON.stringify(details), ip]
  ).catch(err => console.error('[ADMIN LOG]', err.message));

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const SUPPORT_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'archived'];

const normalizeSupportStatus = (status) => {
  if (!status) return null;
  const value = String(status).trim().toLowerCase();
  return SUPPORT_STATUSES.includes(value) ? value : null;
};

const normalizeUuid = (value) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())
    ? String(value).trim()
    : null
);

const ensureReplySubject = (value, fallback) => {
  const clean = String(value || fallback || 'Support reply').trim();
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
};

const plainTextFromHtml = (html) => String(html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const getSupportAddressParts = () => {
  const supportEmail = (process.env.SUPPORT_EMAIL || 'support@hriatrengna.in').toLowerCase();
  const [local, domain] = supportEmail.split('@');
  return { supportEmail, local, domain };
};

const buildSupportThreadAddress = (threadToken) => {
  const { supportEmail, local, domain } = getSupportAddressParts();
  if (!threadToken || !local || !domain) return supportEmail;
  return `${local}+${threadToken}@${domain}`;
};

const touchAdminLastLogin = async (adminId) => {
  try {
    await db.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [adminId]);
  } catch (err) {
    // Older production schemas may not have last_login yet.
    if (err?.code !== '42703') throw err;
  }
};

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const toINR = (paise) => (Number(paise || 0) / 100).toFixed(2);

const toPaiseFromInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
};

// ── AUTH ──────────────────────────────────────────────────────

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const result = await db.query(
      'SELECT * FROM admins WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );
    const admin = result.rows[0];

    // Constant-time compare even if admin not found
    const hash = admin?.password_hash || '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
    const match = await bcrypt.compare(password, hash);

    if (!admin || !match)
      return res.status(401).json({ error: 'Invalid credentials.' });

    await touchAdminLastLogin(admin.id);
    logAction(admin.id, 'admin_login', 'admin', admin.id, { ip: req.ip }, req.ip);

    const token = signAdminToken(admin.id, admin.token_version || 0);
    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) { next(err); }
};

exports.me = (req, res) => res.json({ admin: req.admin });

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both current and new password are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (newPassword.length > 128)
      return res.status(400).json({ error: 'Password must be 128 characters or less.' });

    const result = await db.query(
      'SELECT password_hash FROM admins WHERE id = $1', [req.adminId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Admin not found.' });

    if (!(await bcrypt.compare(currentPassword, result.rows[0].password_hash)))
      return res.status(401).json({ error: 'Current password incorrect.' });

    const hash = await bcrypt.hash(newPassword, 12);
    // Invalidate other sessions by bumping token_version
    await db.query(
      'UPDATE admins SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1 WHERE id = $2',
      [hash, req.adminId]
    );
    logAction(req.adminId, 'changed_password', 'admin', req.adminId, {}, req.ip);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) { next(err); }
};

// ── DASHBOARD ─────────────────────────────────────────────────

exports.dashboard = async (req, res, next) => {
  try {
    const [users, albums, revenue, affiliates, recentSubs, recentTx, topAlbums, dailyRevenue] = await Promise.all([
      // USERS
      db.query(`
        SELECT
          COUNT(*)                                                                              AS total_users,
          COUNT(*) FILTER (WHERE subscription_status = 'active')                               AS active_subscribers,
          COUNT(*) FILTER (WHERE subscription_status IN ('inactive','canceled','expired'))      AS inactive_users,
          COUNT(*) FILTER (WHERE subscription_status IN ('canceled','past_due','halted')
            AND grace_period_until IS NOT NULL AND grace_period_until > NOW())                  AS in_grace_period,
          COUNT(*) FILTER (WHERE subscription_plan = 'monthly'        AND subscription_status = 'active') AS monthly_subscribers,
          COUNT(*) FILTER (WHERE subscription_plan = 'yearly'         AND subscription_status = 'active') AS yearly_subscribers,
          COUNT(*) FILTER (WHERE subscription_plan = 'lifetime'       AND subscription_status = 'active') AS lifetime_subscribers,
          COUNT(*) FILTER (WHERE subscription_plan LIKE 'wedding-%'   AND subscription_status = 'active') AS wedding_subscribers,
          COUNT(*) FILTER (WHERE is_email_verified = TRUE)                                     AS verified_users,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')                     AS new_last_30,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')                      AS new_last_7,
          COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)                             AS new_today
        FROM users
      `),
      // ALBUMS
      db.query(`
        SELECT
          COUNT(*)                                                         AS total_albums,
          COUNT(*) FILTER (WHERE is_published = TRUE)                     AS published,
          COUNT(*) FILTER (WHERE is_published = FALSE)                    AS draft,
          COALESCE(SUM(view_count), 0)::int                               AS total_views,
          ROUND(COALESCE(AVG(view_count), 0), 1)                         AS avg_views,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_last_30
        FROM albums
      `),
      // REVENUE
      db.query(`
        SELECT
          COALESCE(SUM(amount_inr), 0)                                                                AS total_revenue,
          COALESCE(SUM(amount_inr) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0)         AS revenue_30d,
          COALESCE(SUM(amount_inr) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'),  0)         AS revenue_7d,
          COALESCE(SUM(amount_inr) FILTER (WHERE created_at::date = CURRENT_DATE),         0)         AS revenue_today,
          COALESCE(SUM(amount_inr) FILTER (WHERE plan = 'monthly'), 0)                                AS revenue_monthly_plan,
          COALESCE(SUM(amount_inr) FILTER (WHERE plan = 'yearly'),  0)                                AS revenue_yearly_plan,
          COALESCE(SUM(amount_inr) FILTER (WHERE plan = 'lifetime'), 0)                               AS revenue_lifetime_plan,
          COUNT(*) FILTER (WHERE status IN ('captured','paid'))                                       AS total_payments
        FROM transactions WHERE status IN ('captured','paid')
      `),
      // AFFILIATES
      db.query(`
        SELECT
          COUNT(*)                                                        AS total_affiliates,
          COUNT(*) FILTER (WHERE status = 'active')                      AS active_affiliates,
          COUNT(*) FILTER (WHERE status = 'pending' AND is_email_verified = TRUE) AS pending_review,
          COALESCE(SUM(total_earnings), 0)                               AS total_commissions,
          COALESCE(SUM(total_paid_out), 0)                               AS total_paid_out,
          COALESCE(SUM(total_earnings) - SUM(total_paid_out), 0)         AS pending_payout
        FROM affiliates
      `),
      // RECENT ACTIVE SUBSCRIBERS
      db.query(`
        SELECT u.id, u.name, u.email, u.subscription_plan, u.subscription_status, u.created_at
        FROM users u WHERE u.subscription_status = 'active'
        ORDER BY u.created_at DESC LIMIT 5
      `),
      // RECENT SUCCESSFUL TRANSACTIONS
      db.query(`
        SELECT t.id, t.user_id, t.razorpay_payment_id, t.amount_inr, t.plan, t.payment_method, t.status, t.created_at,
               u.name AS user_name, u.email AS user_email
        FROM transactions t LEFT JOIN users u ON u.id = t.user_id
        WHERE t.status IN ('captured','paid')
        ORDER BY t.created_at DESC LIMIT 8
      `),
      // TOP ALBUMS BY VIEWS
      db.query(`
        SELECT a.name, a.slug, a.view_count, u.name AS owner_name
        FROM albums a JOIN users u ON u.id = a.user_id
        WHERE a.is_published = TRUE
        ORDER BY a.view_count DESC LIMIT 5
      `),
      // DAILY REVENUE LAST 14 DAYS
      db.query(`
        SELECT created_at::date AS date,
               COALESCE(SUM(amount_inr), 0) AS revenue,
               COUNT(*) AS payments
        FROM transactions
        WHERE status IN ('captured','paid') AND created_at > NOW() - INTERVAL '14 days'
        GROUP BY created_at::date ORDER BY date ASC
      `),
    ]);

    // Flat response — no nested 'stats' wrapper (frontend reads keys directly)
    res.json({
      users:    users.rows[0],
      albums:   albums.rows[0],
      revenue:  revenue.rows[0],
      affiliates: affiliates.rows[0],
      recentSubscribers:  recentSubs.rows,
      recentTransactions: recentTx.rows,
      topAlbums:          topAlbums.rows,
      dailyRevenue:       dailyRevenue.rows,
    });
  } catch (err) { next(err); }
};

// ── SUBSCRIBER / USER MANAGEMENT ─────────────────────────────

exports.listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, plan } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      conditions.push(`u.subscription_status = $${params.length}`);
    }
    if (plan) {
      params.push(plan);
      conditions.push(`u.subscription_plan = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const searchParams = [...params]; // params without limit/offset for count query
    params.push(limit, offset);

    const [users, total] = await Promise.all([
      db.query(`
        SELECT u.id, u.name, u.email, u.phone, u.is_email_verified,
               u.subscription_status, u.subscription_plan, u.current_period_end,
               u.cancel_at_period_end, u.is_active, u.notes, u.created_at,
               COUNT(a.id)::int AS album_count,
               COALESCE(SUM(t.amount_inr) FILTER (WHERE t.status IN ('captured','paid')), 0) AS total_paid
        FROM users u
        LEFT JOIN albums a ON a.user_id = u.id
        LEFT JOIN transactions t ON t.user_id = u.id
        ${where}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      db.query(`SELECT COUNT(*) FROM users u ${where}`, searchParams),
    ]);

    res.json({
      users: users.rows,
      total: parseInt(total.rows[0].count),
      page:  +page,
      limit: +limit,
    });
  } catch (err) { next(err); }
};

exports.getUser = async (req, res, next) => {
  try {
    const [user, albums, transactions] = await Promise.all([
      db.query(
        `SELECT u.*,
                COALESCE(SUM(t.amount_inr) FILTER (WHERE t.status IN ('captured','paid')), 0) AS total_paid,
                COUNT(DISTINCT a.id)::int AS album_count
         FROM users u
         LEFT JOIN albums a ON a.user_id = u.id
         LEFT JOIN transactions t ON t.user_id = u.id
         WHERE u.id = $1 GROUP BY u.id`,
        [req.params.userId]
      ),
      db.query('SELECT * FROM albums WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]),
      db.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.params.userId]),
    ]);

    if (!user.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: user.rows[0], albums: albums.rows, transactions: transactions.rows });
  } catch (err) { next(err); }
};

// Basic update — subscription status / notes / is_active
exports.updateUser = async (req, res, next) => {
  try {
    const { isActive, notes, subscriptionStatus, subscriptionPlan,
            name, email, phone, newPassword } = req.body;

    // FIX: Validate password BEFORE touching DB
    if (newPassword !== undefined && newPassword !== '') {
      if (newPassword.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      if (newPassword.length > 128)
        return res.status(400).json({ error: 'Password must be 128 characters or less.' });
    }

    // FIX: Check email uniqueness before updating
    if (email) {
      if (!isValidEmail(email))
        return res.status(400).json({ error: 'Invalid email address format.' });
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase().trim(), req.params.userId]
      );
      if (existing.rows.length)
        return res.status(409).json({ error: 'Email already in use by another account.' });
    }

    const result = await db.query(
      `UPDATE users SET
         is_active           = COALESCE($1,  is_active),
         notes               = COALESCE($2,  notes),
         subscription_status = COALESCE($3,  subscription_status),
         subscription_plan   = COALESCE($4,  subscription_plan),
         name                = COALESCE($5,  name),
         email               = COALESCE($6,  email),
         phone               = COALESCE($7,  phone)
       WHERE id = $8
       RETURNING id, name, email, phone, is_active, notes, subscription_status, subscription_plan`,
      [isActive    ?? null,
       notes       ?? null,
       subscriptionStatus ?? null,
       subscriptionPlan   ?? null,
       name?.trim()  ?? null,
       email?.toLowerCase().trim() ?? null,
       phone?.trim() ?? null,
       req.params.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });

    // Reset password AFTER successful DB update
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 12);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.userId]);
    }

    logAction(req.adminId, 'update_user', 'user', req.params.userId,
      { subscriptionStatus, name, email, passwordReset: !!newPassword }, req.ip);

    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
};

// Full update — name, email, phone, password, subscription, flags
exports.updateUserFull = async (req, res, next) => {
  try {
    const { name, email, phone, subscriptionStatus, subscriptionPlan,
            isActive, isEmailVerified, notes, newPassword } = req.body;

    // FIX: Validate everything BEFORE any DB write
    if (newPassword !== undefined && newPassword !== '') {
      if (newPassword.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      if (newPassword.length > 128)
        return res.status(400).json({ error: 'Password must be 128 characters or less.' });
    }
    if (email) {
      if (!isValidEmail(email))
        return res.status(400).json({ error: 'Invalid email address format.' });
      const exists = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase().trim(), req.params.userId]
      );
      if (exists.rows.length) return res.status(409).json({ error: 'Email already used by another account.' });
    }

    const result = await db.query(
      `UPDATE users SET
         name                = COALESCE($1, name),
         email               = COALESCE($2, email),
         phone               = COALESCE($3, phone),
         subscription_status = COALESCE($4, subscription_status),
         subscription_plan   = COALESCE($5, subscription_plan),
         is_active           = COALESCE($6, is_active),
         is_email_verified   = COALESCE($7, is_email_verified),
         notes               = COALESCE($8, notes)
       WHERE id = $9
       RETURNING id, name, email, phone, subscription_status, subscription_plan,
                 is_active, is_email_verified, notes`,
      [name?.trim()  ?? null,
       email ? email.toLowerCase().trim() : null,
       phone?.trim() ?? null,
       subscriptionStatus ?? null,
       subscriptionPlan   ?? null,
       isActive        !== undefined ? isActive        : null,
       isEmailVerified !== undefined ? isEmailVerified : null,
       notes           !== undefined ? notes           : null,
       req.params.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });

    // FIX: Password reset AFTER successful update
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 12);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.userId]);
    }

    logAction(req.adminId, 'update_user_full', 'user', req.params.userId,
      { name, email, subscriptionStatus, subscriptionPlan, passwordReset: !!newPassword }, req.ip);

    res.json({ user: result.rows[0], passwordReset: !!newPassword });
  } catch (err) { next(err); }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userRes = await db.query(
      'SELECT name, email, profile_photo, cover_photo FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found.' });
    const targetUser = userRes.rows[0];

    // DB CASCADE handles albums, media, transactions — but clean up R2 files first
    const mediaRows = await db.query(
      `SELECT m.r2_key FROM media m
       JOIN albums a ON a.id = m.album_id
       WHERE a.user_id = $1 AND m.r2_key IS NOT NULL`,
      [req.params.userId]
    );
    const r2 = require('../services/r2.service');
    await Promise.allSettled(mediaRows.rows.map(m => r2.deleteFile(m.r2_key)));

    // Delete avatar, cover, and background music keys for all user albums
    const albumKeys = await db.query(
      'SELECT avatar_key, cover_key, background_music_key FROM albums WHERE user_id = $1', [req.params.userId]
    );
    for (const a of albumKeys.rows) {
      if (a.avatar_key)           await r2.deleteFile(a.avatar_key).catch(() => {});
      if (a.cover_key)            await r2.deleteFile(a.cover_key).catch(() => {});
      if (a.background_music_key) await r2.deleteFile(a.background_music_key).catch(() => {});
    }

    // Delete user profile/cover photos (stored as full CDN URLs — extract R2 key)
    const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    const extractKey = (url) => {
      if (!url || !r2PublicUrl) return null;
      return url.startsWith(r2PublicUrl + '/') ? url.slice(r2PublicUrl.length + 1) : null;
    };
    const profileKey = extractKey(targetUser.profile_photo);
    const coverKey   = extractKey(targetUser.cover_photo);
    if (profileKey) await r2.deleteFile(profileKey).catch(() => {});
    if (coverKey)   await r2.deleteFile(coverKey).catch(() => {});

    await db.query('DELETE FROM users WHERE id = $1', [req.params.userId]);
    logAction(req.adminId, 'delete_user', 'user', req.params.userId, { name: targetUser.name, email: targetUser.email }, req.ip);
    res.json({ message: 'User and all their data deleted permanently.' });
  } catch (err) { next(err); }
};

// ── PRICING PLAN MANAGEMENT ───────────────────────────────────

exports.listPlans = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM pricing_plans ORDER BY sort_order');
    res.json({ plans: result.rows });
  } catch (err) { next(err); }
};

exports.updatePlan = async (req, res, next) => {
  try {
    // Accept both snake_case (from admin.jsx) and camelCase
    const body = req.body;
    const name         = body.name;
    const priceInr     = body.price_inr      ?? body.priceInr;
    const features     = body.features;
    const maxPhotos    = body.max_photos     ?? body.maxPhotos;
    const maxVideos    = body.max_videos     ?? body.maxVideos;
    const isActive     = body.is_active      ?? body.isActive;
    const isFeatured   = body.is_featured    ?? body.isFeatured;
    const maxAlbums    = body.max_albums     ?? body.maxAlbums;

    const result = await db.query(
      `UPDATE pricing_plans SET
         name             = COALESCE($1, name),
         price_inr        = COALESCE($2, price_inr),
         features         = COALESCE($3::jsonb, features),
         max_photos       = COALESCE($4, max_photos),
         max_videos       = COALESCE($5, max_videos),
         is_active        = COALESCE($6, is_active),
         is_featured      = COALESCE($7, is_featured),
         max_albums       = COALESCE($9, max_albums),
         updated_at       = NOW()
       WHERE id = $8 RETURNING *`,
      [name, priceInr,
       features ? JSON.stringify(features) : null,
       maxPhotos !== undefined ? Number(maxPhotos) : null,
       maxVideos !== undefined ? Number(maxVideos) : null,
       isActive  !== undefined ? Boolean(isActive)  : null,
       isFeatured!== undefined ? Boolean(isFeatured): null,
       req.params.planId,
       maxAlbums !== undefined ? Number(maxAlbums) : null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Plan not found.' });
    logAction(req.adminId, 'update_plan', 'plan', req.params.planId, req.body, req.ip);
    res.json({ plan: result.rows[0] });
  } catch (err) { next(err); }
};

// ── APP SETTINGS ──────────────────────────────────────────────

// ── GET SAMPLE ALBUMS (public — no auth) ─────────────────────
exports.getSampleAlbums = async (req, res, next) => {
  try {
    const settings = await db.query(
      `SELECT key, value FROM app_settings
       WHERE key IN ('sample_memorial_slug','sample_wedding_slug')`,
      []
    );
    const s = Object.fromEntries(settings.rows.map(r => [r.key, r.value]));
    const memorial = s.sample_memorial_slug || '';
    const wedding  = s.sample_wedding_slug  || '';

    const slugs = [memorial, wedding].filter(Boolean);
    let verified = {};
    if (slugs.length) {
      const r2 = await db.query(
        'SELECT slug, type, name FROM albums WHERE slug = ANY($1) AND is_published = TRUE',
        [slugs]
      );
      r2.rows.forEach(r => { verified[r.slug] = r; });
    }

    res.json({
      memorial: verified[memorial] ? { slug: memorial, name: verified[memorial].name } : null,
      wedding:  verified[wedding]  ? { slug: wedding,  name: verified[wedding].name  } : null,
    });
  } catch (err) { next(err); }
};

exports.getSettings = async (req, res, next) => {
  try {
    const { group } = req.query;
    const query = group
      ? 'SELECT * FROM app_settings WHERE group_name = $1 ORDER BY group_name, key'
      : 'SELECT * FROM app_settings ORDER BY group_name, key';
    const result = await db.query(query, group ? [group] : []);

    const grouped = result.rows.reduce((acc, s) => {
      acc[s.group_name] = acc[s.group_name] || [];
      acc[s.group_name].push(s);
      return acc;
    }, {});

    // Return both grouped (for frontend tabs) and flat (for iterating)
    res.json({ settings: grouped, flat: result.rows });
  } catch (err) { next(err); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings))
      return res.status(400).json({ error: 'settings must be an array of { key, value }.' });

    const updated = [];
    for (const { key, value } of settings) {
      if (!key) continue;
      const result = await db.query(
        `UPDATE app_settings SET value = $1, updated_by = $2, updated_at = NOW()
         WHERE key = $3 RETURNING key, value, label, group_name`,
        [String(value ?? ''), req.adminId, key]
      );
      if (result.rows.length) updated.push(result.rows[0]);
    }

    logAction(req.adminId, 'update_settings', 'setting', null,
      { keys: settings.map(s => s.key) }, req.ip);

    res.json({ updated });
  } catch (err) { next(err); }
};

// ── ALBUM MANAGEMENT ─────────────────────────────────────────

// FIX: Bounded slug generator (no while(true))
const adminGenerateSlug = async (name) => {
  const base   = slugify(name, { lower: true, strict: true }) || 'memorial';
  let   unique = base;
  for (let i = 1; i <= 100; i++) {
    const exists = await db.query('SELECT id FROM albums WHERE slug = $1', [unique]);
    if (!exists.rows.length) return unique;
    unique = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
};

exports.listAlbums = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const params = search ? [`%${search}%`, limit, offset] : [limit, offset];
    const where  = search
      ? 'WHERE a.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1'
      : '';

    const albums = await db.query(`
      SELECT a.*, u.name AS user_name, u.email AS user_email, u.subscription_status,
             s.name AS studio_name,
             COUNT(m.id)::int AS media_count
      FROM albums a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN studios s ON s.id = a.studio_id
      LEFT JOIN media m ON m.album_id = a.id
      ${where}
      GROUP BY a.id, u.name, u.email, u.subscription_status, s.name
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await db.query(
      `SELECT COUNT(*) FROM albums a LEFT JOIN users u ON u.id = a.user_id ${where}`,
      search ? [`%${search}%`] : []
    );

    res.json({ albums: albums.rows, total: parseInt(total.rows[0].count) });
  } catch (err) { next(err); }
};

exports.createAlbum = async (req, res, next) => {
  try {
    const { userId, name, birthDate, deathDate, biography, type = 'memorial', isSample = false, weddingDate, partner1Name, partner2Name } = req.body;
    const biographyHtml = biography !== undefined ? sanitizeBiographyHtml(biography) : undefined;
    if (!userId || !name)
      return res.status(400).json({ error: 'userId and name are required.' });

    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userCheck.rows.length) return res.status(404).json({ error: 'User not found.' });

    const slug = await adminGenerateSlug(name);
    const bd   = birthDate || null;
    const dd   = deathDate || null;

    const isWeddingType = type === 'wedding';
    const result = await db.query(
      `INSERT INTO albums
         (user_id, name, slug, birth_year, death_year, birth_date, death_date, biography,
          type, is_published, is_sample, partner1_name, partner2_name, wedding_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11,$12,$13) RETURNING *`,
      [userId, name.trim(), slug,
       !isWeddingType && bd ? new Date(bd).getFullYear() : null,
       !isWeddingType && dd ? new Date(dd).getFullYear() : null,
       !isWeddingType ? bd : null, !isWeddingType ? dd : null,
       biographyHtml || null, isWeddingType ? 'wedding' : 'memorial',
       Boolean(isSample),
       isWeddingType ? (partner1Name || name) : null,
       isWeddingType ? (partner2Name || null) : null,
       isWeddingType ? (weddingDate || null) : null]
    );
    // If marked as sample, auto-update app_settings so homepage shows it immediately
    if (isSample) {
      const typeKey = isWeddingType ? 'sample_wedding_slug' : 'sample_memorial_slug';
      await db.query(
        `INSERT INTO app_settings (key, value, type, label, description, group_name)
         VALUES ($1, $2, 'string', $3, $4, 'general')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [typeKey, result.rows[0].slug,
         isWeddingType ? 'Sample Wedding Album Slug' : 'Sample Memorial Album Slug',
         isWeddingType ? 'Slug shown as QR demo on homepage.' : 'Slug shown as QR demo on homepage.']
      );
      console.log(`[ADMIN] Sample ${isWeddingType?'wedding':'memorial'} album set to: ${result.rows[0].slug}`);
    }
    logAction(req.adminId, 'create_album', 'album', result.rows[0].id, { name, userId }, req.ip);
    res.status(201).json({ album: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateAlbum = async (req, res, next) => {
  try {
    const { name, birthDate, deathDate, biography, isPublished, isSample, weddingDate, partner1Name, partner2Name } = req.body;
    const biographyHtml = biography !== undefined ? sanitizeBiographyHtml(biography) : undefined;
    const bd = birthDate !== undefined ? (birthDate || null) : undefined;
    const dd = deathDate !== undefined ? (deathDate || null) : undefined;

    const result = await db.query(
      `UPDATE albums SET
         name          = COALESCE($1, name),
         birth_date    = COALESCE($2, birth_date),
         death_date    = COALESCE($3, death_date),
         birth_year    = COALESCE($4, birth_year),
         death_year    = COALESCE($5, death_year),
         biography     = COALESCE($6, biography),
         is_published  = COALESCE($7, is_published),
         is_sample     = COALESCE($9, is_sample),
         partner1_name = COALESCE($10, partner1_name),
         partner2_name = COALESCE($11, partner2_name),
         wedding_date  = COALESCE($12, wedding_date),
         updated_at    = NOW()
       WHERE id = $8 RETURNING *`,
      [name?.trim() || null,
       bd ?? null, dd ?? null,
       bd ? new Date(bd).getFullYear() : null,
       dd ? new Date(dd).getFullYear() : null,
       biography !== undefined ? biographyHtml : null,
       isPublished !== undefined ? isPublished : null,
       req.params.albumId,
       isSample  !== undefined ? Boolean(isSample)  : null,
       partner1Name !== undefined ? partner1Name : null,
       partner2Name !== undefined ? partner2Name : null,
       weddingDate  !== undefined ? weddingDate  : null]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Album not found.' });
    // If marked as sample, auto-update app_settings
    if (isSample === true) {
      const album     = result.rows[0];
      const typeKey   = album.type === 'wedding' ? 'sample_wedding_slug' : 'sample_memorial_slug';
      await db.query(
        `INSERT INTO app_settings (key, value, type, label, description, group_name)
         VALUES ($1, $2, 'string', $3, $4, 'general')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [typeKey, album.slug,
         album.type === 'wedding' ? 'Sample Wedding Album Slug' : 'Sample Memorial Album Slug',
         'Slug shown as QR demo on homepage.']
      );
      console.log(`[ADMIN] Sample ${album.type} album updated to: ${album.slug}`);
    }
    logAction(req.adminId, 'update_album', 'album', req.params.albumId, req.body, req.ip);
    res.json({ album: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteAlbum = async (req, res, next) => {
  try {
    const albumRes = await db.query(
      'SELECT name, avatar_key, cover_key FROM albums WHERE id = $1', [req.params.albumId]
    );
    if (!albumRes.rows.length) return res.status(404).json({ error: 'Album not found.' });

    // Clean up R2 files before deleting DB record
    const r2 = require('../services/r2.service');
    const mediaRows = await db.query(
      'SELECT r2_key FROM media WHERE album_id = $1 AND r2_key IS NOT NULL', [req.params.albumId]
    );
    await Promise.allSettled(mediaRows.rows.map(m => r2.deleteFile(m.r2_key)));

    const { avatar_key, cover_key } = albumRes.rows[0];
    if (avatar_key) await r2.deleteFile(avatar_key).catch(() => {});
    if (cover_key)  await r2.deleteFile(cover_key).catch(() => {});

    await db.query('DELETE FROM albums WHERE id = $1', [req.params.albumId]);
    logAction(req.adminId, 'delete_album', 'album', req.params.albumId, albumRes.rows[0], req.ip);
    res.json({ message: 'Album deleted.' });
  } catch (err) { next(err); }
};

// ── CREATE SUBSCRIBER ─────────────────────────────────────────

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, subscriptionPlan, subscriptionStatus } = req.body;

    if (!name?.trim() || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Invalid email address format.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (password.length > 128)
      return res.status(400).json({ error: 'Password must be 128 characters or less.' });

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already in use.' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users
         (name, email, password_hash, is_email_verified, subscription_status, subscription_plan)
       VALUES ($1,$2,$3,true,$4,$5)
       RETURNING id, name, email, subscription_status, subscription_plan, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash,
       subscriptionStatus || 'active',
       subscriptionPlan   || 'monthly']
    );
    logAction(req.adminId, 'create_user', 'user', result.rows[0].id, { name, email }, req.ip);
    res.status(201).json({ user: result.rows[0] });
  } catch (err) { next(err); }
};

// ── USER'S ALBUMS ─────────────────────────────────────────────

exports.getUserAlbums = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*,
         (SELECT COUNT(*) FROM media m WHERE m.album_id = a.id AND m.type != 'tribute') AS media_count,
         (SELECT COUNT(*) FROM media m WHERE m.album_id = a.id AND m.type = 'tribute')  AS tribute_count
       FROM albums a WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
      [req.params.userId]
    );
    res.json({ albums: result.rows });
  } catch (err) { next(err); }
};

// ── TRANSACTIONS ──────────────────────────────────────────────

exports.listTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));

    const [transactions, stats] = await Promise.all([
      db.query(`
        SELECT t.*, u.name AS user_name, u.email AS user_email
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      // FIX: include 'paid' status
      db.query(`
        SELECT
          COUNT(*) AS total_count,
          COALESCE(SUM(amount_inr), 0) AS total_revenue,
          COALESCE(SUM(amount_inr) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) AS revenue_30d
        FROM transactions WHERE status IN ('captured','paid')
      `),
    ]);

    res.json({ transactions: transactions.rows, stats: stats.rows[0] });
  } catch (err) { next(err); }
};

// ── ACTIVITY LOG ──────────────────────────────────────────────

exports.listRefundRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, status = 'all', search = '' } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pg - 1) * lim;
    const params = [];
    const conditions = [];

    if (status && status !== 'all') {
      params.push(String(status).trim().toLowerCase());
      conditions.push(`r.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${String(search).trim()}%`);
      conditions.push(`(
        u.name ILIKE $${params.length}
        OR u.email ILIKE $${params.length}
        OR COALESCE(i.invoice_number, '') ILIKE $${params.length}
        OR COALESCE(t.razorpay_payment_id, '') ILIKE $${params.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const listParams = [...params, lim, offset];

    const [refundsRes, totalRes] = await Promise.all([
      db.query(
        `SELECT r.*,
                u.name AS user_name, u.email AS user_email,
                i.invoice_number,
                t.plan, t.status AS transaction_status, t.amount_inr AS transaction_amount_inr,
                t.amount_paise AS transaction_amount_paise, t.razorpay_payment_id,
                a.name AS reviewer_name
         FROM refund_requests r
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN invoices i ON i.id = r.invoice_id
         LEFT JOIN transactions t ON t.id = r.transaction_id
         LEFT JOIN admins a ON a.id = r.reviewer_admin_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM refund_requests r
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN invoices i ON i.id = r.invoice_id
         LEFT JOIN transactions t ON t.id = r.transaction_id
         ${where}`,
        params
      ),
    ]);

    res.json({
      refunds: refundsRes.rows,
      total: totalRes.rows[0]?.count || 0,
      page: pg,
      limit: lim,
    });
  } catch (err) { next(err); }
};

exports.updateRefundRequest = async (req, res, next) => {
  try {
    const { status = null, approvedAmountInr = null, adminNotes = null } = req.body || {};
    const normalizedStatus = status ? String(status).trim().toLowerCase() : null;
    const allowedStatuses = new Set(['approved', 'rejected']);
    if (normalizedStatus && !allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Only approved or rejected status updates are allowed here.' });
    }

    const existingRes = await db.query(
      `SELECT r.*, u.name AS user_name, u.email AS user_email
       FROM refund_requests r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.id = $1`,
      [req.params.refundId]
    );
    if (!existingRes.rows.length) {
      return res.status(404).json({ error: 'Refund request not found.' });
    }

    const refund = existingRes.rows[0];
    const approvedAmountPaise = approvedAmountInr != null
      ? Math.min(refund.requested_amount_paise, toPaiseFromInr(approvedAmountInr) || refund.requested_amount_paise)
      : refund.approved_amount_paise;

    const result = await db.query(
      `UPDATE refund_requests
       SET status = COALESCE($1, status),
           approved_amount_paise = COALESCE($2, approved_amount_paise),
           approved_amount_inr = CASE
             WHEN $2 IS NOT NULL THEN $3
             ELSE approved_amount_inr
           END,
           admin_notes = COALESCE($4, admin_notes),
           reviewer_admin_id = $5,
           reviewed_at = NOW(),
           rejected_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE rejected_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        normalizedStatus,
        approvedAmountPaise,
        approvedAmountPaise != null ? toINR(approvedAmountPaise) : null,
        adminNotes != null ? String(adminNotes).trim() || null : null,
        req.adminId,
        req.params.refundId,
      ]
    );

    logAction(req.adminId, 'update_refund_request', 'refund_request', req.params.refundId, {
      status: normalizedStatus,
      approvedAmountPaise,
    }, req.ip);

    if (refund.user_email) {
      emailService.sendRefundStatusUpdate(
        { id: refund.user_id, name: refund.user_name, email: refund.user_email },
        result.rows[0]
      ).catch(() => {});
    }

    res.json({ refund: result.rows[0] });
  } catch (err) { next(err); }
};

exports.processRefundRequest = async (req, res, next) => {
  const client = await db.getClient();
  let released = false;
  try {
    await client.query('BEGIN');

    const refundRes = await client.query(
      `SELECT r.*,
              u.name AS user_name, u.email AS user_email,
              t.razorpay_payment_id, t.amount_paise AS transaction_amount_paise
       FROM refund_requests r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN transactions t ON t.id = r.transaction_id
       WHERE r.id = $1
       FOR UPDATE`,
      [req.params.refundId]
    );
    if (!refundRes.rows.length) {
      await client.query('ROLLBACK');
      client.release();
      released = true;
      return res.status(404).json({ error: 'Refund request not found.' });
    }

    const refund = refundRes.rows[0];
    if (!['approved', 'failed'].includes(refund.status)) {
      await client.query('ROLLBACK');
      client.release();
      released = true;
      return res.status(400).json({ error: 'Only approved refunds can be processed.' });
    }

    const paymentId = refund.razorpay_payment_id;
    if (!paymentId) {
      await client.query('ROLLBACK');
      client.release();
      released = true;
      return res.status(400).json({ error: 'This transaction does not have a Razorpay payment ID.' });
    }

    const amountPaise = refund.approved_amount_paise || refund.requested_amount_paise;
    await client.query(
      `UPDATE refund_requests
       SET status = 'processing',
           reviewer_admin_id = $1,
           reviewed_at = COALESCE(reviewed_at, NOW()),
           updated_at = NOW()
       WHERE id = $2`,
      [req.adminId, req.params.refundId]
    );
    await client.query('COMMIT');
    client.release();
    released = true;

    let razorpayRefund;
    try {
      const razorpay = getRazorpay();
      razorpayRefund = await razorpay.payments.refund(paymentId, {
        amount: amountPaise,
        notes: {
          refundRequestId: req.params.refundId,
          adminId: req.adminId,
        },
      });
    } catch (err) {
      await db.query(
        `UPDATE refund_requests
         SET status = 'failed',
             admin_notes = COALESCE(admin_notes, $1),
             reviewer_admin_id = $2,
             reviewed_at = COALESCE(reviewed_at, NOW()),
             updated_at = NOW()
         WHERE id = $3`,
        [err?.error?.description || err.message || 'Refund processing failed.', req.adminId, req.params.refundId]
      );
      throw err;
    }

    const finalStatus = razorpayRefund?.status === 'processed' ? 'processed' : 'processing';
    const updateRes = await db.query(
      `UPDATE refund_requests
       SET status = $1,
           processed_at = CASE WHEN $1 = 'processed' THEN NOW() ELSE processed_at END,
           razorpay_refund_id = $2,
           razorpay_refund_status = $3,
           raw_payload = $4,
           reviewer_admin_id = $5,
           reviewed_at = COALESCE(reviewed_at, NOW()),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        finalStatus,
        razorpayRefund?.id || null,
        razorpayRefund?.status || null,
        razorpayRefund ? JSON.stringify(razorpayRefund) : null,
        req.adminId,
        req.params.refundId,
      ]
    );

    logAction(req.adminId, 'process_refund_request', 'refund_request', req.params.refundId, {
      razorpayRefundId: razorpayRefund?.id || null,
      amountPaise,
      status: finalStatus,
    }, req.ip);

    if (refund.user_email) {
      emailService.sendRefundStatusUpdate(
        { id: refund.user_id, name: refund.user_name, email: refund.user_email },
        updateRes.rows[0]
      ).catch(() => {});
    }

    res.json({ refund: updateRes.rows[0] });
  } catch (err) {
    if (!released) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      client.release();
    }
    next(err);
  }
};

exports.listSupportInbox = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const statusRaw = String(req.query.status || 'all').trim().toLowerCase();
    const assignedRaw = String(req.query.assigned || 'all').trim();

    const params = [];
    const conditions = [];

    if (statusRaw !== 'all') {
      const status = normalizeSupportStatus(statusRaw);
      if (!status) {
        return res.status(400).json({ error: 'Invalid support status filter.' });
      }
      params.push(status);
      conditions.push(`s.ticket_status = $${params.length}`);
    }

    if (assignedRaw === 'me') {
      params.push(req.adminId);
      conditions.push(`s.assigned_admin_id = $${params.length}`);
    } else if (assignedRaw === 'unassigned') {
      conditions.push('s.assigned_admin_id IS NULL');
    } else if (assignedRaw && assignedRaw !== 'all') {
      const assignedAdminId = normalizeUuid(assignedRaw);
      if (!assignedAdminId) {
        return res.status(400).json({ error: 'Invalid assigned admin filter.' });
      }
      params.push(assignedAdminId);
      conditions.push(`s.assigned_admin_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        COALESCE(s.subject, '') ILIKE $${params.length}
        OR COALESCE(s.from_email, '') ILIKE $${params.length}
        OR COALESCE(s.from_name, '') ILIKE $${params.length}
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const listParams = [...params, limit, offset];

    const [ticketsResult, totalResult, statsResult, adminsResult] = await Promise.all([
      db.query(
        `SELECT
           s.id,
           s.email_id,
           s.message_id,
           s.thread_token,
           s.from_email,
           s.from_name,
           s.to_email,
           s.subject,
           s.attachment_count,
           s.ticket_status,
           s.assigned_admin_id,
           s.body_text,
           s.body_html,
           s.received_at,
           s.replied_at,
           s.last_message_at,
           s.archived_at,
           a.name AS assigned_admin_name,
           COALESCE(
             CASE
               WHEN COALESCE(lr.created_at, TO_TIMESTAMP(0)) >= GREATEST(COALESCE(lm.received_at, TO_TIMESTAMP(0)), COALESCE(s.received_at, TO_TIMESTAMP(0)))
                 THEN lr.body_text
               WHEN COALESCE(lm.received_at, TO_TIMESTAMP(0)) >= COALESCE(s.received_at, TO_TIMESTAMP(0))
                 THEN lm.body_text
               ELSE s.body_text
             END,
             ''
           ) AS preview_text,
           lr.created_at AS last_reply_at,
           lr.body_text AS last_reply_body,
           lr.delivery_status AS last_reply_status,
           lm.received_at AS last_inbound_at,
           lm.body_text AS last_inbound_body,
           COALESCE(sm.message_count, 0)::int + COALESCE(sr.reply_count, 0)::int + 1 AS message_count
         FROM support_inbox s
         LEFT JOIN admins a ON a.id = s.assigned_admin_id
         LEFT JOIN LATERAL (
           SELECT sm.body_text, sm.received_at
           FROM support_messages sm
           WHERE sm.support_inbox_id = s.id
           ORDER BY sm.received_at DESC
           LIMIT 1
         ) lm ON TRUE
         LEFT JOIN LATERAL (
           SELECT sr.body_text, sr.created_at, el.status AS delivery_status
           FROM support_replies sr
           LEFT JOIN email_log el ON el.resend_id = sr.resend_id
           WHERE sr.support_inbox_id = s.id
           ORDER BY sr.created_at DESC
           LIMIT 1
         ) lr ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS message_count
           FROM support_messages sm
           WHERE sm.support_inbox_id = s.id
         ) sm ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS reply_count
           FROM support_replies sr
           WHERE sr.support_inbox_id = s.id
         ) sr ON TRUE
         ${where}
         ORDER BY COALESCE(s.last_message_at, lr.created_at, lm.received_at, s.replied_at, s.received_at) DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      ),
      db.query(`SELECT COUNT(*) FROM support_inbox s ${where}`, params),
      db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE ticket_status = 'open')::int AS open_count,
           COUNT(*) FILTER (WHERE ticket_status = 'in_progress')::int AS in_progress_count,
           COUNT(*) FILTER (WHERE ticket_status = 'waiting_customer')::int AS waiting_customer_count,
           COUNT(*) FILTER (WHERE ticket_status = 'resolved')::int AS resolved_count,
           COUNT(*) FILTER (WHERE ticket_status = 'archived')::int AS archived_count
         FROM support_inbox`
      ),
      db.query(
        `SELECT id, name, email
         FROM admins
         WHERE is_active = TRUE
         ORDER BY name ASC`
      ),
    ]);

    res.json({
      tickets: ticketsResult.rows,
      total: parseInt(totalResult.rows[0].count, 10),
      page,
      limit,
      stats: statsResult.rows[0],
      admins: adminsResult.rows,
    });
  } catch (err) { next(err); }
};

exports.getSupportTicket = async (req, res, next) => {
  try {
    const ticketResult = await db.query(
      `SELECT
         s.*,
         a.name AS assigned_admin_name,
         a.email AS assigned_admin_email
       FROM support_inbox s
       LEFT JOIN admins a ON a.id = s.assigned_admin_id
       WHERE s.id = $1`,
      [req.params.ticketId]
    );

    if (!ticketResult.rows.length) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    const ticket = ticketResult.rows[0];

    const [messagesResult, repliesResult, eventsResult] = await Promise.all([
      db.query(
        `SELECT
           sm.*
         FROM support_messages sm
         WHERE sm.support_inbox_id = $1
         ORDER BY sm.received_at ASC`,
        [req.params.ticketId]
      ),
      db.query(
        `SELECT
           sr.*,
           a.name AS admin_name,
           a.email AS admin_email,
           COALESCE(el.status, 'sent') AS delivery_status
         FROM support_replies sr
         LEFT JOIN admins a ON a.id = sr.admin_id
         LEFT JOIN email_log el ON el.resend_id = sr.resend_id
         WHERE sr.support_inbox_id = $1
         ORDER BY sr.created_at ASC`,
        [req.params.ticketId]
      ),
      db.query(
        `SELECT
           webhook_id,
           event_type,
           email_id,
           recipient_email,
           sender_email,
           subject,
           received_at,
           processed_at,
           status,
           error_message
         FROM resend_webhook_events
         WHERE webhook_id = $1
            OR email_id = $2
            OR webhook_id IN (
              SELECT sm.webhook_id
              FROM support_messages sm
              WHERE sm.support_inbox_id = $3
            )
            OR email_id IN (
              SELECT sr.resend_id
              FROM support_replies sr
              WHERE sr.support_inbox_id = $3
            )
         ORDER BY received_at DESC
         LIMIT 50`,
        [ticket.webhook_id, ticket.email_id, req.params.ticketId]
      ),
    ]);

    const messages = [
      {
        id: ticket.id,
        direction: 'inbound',
        source: 'ticket',
        subject: ticket.subject,
        body_text: ticket.body_text || plainTextFromHtml(ticket.body_html),
        body_html: ticket.body_html,
        from_email: ticket.from_email,
        from_name: ticket.from_name,
        to_email: ticket.to_email,
        attachment_count: ticket.attachment_count,
        message_id: ticket.message_id,
        created_at: ticket.received_at,
      },
      ...messagesResult.rows.map((message) => ({
        id: message.id,
        direction: 'inbound',
        source: 'message',
        subject: message.subject,
        body_text: message.body_text || plainTextFromHtml(message.body_html),
        body_html: message.body_html,
        from_email: message.from_email,
        from_name: message.from_name,
        to_email: message.to_email,
        attachment_count: message.attachment_count,
        message_id: message.message_id,
        created_at: message.received_at,
      })),
      ...repliesResult.rows.map((reply) => ({
        id: reply.id,
        direction: 'outbound',
        source: 'reply',
        subject: reply.subject,
        body_text: reply.body_text,
        from_email: reply.admin_email || process.env.SUPPORT_EMAIL || null,
        from_name: reply.admin_name || 'Admin',
        to_email: reply.to_email,
        delivery_status: reply.delivery_status,
        resend_id: reply.resend_id,
        created_at: reply.created_at,
      })),
    ].sort((left, right) => new Date(left.created_at) - new Date(right.created_at));

    res.json({
      ticket: {
        ...ticket,
        thread_address: buildSupportThreadAddress(ticket.thread_token || ticket.id?.replace(/-/g, '')),
      },
      inboundMessages: messagesResult.rows,
      replies: repliesResult.rows,
      messages,
      events: eventsResult.rows,
    });
  } catch (err) { next(err); }
};

exports.updateSupportTicket = async (req, res, next) => {
  try {
    const hasStatus = Object.prototype.hasOwnProperty.call(req.body, 'ticketStatus');
    const hasAssigned = Object.prototype.hasOwnProperty.call(req.body, 'assignedAdminId');

    if (!hasStatus && !hasAssigned) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const sets = [];
    const params = [];
    const details = {};

    if (hasStatus) {
      const status = normalizeSupportStatus(req.body.ticketStatus);
      if (!status) {
        return res.status(400).json({ error: 'Invalid support status.' });
      }

      params.push(status);
      sets.push(`ticket_status = $${params.length}`);
      sets.push(`archived_at = ${status === 'archived' ? 'NOW()' : 'NULL'}`);
      details.ticketStatus = status;
    }

    if (hasAssigned) {
      let assignedAdminId = req.body.assignedAdminId;
      if (assignedAdminId === '' || assignedAdminId === 'unassigned') {
        assignedAdminId = null;
      } else if (assignedAdminId != null) {
        assignedAdminId = normalizeUuid(assignedAdminId);
        if (!assignedAdminId) {
          return res.status(400).json({ error: 'Invalid assigned admin.' });
        }

        const adminCheck = await db.query(
          'SELECT id FROM admins WHERE id = $1 AND is_active = TRUE',
          [assignedAdminId]
        );
        if (!adminCheck.rows.length) {
          return res.status(404).json({ error: 'Assigned admin not found.' });
        }
      }

      params.push(assignedAdminId);
      sets.push(`assigned_admin_id = $${params.length}`);
      details.assignedAdminId = assignedAdminId;
    }

    params.push(req.params.ticketId);

    const result = await db.query(
      `UPDATE support_inbox
       SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    logAction(req.adminId, 'update_support_ticket', 'support_ticket', req.params.ticketId, details, req.ip);

    res.json({ ticket: result.rows[0] });
  } catch (err) { next(err); }
};

exports.replyToSupportTicket = async (req, res, next) => {
  try {
    const rawBody = String(req.body.bodyText || '').trim();
    if (!rawBody) {
      return res.status(400).json({ error: 'Reply message is required.' });
    }
    if (rawBody.length > 20000) {
      return res.status(400).json({ error: 'Reply message is too long.' });
    }

    const ticketResult = await db.query(
      `SELECT *
       FROM support_inbox
       WHERE id = $1`,
      [req.params.ticketId]
    );

    if (!ticketResult.rows.length) {
      return res.status(404).json({ error: 'Support ticket not found.' });
    }

    const ticket = ticketResult.rows[0];
    if (!ticket.from_email || !isValidEmail(ticket.from_email)) {
      return res.status(400).json({ error: 'This ticket does not have a valid recipient email.' });
    }

    const messageIdsResult = await db.query(
      `SELECT message_id, received_at
       FROM (
         SELECT s.message_id, s.received_at
         FROM support_inbox s
         WHERE s.id = $1
         UNION ALL
         SELECT sm.message_id, sm.received_at
         FROM support_messages sm
         WHERE sm.support_inbox_id = $1
       ) inbound
       WHERE message_id IS NOT NULL
       ORDER BY received_at ASC`,
      [req.params.ticketId]
    );

    const messageIds = [...new Set(messageIdsResult.rows.map((row) => row.message_id).filter(Boolean))];
    const inReplyTo = messageIds[messageIds.length - 1] || ticket.message_id || null;
    const references = messageIds.slice(-10).join(' ') || null;
    const subject = ensureReplySubject(req.body.subject, ticket.subject || 'Support request');
    const replyTo = buildSupportThreadAddress(ticket.thread_token || ticket.id?.replace(/-/g, ''));

    const sendResult = await emailService.sendSupportReply({
      to: ticket.from_email,
      subject,
      bodyText: rawBody,
      inReplyTo,
      references,
      replyTo,
    });

    const resendId = sendResult?.data?.id || null;
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const replyResult = await client.query(
        `INSERT INTO support_replies
           (support_inbox_id, admin_id, to_email, subject, body_text, resend_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [req.params.ticketId, req.adminId, ticket.from_email, subject, rawBody, resendId]
      );

      await client.query(
        `UPDATE support_inbox
         SET replied_at = NOW(),
             last_message_at = NOW(),
             assigned_admin_id = COALESCE(assigned_admin_id, $2),
             ticket_status = CASE
               WHEN ticket_status IN ('resolved', 'archived') THEN ticket_status
               ELSE 'waiting_customer'
             END
         WHERE id = $1`,
        [req.params.ticketId, req.adminId]
      );

      if (resendId) {
        await client.query(
          `INSERT INTO email_log (user_id, email_to, type, resend_id, status)
           VALUES (NULL, $1, 'supportReply', $2, 'sent')`,
          [ticket.from_email, resendId]
        ).catch(() => {});
      }

      await client.query('COMMIT');

      logAction(req.adminId, 'reply_support_ticket', 'support_ticket', req.params.ticketId, {
        to: ticket.from_email,
        subject,
        resendId,
        replyTo,
      }, req.ip);

      res.status(201).json({
        reply: {
          ...replyResult.rows[0],
          admin_name: req.admin.name,
          admin_email: req.admin.email,
          delivery_status: 'sent',
          reply_to: replyTo,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
};

exports.activityLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));

    const result = await db.query(`
      SELECT l.*, a.name AS admin_name, a.email AS admin_email
      FROM admin_log l
      LEFT JOIN admins a ON a.id = l.admin_id
      ORDER BY l.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({ logs: result.rows });
  } catch (err) { next(err); }
};


// ── ADMIN MEDIA MANAGEMENT ────────────────────────────────────
// Allow admin to upload/manage media on behalf of any subscriber

exports.adminGetAlbumMedia = async (req, res, next) => {
  try {
    const albumCheck = await db.query('SELECT id FROM albums WHERE id = $1', [req.params.albumId]);
    if (!albumCheck.rows.length) return res.status(404).json({ error: 'Album not found.' });

    const result = await db.query(
      `SELECT *,
         CASE WHEN r2_key IS NOT NULL
           THEN CONCAT($1::text, '/', r2_key) ELSE NULL END AS url
       FROM media WHERE album_id = $2
       ORDER BY display_order, created_at`,
      [process.env.R2_PUBLIC_URL, req.params.albumId]
    );
    res.json({ media: result.rows });
  } catch (err) { next(err); }
};

exports.adminUploadMedia = async (req, res, next) => {
  try {
    const { type } = req.body;
    const albumCheck = await db.query(
      'SELECT id, user_id FROM albums WHERE id = $1', [req.params.albumId]
    );
    if (!albumCheck.rows.length) return res.status(404).json({ error: 'Album not found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!['photo', 'video', 'audio'].includes(type))
      return res.status(400).json({ error: 'Invalid media type.' });

    const { key, url, size } = await r2.uploadFile({
      buffer: req.file.buffer, mimetype: req.file.mimetype,
      originalname: req.file.originalname, albumId: req.params.albumId, type,
    });

    const result = await db.query(
      `INSERT INTO media (album_id, user_id, type, r2_key, file_name, file_size, mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.albumId, albumCheck.rows[0].user_id, type, key,
       req.file.originalname, size, req.file.mimetype]
    );

    logAction(req.adminId, 'admin_upload_media', 'media', result.rows[0].id,
      { albumId: req.params.albumId, type }, req.ip);

    res.status(201).json({ media: { ...result.rows[0], url } });
  } catch (err) { next(err); }
};

exports.adminAddTribute = async (req, res, next) => {
  try {
    const albumCheck = await db.query(
      'SELECT id, user_id FROM albums WHERE id = $1', [req.params.albumId]
    );
    if (!albumCheck.rows.length) return res.status(404).json({ error: 'Album not found.' });

    const text = String(req.body.text || '').replace(/<[^>]*>/g, '').trim();
    const from = String(req.body.from || '').replace(/<[^>]*>/g, '').trim();

    if (!text) return res.status(400).json({ error: 'Tribute text is required.' });
    if (text.length > 2000) return res.status(400).json({ error: 'Tribute must be 2000 characters or less.' });

    const result = await db.query(
      `INSERT INTO media (album_id, user_id, type, tribute_text, tribute_from)
       VALUES ($1,$2,'tribute',$3,$4) RETURNING *`,
      [req.params.albumId, albumCheck.rows[0].user_id, text, from || null]
    );

    logAction(req.adminId, 'admin_add_tribute', 'media', result.rows[0].id,
      { albumId: req.params.albumId }, req.ip);
    res.status(201).json({ media: result.rows[0] });
  } catch (err) { next(err); }
};

exports.adminDeleteMedia = async (req, res, next) => {
  try {
    const mediaRes = await db.query(
      'SELECT m.* FROM media m JOIN albums a ON a.id = m.album_id WHERE m.id = $1',
      [req.params.mediaId]
    );
    if (!mediaRes.rows.length) return res.status(404).json({ error: 'Media not found.' });

    const media = mediaRes.rows[0];
    if (media.r2_key) await r2.deleteFile(media.r2_key).catch(() => {});

    await db.query('DELETE FROM media WHERE id = $1', [media.id]);
    logAction(req.adminId, 'admin_delete_media', 'media', media.id, {}, req.ip);
    res.json({ message: 'Media deleted.' });
  } catch (err) { next(err); }
};

// ── ADMIN INVOICES ─────────────────────────────────────────────

exports.listInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const params = userId ? [userId, limit, offset] : [limit, offset];
    const where  = userId ? 'WHERE i.user_id = $1' : '';

    const result = await db.query(`
      SELECT i.*, t.razorpay_payment_id
      FROM invoices i
      LEFT JOIN transactions t ON t.id = i.transaction_id
      ${where}
      ORDER BY i.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await db.query(
      `SELECT COUNT(*) FROM invoices i ${where}`,
      userId ? [userId] : []
    );

    res.json({ invoices: result.rows, total: parseInt(total.rows[0].count) });
  } catch (err) { next(err); }
};

exports.downloadInvoice = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.invoiceId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found.' });

    const pdf = await invoiceService.generateInvoicePDF(result.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${result.rows[0].invoice_number}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
};

// ── ACCOUNT BACKUP (ZIP) ───────────────────────────────────────

exports.downloadBackup = async (req, res, next) => {
  try {
    const userRes = await db.query('SELECT name, email FROM users WHERE id = $1', [req.params.userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found.' });

    const safeName = userRes.rows[0].name.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const filename  = `backup-${safeName}-${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    logAction(req.adminId, 'download_backup', 'user', req.params.userId,
      { email: userRes.rows[0].email }, req.ip);

    await generateBackupZip(req.params.userId, res);
  } catch (err) { next(err); }
};

// ── AFFILIATE MANAGEMENT (admin delegates to affiliate controller) ─────────────
// Routes are wired in admin.routes.js — functions live in affiliate.controller.js

// ── MANUAL CRON TRIGGER ───────────────────────────────────────
// POST /api/admin/cron/run/:job
// Allows admin to manually fire any automation job from the dashboard
exports.runCronJob = async (req, res, next) => {
  try {
    const cronService = require('../services/cron.service');

    const ALLOWED_JOBS = {
      'anniversary-reminders':    cronService.runAnniversaryReminders,
      'expiry-warnings':          cronService.runExpiryWarnings,
      'grace-period':             cronService.runGracePeriodEnforcement,
      'lifetime-expiry':          cronService.runLifetimeExpiryCheck,
      'affiliate-alerts':         cronService.runAffiliateApplicationAlerts,
      'daily-digest':             cronService.runDailySignupDigest,
      'commission-reminder':      cronService.runCommissionPayoutReminder,
      'media-quota-warnings':     cronService.runMediaQuotaWarnings,
      'renewal-reminders':        cronService.runRenewalReminders,
      'expired-data-cleanup':     cronService.runExpiredDataCleanup,
      'studio-grace-period':      cronService.runStudioGracePeriodEnforcement,
      'studio-invite-cleanup':    cronService.runStudioInviteCleanup,
    };

    const job = ALLOWED_JOBS[req.params.job];
    if (!job) {
      return res.status(400).json({
        error: `Unknown job. Available: ${Object.keys(ALLOWED_JOBS).join(', ')}`,
      });
    }

    logAction(req.adminId, 'manual_cron_trigger', 'system', null,
      { job: req.params.job }, req.ip);

    // Run async — respond immediately so admin UI doesn't timeout
    job().catch(err => console.error(`[ADMIN CRON] Manual run of ${req.params.job} failed:`, err.message));

    res.json({ message: `Job "${req.params.job}" triggered. Check server logs for output.`, job: req.params.job });
  } catch (err) { next(err); }
};

// ── STUDIO MANAGEMENT (admin) ────────────────────────────────────────────

exports.listStudios = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const pg     = Math.max(1, parseInt(page));
    const lim    = Math.min(100, parseInt(limit));
    const offset = (pg - 1) * lim;

    // Build dynamic WHERE + params list correctly using $N placeholders
    const listParams  = [];
    const countParams = [];
    let where = '';

    if (search) {
      listParams.push(`%${search}%`);
      countParams.push(`%${search}%`);
      where = 'WHERE (s.name ILIKE $1 OR u.email ILIKE $1)';
    }

    // LIMIT and OFFSET always come last
    listParams.push(lim, offset);

    const [studios, total] = await Promise.all([
      db.query(
        `SELECT s.id, s.name, s.email, s.is_active, s.albums_used, s.album_quota, s.created_at,
                u.id AS owner_id, u.name AS owner_name, u.email AS owner_email,
                ss.plan_slug, ss.status AS sub_status,
                ss.album_quota AS sub_album_quota, ss.seat_quota,
                ss.current_period_end, ss.cancel_at_period_end,
                COUNT(DISTINCT sm.user_id)::int AS member_count,
                COUNT(DISTINCT a.id)::int       AS total_albums
         FROM studios s
         JOIN users u ON u.id = s.owner_user_id
         LEFT JOIN LATERAL (
           SELECT plan_slug, status, album_quota, seat_quota,
                  current_period_end, cancel_at_period_end
           FROM studio_subscriptions
           WHERE studio_id = s.id AND status IN ('active','trialing')
           ORDER BY created_at DESC LIMIT 1
         ) ss ON TRUE
         LEFT JOIN studio_members sm ON sm.studio_id = s.id
         LEFT JOIN albums a ON a.studio_id = s.id
         ${where}
         GROUP BY s.id, u.id, u.name, u.email,
                  ss.plan_slug, ss.status, ss.album_quota, ss.seat_quota,
                  ss.current_period_end, ss.cancel_at_period_end
         ORDER BY s.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      ),
      db.query(
        `SELECT COUNT(*) FROM studios s JOIN users u ON u.id = s.owner_user_id ${where}`,
        countParams
      ),
    ]);

    res.json({ studios: studios.rows, total: parseInt(total.rows[0].count), page: pg, limit: lim });
  } catch (err) { next(err); }
};

exports.getStudioAdmin = async (req, res, next) => {
  try {
    const [studioRes, subsRes, membersRes, auditsRes, albumsRes] = await Promise.all([
      db.query(
        `SELECT s.*, u.name AS owner_name, u.email AS owner_email
         FROM studios s JOIN users u ON u.id = s.owner_user_id WHERE s.id = $1`,
        [req.params.studioId]
      ),
      db.query(
        'SELECT * FROM studio_subscriptions WHERE studio_id = $1 ORDER BY created_at DESC LIMIT 10',
        [req.params.studioId]
      ),
      db.query(
        `SELECT sm.role, sm.joined_at, u.id, u.name, u.email
         FROM studio_members sm JOIN users u ON u.id = sm.user_id
         WHERE sm.studio_id = $1 ORDER BY sm.joined_at`,
        [req.params.studioId]
      ),
      db.query(
        'SELECT * FROM studio_audit_log WHERE studio_id = $1 ORDER BY created_at DESC LIMIT 25',
        [req.params.studioId]
      ),
      db.query(
        `SELECT a.id, a.name, a.slug, a.type, a.is_published, a.view_count, a.created_at,
                COUNT(m.id)::int AS media_count
         FROM albums a
         LEFT JOIN media m ON m.album_id = a.id
         WHERE a.studio_id = $1
         GROUP BY a.id
         ORDER BY a.created_at DESC
         LIMIT 25`,
        [req.params.studioId]
      ),
    ]);
    if (!studioRes.rows.length) return res.status(404).json({ error: 'Studio not found.' });
    res.json({
      studio:        studioRes.rows[0],
      subscriptions: subsRes.rows,
      members:       membersRes.rows,
      auditLog:      auditsRes.rows,
      albums:        albumsRes.rows,
    });
  } catch (err) { next(err); }
};

exports.updateStudioAdmin = async (req, res, next) => {
  try {
    const { isActive, albumQuota } = req.body;
    const result = await db.query(
      `UPDATE studios SET
         is_active   = COALESCE($1, is_active),
         album_quota = COALESCE($2, album_quota),
         updated_at  = NOW()
       WHERE id = $3 RETURNING *`,
      [isActive   !== undefined ? Boolean(isActive) : null,
       albumQuota != null       ? parseInt(albumQuota) : null,
       req.params.studioId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Studio not found.' });
    logAction(req.adminId, 'admin_update_studio', 'studio', req.params.studioId,
      { isActive, albumQuota }, req.ip);
    res.json({ studio: result.rows[0] });
  } catch (err) { next(err); }
};

exports.grantStudioSubscription = async (req, res, next) => {
  try {
    const { planSlug = 'studio-starter', months = 1 } = req.body;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + Math.min(24, Math.max(1, parseInt(months))));

    const { STUDIO_PLAN_DEFAULTS } = require('../utils/studio-entitlement');
    const defaults = STUDIO_PLAN_DEFAULTS[planSlug] || STUDIO_PLAN_DEFAULTS['studio-starter'];

    await db.query(
      `INSERT INTO studio_subscriptions
         (studio_id, plan_slug, status, album_quota, seat_quota,
          branding_enabled, custom_domain_enabled, whitelabel_enabled,
          current_period_end, cancel_at_period_end)
       VALUES ($1,$2,'active',$3,$4,$5,$6,$7,$8,FALSE)`,
      [req.params.studioId, planSlug,
       defaults.albumQuota, defaults.seatQuota,
       defaults.brandingEnabled, defaults.customDomainEnabled, defaults.whitelabelEnabled,
       periodEnd]
    );
    await db.query(
      'UPDATE studios SET album_quota = $1 WHERE id = $2',
      [defaults.albumQuota, req.params.studioId]
    );
    logAction(req.adminId, 'admin_grant_studio_sub', 'studio', req.params.studioId,
      { planSlug, months, periodEnd }, req.ip);
    res.json({ message: `Studio subscription granted: ${planSlug} until ${periodEnd.toLocaleDateString('en-IN')}.` });
  } catch (err) { next(err); }
};

'use strict';
/**
 * admin.controller.ADDITIONS.js
 *
 * These exports are APPENDED to the existing admin.controller.js.
 * Paste this block at the end of admin.controller.js, before module.exports
 * (or simply append since the file uses individual exports.* statements).
 *
 * Covers:
 *   - User subscription config view + limit override
 *   - Physical orders management (list, update fulfillment)
 *   - Addon pricing management (list, update price)
 *   - Base pricing management (list, update rate/discount)
 *
 * All price-changing actions are written to admin_log for audit trail.
 * Uses existing logAction() helper already defined in admin.controller.js.
 */

// ── Required at top of admin.controller.js (already present) ──
// const db = require('../utils/db');
// const logAction = (adminId, action, ...) => ...
// const normalizeUuid = (value) => ...

// ═════════════════════════════════════════════════════════════════
// USER SUBSCRIPTION CONFIG
// ═════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/users/:userId/subscription-config
 * Returns the user's full active subscription config for both plan types,
 * plus all their user_subscriptions rows and physical orders.
 */
exports.getUserSubscriptionConfig = async (req, res, next) => {
  try {
    const userId = normalizeUuid(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    const [userRes, subsRes, physicalRes] = await Promise.all([
      db.query(
        `SELECT id, name, email, subscription_status, subscription_plan,
                memorial_plan, wedding_plan, current_period_end, album_quota
         FROM users WHERE id = $1`,
        [userId]
      ),
      db.query(
        `SELECT
           us.id,
           us.plan_slug,
           us.plan_type,
           us.status,
           us.payment_mode,
           us.current_period_end,
           us.cancel_at_period_end,
           us.grace_period_until,
           us.album_quota,
           us.created_at,
           us.config_id,
           -- Config snapshot columns
           sc.length_months,
           sc.base_photos,
           sc.base_videos,
           sc.extra_photo_packs,
           sc.extra_video_packs,
           sc.audio_enabled,
           sc.themes_enabled,
           sc.total_photos,
           sc.total_videos,
           sc.base_price_monthly_paise,
           sc.addon_price_monthly_paise,
           sc.total_monthly_paise,
           sc.length_discount_pct,
           sc.upfront_discount_pct,
           sc.total_charged_paise,
           -- Admin overrides
           sc.override_photos,
           sc.override_videos,
           sc.override_audio,
           sc.override_themes,
           sc.override_expiry,
           sc.override_note,
           sc.overridden_at
         FROM user_subscriptions us
         LEFT JOIN subscription_configs sc ON sc.id = us.config_id
         WHERE us.user_id = $1
         ORDER BY us.created_at DESC`,
        [userId]
      ),
      db.query(
        `SELECT id, order_type, amount_paise, payment_status, fulfillment_status,
                tracking_number, tracking_carrier, admin_notes,
                shipping_name, shipping_city, shipping_state, shipping_pincode,
                shipped_at, delivered_at, created_at
         FROM physical_orders
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found.' });

    res.json({
      user:           userRes.rows[0],
      subscriptions:  subsRes.rows,
      physicalOrders: physicalRes.rows,
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/admin/users/:userId/subscription-config
 * Override limits on a user's active subscription_configs row.
 * All fields are optional — only provided fields are updated.
 *
 * Body (all optional):
 *   overridePhotos  {number|null}   — null clears the override
 *   overrideVideos  {number|null}
 *   overrideAudio   {boolean|null}
 *   overrideThemes  {boolean|null}
 *   overrideExpiry  {string|null}   — ISO date string or null to clear
 *   overrideNote    {string}
 *   configId        {string}        — target a specific config row
 *                                     (defaults to most recent active)
 */
exports.overrideUserConfig = async (req, res, next) => {
  try {
    const userId = normalizeUuid(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    const {
      overridePhotos,
      overrideVideos,
      overrideAudio,
      overrideThemes,
      overrideExpiry,
      overrideNote,
      configId: bodyConfigId,
    } = req.body;

    // ── Resolve which config row to update ────────────────────
    let configId = normalizeUuid(bodyConfigId);

    if (!configId) {
      // Default to most recent active subscription_configs row for this user
      const activeRes = await db.query(
        `SELECT sc.id
         FROM subscription_configs sc
         JOIN user_subscriptions us ON us.config_id = sc.id
         WHERE sc.user_id = $1
           AND us.status IN ('active','trialing')
         ORDER BY us.created_at DESC
         LIMIT 1`,
        [userId]
      );
      if (!activeRes.rows.length)
        return res.status(404).json({ error: 'No active subscription config found for this user.' });
      configId = activeRes.rows[0].id;
    }

    // ── Validate photo/video overrides ────────────────────────
    if (overridePhotos !== undefined && overridePhotos !== null) {
      if (!Number.isInteger(Number(overridePhotos)) || Number(overridePhotos) < 0)
        return res.status(400).json({ error: 'overridePhotos must be a non-negative integer or null.' });
    }
    if (overrideVideos !== undefined && overrideVideos !== null) {
      if (!Number.isInteger(Number(overrideVideos)) || Number(overrideVideos) < 0)
        return res.status(400).json({ error: 'overrideVideos must be a non-negative integer or null.' });
    }

    // ── Validate overrideExpiry ───────────────────────────────
    let expiryDate = undefined; // undefined = don't touch
    if (overrideExpiry === null) {
      expiryDate = null; // explicit clear
    } else if (overrideExpiry !== undefined) {
      const parsed = new Date(overrideExpiry);
      if (isNaN(parsed.getTime()))
        return res.status(400).json({ error: 'overrideExpiry must be a valid ISO date string or null.' });
      if (parsed < new Date())
        return res.status(400).json({ error: 'overrideExpiry must be a future date.' });
      expiryDate = parsed;
    }

    // ── Build SET clauses dynamically (only update provided fields) ──
    const setClauses = [];
    const params     = [];
    let   p          = 1;

    const addField = (col, value) => {
      setClauses.push(`${col} = $${p++}`);
      params.push(value);
    };

    if (overridePhotos !== undefined) addField('override_photos', overridePhotos === null ? null : Number(overridePhotos));
    if (overrideVideos !== undefined) addField('override_videos', overrideVideos === null ? null : Number(overrideVideos));
    if (overrideAudio  !== undefined) addField('override_audio',  overrideAudio  === null ? null : Boolean(overrideAudio));
    if (overrideThemes !== undefined) addField('override_themes', overrideThemes === null ? null : Boolean(overrideThemes));
    if (expiryDate     !== undefined) addField('override_expiry', expiryDate);
    if (overrideNote   !== undefined) addField('override_note',   String(overrideNote || '').trim() || null);

    if (setClauses.length === 0)
      return res.status(400).json({ error: 'No override fields provided.' });

    // Always stamp who overrode and when
    setClauses.push(`overridden_by = $${p++}`);  params.push(req.adminId);
    setClauses.push(`overridden_at = NOW()`);
    setClauses.push(`updated_at    = NOW()`);

    params.push(configId);
    params.push(userId); // safety: ensure the config belongs to this user

    const result = await db.query(
      `UPDATE subscription_configs
       SET ${setClauses.join(', ')}
       WHERE id = $${p++} AND user_id = $${p++}
       RETURNING *`,
      params
    );

    if (!result.rows.length)
      return res.status(404).json({ error: 'Subscription config not found or does not belong to this user.' });

    logAction(req.adminId, 'override_user_config', 'subscription_config', configId, {
      userId,
      overridePhotos, overrideVideos, overrideAudio, overrideThemes,
      overrideExpiry, overrideNote,
    }, req.ip);

    res.json({ config: result.rows[0], message: 'Subscription limits updated.' });
  } catch (err) { next(err); }
};

// ═════════════════════════════════════════════════════════════════
// PHYSICAL ORDERS MANAGEMENT
// ═════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/physical-orders
 * List all physical orders with optional filters.
 * Query params: fulfillmentStatus, paymentStatus, page, limit
 */
exports.getPhysicalOrders = async (req, res, next) => {
  try {
    const {
      fulfillmentStatus,
      paymentStatus,
      page  = 1,
      limit = 50,
    } = req.query;

    const VALID_FULFILLMENT = ['pending','processing','shipped','delivered','cancelled'];
    const VALID_PAYMENT     = ['pending','paid','failed','refunded'];

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (fulfillmentStatus && VALID_FULFILLMENT.includes(fulfillmentStatus)) {
      conditions.push(`po.fulfillment_status = $${p++}`);
      params.push(fulfillmentStatus);
    }
    if (paymentStatus && VALID_PAYMENT.includes(paymentStatus)) {
      conditions.push(`po.payment_status = $${p++}`);
      params.push(paymentStatus);
    }

    const pageNum   = Math.max(1, parseInt(page,  10) || 1);
    const limitNum  = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset    = (pageNum - 1) * limitNum;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [ordersRes, countRes] = await Promise.all([
      db.query(
        `SELECT
           po.id,
           po.order_type,
           po.amount_paise,
           po.payment_status,
           po.fulfillment_status,
           po.tracking_number,
           po.tracking_carrier,
           po.admin_notes,
           po.shipping_name,
           po.shipping_phone,
           po.shipping_address_1,
           po.shipping_address_2,
           po.shipping_city,
           po.shipping_state,
           po.shipping_pincode,
           po.shipped_at,
           po.delivered_at,
           po.created_at,
           po.razorpay_order_id,
           po.razorpay_payment_id,
           -- User info
           u.id   AS user_id,
           u.name AS user_name,
           u.email AS user_email,
           -- Album info (nullable)
           a.name  AS album_name,
           a.slug  AS album_slug,
           a.type  AS album_type
         FROM physical_orders po
         JOIN users u ON u.id = po.user_id
         LEFT JOIN albums a ON a.id = po.album_id
         ${where}
         ORDER BY po.created_at DESC
         LIMIT $${p++} OFFSET $${p++}`,
        [...params, limitNum, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM physical_orders po ${where}`,
        params
      ),
    ]);

    res.json({
      orders:      ordersRes.rows,
      total:       countRes.rows[0]?.total || 0,
      page:        pageNum,
      limit:       limitNum,
      totalPages:  Math.ceil((countRes.rows[0]?.total || 0) / limitNum),
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/admin/physical-orders/:orderId
 * Update fulfillment status, tracking, and admin notes for a physical order.
 *
 * Body (all optional):
 *   fulfillmentStatus  {string}  — pending|processing|shipped|delivered|cancelled
 *   trackingNumber     {string}
 *   trackingCarrier    {string}
 *   adminNotes         {string}
 */
exports.updatePhysicalOrder = async (req, res, next) => {
  try {
    const orderId = normalizeUuid(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: 'Invalid order ID.' });

    const {
      fulfillmentStatus,
      trackingNumber,
      trackingCarrier,
      adminNotes,
    } = req.body;

    const VALID_FULFILLMENT = ['pending','processing','shipped','delivered','cancelled'];

    if (fulfillmentStatus !== undefined && !VALID_FULFILLMENT.includes(fulfillmentStatus))
      return res.status(400).json({ error: `Invalid fulfillmentStatus. Allowed: ${VALID_FULFILLMENT.join(', ')}.` });

    // ── Build SET clauses ─────────────────────────────────────
    const setClauses = [];
    const params     = [];
    let   p          = 1;

    if (fulfillmentStatus !== undefined) {
      setClauses.push(`fulfillment_status = $${p++}`);
      params.push(fulfillmentStatus);

      // Auto-stamp shipped_at / delivered_at timestamps
      if (fulfillmentStatus === 'shipped') {
        setClauses.push(`shipped_at = COALESCE(shipped_at, NOW())`);
      }
      if (fulfillmentStatus === 'delivered') {
        setClauses.push(`delivered_at = COALESCE(delivered_at, NOW())`);
      }
    }
    if (trackingNumber  !== undefined) { setClauses.push(`tracking_number  = $${p++}`); params.push(String(trackingNumber  || '').trim() || null); }
    if (trackingCarrier !== undefined) { setClauses.push(`tracking_carrier = $${p++}`); params.push(String(trackingCarrier || '').trim() || null); }
    if (adminNotes      !== undefined) { setClauses.push(`admin_notes      = $${p++}`); params.push(String(adminNotes      || '').trim() || null); }

    if (setClauses.length === 0)
      return res.status(400).json({ error: 'No fields to update.' });

    setClauses.push(`updated_at = NOW()`);
    params.push(orderId);

    const result = await db.query(
      `UPDATE physical_orders
       SET ${setClauses.join(', ')}
       WHERE id = $${p}
       RETURNING *`,
      params
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Physical order not found.' });

    logAction(req.adminId, 'update_physical_order', 'physical_order', orderId, {
      fulfillmentStatus, trackingNumber, trackingCarrier,
    }, req.ip);

    res.json({ order: result.rows[0], message: 'Order updated.' });
  } catch (err) { next(err); }
};

// ═════════════════════════════════════════════════════════════════
// ADDON PRICING MANAGEMENT
// ═════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/addon-pricing
 * Returns all addon_pricing rows including inactive ones.
 */
exports.getAddonPricing = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, key, label, price_paise, unit, is_recurring, is_active,
              updated_at, updated_by
       FROM addon_pricing
       ORDER BY is_recurring DESC, key`
    );
    res.json({
      addons: result.rows.map((r) => ({
        ...r,
        price_inr: r.price_paise / 100,
      })),
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/admin/addon-pricing/:key
 * Update the price (and optionally label/active status) for one addon.
 *
 * Body:
 *   pricePaise  {number}   — new price in paise (integer, > 0)
 *   priceInr    {number}   — alternative: price in INR (will convert to paise)
 *   label       {string}   — optional display label update
 *   isActive    {boolean}  — optional toggle
 *
 * Note: pricePaise takes priority over priceInr if both provided.
 */
exports.updateAddonPrice = async (req, res, next) => {
  try {
    const { key } = req.params;

    // Validate key exists
    const existing = await db.query(
      'SELECT id, key, price_paise FROM addon_pricing WHERE key = $1',
      [key]
    );
    if (!existing.rows.length)
      return res.status(404).json({ error: `Addon "${key}" not found.` });

    const { pricePaise, priceInr, label, isActive } = req.body;

    // ── Resolve price in paise ────────────────────────────────
    let newPricePaise;
    if (pricePaise !== undefined) {
      newPricePaise = parseInt(pricePaise, 10);
      if (!Number.isInteger(newPricePaise) || newPricePaise < 0)
        return res.status(400).json({ error: 'pricePaise must be a non-negative integer.' });
    } else if (priceInr !== undefined) {
      const inr = Number(priceInr);
      if (!Number.isFinite(inr) || inr < 0)
        return res.status(400).json({ error: 'priceInr must be a non-negative number.' });
      newPricePaise = Math.round(inr * 100);
    }

    const setClauses = [];
    const params     = [];
    let   p          = 1;

    if (newPricePaise !== undefined) { setClauses.push(`price_paise = $${p++}`); params.push(newPricePaise); }
    if (label         !== undefined) { setClauses.push(`label       = $${p++}`); params.push(String(label).trim()); }
    if (isActive      !== undefined) { setClauses.push(`is_active   = $${p++}`); params.push(Boolean(isActive)); }

    if (setClauses.length === 0)
      return res.status(400).json({ error: 'No fields to update.' });

    setClauses.push(`updated_by = $${p++}`); params.push(req.adminId);
    setClauses.push(`updated_at = NOW()`);
    params.push(key);

    const result = await db.query(
      `UPDATE addon_pricing
       SET ${setClauses.join(', ')}
       WHERE key = $${p}
       RETURNING *`,
      params
    );

    logAction(req.adminId, 'update_addon_pricing', 'addon_pricing', key, {
      oldPricePaise: existing.rows[0].price_paise,
      newPricePaise,
      label, isActive,
    }, req.ip);

    res.json({
      addon: {
        ...result.rows[0],
        price_inr: result.rows[0].price_paise / 100,
      },
      message: `Addon "${key}" updated.`,
    });
  } catch (err) { next(err); }
};

// ═════════════════════════════════════════════════════════════════
// BASE PRICING MANAGEMENT
// ═════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/base-pricing
 * Returns all base_pricing rows for both plan types.
 */
exports.getBasePricing = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, plan_type, length_months, discount_pct,
              monthly_rate_paise, is_active, updated_at, updated_by
       FROM base_pricing
       ORDER BY plan_type, length_months`
    );
    res.json({
      basePricing: result.rows.map((r) => ({
        ...r,
        monthly_rate_inr:  r.monthly_rate_paise / 100,
        discount_pct:      Number(r.discount_pct),
      })),
    });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/admin/base-pricing/:planType/:lengthMonths
 * Update the monthly rate and/or discount for one base pricing row.
 *
 * Body:
 *   monthlyRatePaise  {number}  — new monthly rate in paise (integer)
 *   monthlyRateInr    {number}  — alternative: in INR (converted to FLOOR paise)
 *   discountPct       {number}  — 0–100, will be stored as-is (admin responsibility)
 *   isActive          {boolean}
 *
 * Important: monthlyRatePaise must already be FLOOR'd by the caller.
 * The DB stores exactly what you send — no server-side floor here, because
 * the admin may want to set a custom rounded value (e.g. ₹450 = 45000 paise).
 */
exports.updateBasePricing = async (req, res, next) => {
  try {
    const { planType, lengthMonths } = req.params;

    const VALID_TYPES   = ['memorial', 'wedding'];
    const VALID_LENGTHS = [1, 3, 6, 12, 24, 36, 60];

    if (!VALID_TYPES.includes(planType))
      return res.status(400).json({ error: `Invalid planType. Allowed: ${VALID_TYPES.join(', ')}.` });

    const lengthNum = parseInt(lengthMonths, 10);
    if (!VALID_LENGTHS.includes(lengthNum))
      return res.status(400).json({ error: `Invalid lengthMonths. Allowed: ${VALID_LENGTHS.join(', ')}.` });

    // Verify row exists
    const existing = await db.query(
      'SELECT id, monthly_rate_paise, discount_pct FROM base_pricing WHERE plan_type = $1 AND length_months = $2',
      [planType, lengthNum]
    );
    if (!existing.rows.length)
      return res.status(404).json({ error: `Base pricing row not found for ${planType} / ${lengthNum} months.` });

    const { monthlyRatePaise, monthlyRateInr, discountPct, isActive } = req.body;

    // ── Resolve monthly rate in paise ─────────────────────────
    let newRatePaise;
    if (monthlyRatePaise !== undefined) {
      newRatePaise = parseInt(monthlyRatePaise, 10);
      if (!Number.isInteger(newRatePaise) || newRatePaise <= 0)
        return res.status(400).json({ error: 'monthlyRatePaise must be a positive integer.' });
    } else if (monthlyRateInr !== undefined) {
      const inr = Number(monthlyRateInr);
      if (!Number.isFinite(inr) || inr <= 0)
        return res.status(400).json({ error: 'monthlyRateInr must be a positive number.' });
      // Floor to avoid fractional paise — Razorpay only accepts integers
      newRatePaise = Math.floor(inr * 100);
    }

    // ── Validate discount ─────────────────────────────────────
    let newDiscountPct;
    if (discountPct !== undefined) {
      newDiscountPct = Number(discountPct);
      if (!Number.isFinite(newDiscountPct) || newDiscountPct < 0 || newDiscountPct > 100)
        return res.status(400).json({ error: 'discountPct must be between 0 and 100.' });
    }

    const setClauses = [];
    const params     = [];
    let   p          = 1;

    if (newRatePaise    !== undefined) { setClauses.push(`monthly_rate_paise = $${p++}`); params.push(newRatePaise); }
    if (newDiscountPct  !== undefined) { setClauses.push(`discount_pct       = $${p++}`); params.push(newDiscountPct); }
    if (isActive        !== undefined) { setClauses.push(`is_active          = $${p++}`); params.push(Boolean(isActive)); }

    if (setClauses.length === 0)
      return res.status(400).json({ error: 'No fields to update.' });

    setClauses.push(`updated_by = $${p++}`); params.push(req.adminId);
    setClauses.push(`updated_at = NOW()`);
    params.push(planType);
    params.push(lengthNum);

    const result = await db.query(
      `UPDATE base_pricing
       SET ${setClauses.join(', ')}
       WHERE plan_type = $${p++} AND length_months = $${p++}
       RETURNING *`,
      params
    );

    logAction(req.adminId, 'update_base_pricing', 'base_pricing',
      `${planType}/${lengthNum}`, {
        oldRatePaise: existing.rows[0].monthly_rate_paise,
        oldDiscount:  Number(existing.rows[0].discount_pct),
        newRatePaise, newDiscountPct, isActive,
      }, req.ip);

    res.json({
      basePricing: {
        ...result.rows[0],
        monthly_rate_inr: result.rows[0].monthly_rate_paise / 100,
        discount_pct:     Number(result.rows[0].discount_pct),
      },
      message: `Base pricing for ${planType} / ${lengthNum} months updated.`,
    });
  } catch (err) { next(err); }
};
