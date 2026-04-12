const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../utils/db');
const emailService = require('../services/email.service');
const r2Service = require('../services/r2.service');
const { OAuth2Client } = require('google-auth-library');
const { sanitizePlainText } = require('../utils/content-sanitizer');
const { getPlanContextForType } = require('../utils/plan-access');

// Load push service gracefully (may fail if Firebase not configured)
let push = null;
try { push = require('../services/push.service'); } catch (e) { console.warn('[AUTH] Push service not loaded:', e.message); }

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ── HELPERS ───────────────────────────────────────────────────
const signToken = (userId, tokenVersion = 0, jti = crypto.randomBytes(8).toString('hex')) =>
  jwt.sign({ userId, tokenVersion, jti }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const generateToken = () => crypto.randomBytes(32).toString('hex');

// Simple email format check — no external dep needed
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Input length guards
const MAX_NAME     = 100;
const MAX_EMAIL    = 254;  // RFC 5321
const MAX_BIO      = 20000;

const normalizeReferralCode = (code) => String(code || '').trim().toUpperCase();

async function resolveAffiliateId(referralCode) {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) return null;

  const result = await db.query(
    `SELECT id FROM affiliates
     WHERE referral_code = $1 AND status = 'active'`,
    [normalized]
  );

  if (!result.rows.length) {
    const err = new Error('Invalid or inactive referral code.');
    err.status = 400;
    throw err;
  }

  return result.rows[0].id;
}

// ── REGISTER ─────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, plan, referralCode } = req.body;
    const normalizedReferral = normalizeReferralCode(referralCode);

    if (!name?.trim() || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (name.trim().length > MAX_NAME)
      return res.status(400).json({ error: `Name must be ${MAX_NAME} characters or less.` });
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (email.length > MAX_EMAIL)
      return res.status(400).json({ error: 'Email address is too long.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (password.length > 128)
      return res.status(400).json({ error: 'Password must be 128 characters or less.' });

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash  = await bcrypt.hash(password, 12);
    const verifyToken   = generateToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
    const affiliateId   = await resolveAffiliateId(normalizedReferral);

    const result = await db.query(
      `INSERT INTO users
         (name, email, password_hash, email_verify_token, email_verify_expires, subscription_plan, affiliate_id, referral_code_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, email`,
      [name.trim(), email.toLowerCase().trim(), passwordHash,
       verifyToken, verifyExpires, plan || 'monthly', affiliateId, normalizedReferral || null]
    );

    const user      = result.rows[0];
    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${verifyToken}`;

    emailService.sendWelcome(user).catch(err => console.error('[WELCOME EMAIL]', err.message));
    emailService.sendVerifyEmail(user, verifyUrl).catch(err => console.error('[VERIFY EMAIL]', err.message));

    // Push notification to admin — fire and forget
    if (push?.notify) push.notify.newUser(user).catch(() => {});

    const token = signToken(user.id, 0); // token_version defaults to 0 for new users
    res.status(201).json({
      message: 'Account created. Please check your email to verify your address.',
      token,
      user: { id: user.id, name: user.name, email: user.email, isEmailVerified: false },
    });
  } catch (err) { next(err); }
};

// ── LOGIN ─────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const result = await db.query(
      `SELECT id, name, email, password_hash, is_email_verified,
              subscription_status, subscription_plan, is_active, token_version
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    // If user exists but has no password (Google-only account), tell them clearly
    if (user && !user.password_hash)
      return res.status(400).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' });

    // Constant-time compare regardless of whether user exists
    const hash = user?.password_hash || '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
    const match = await bcrypt.compare(password, hash);

    if (!user || !match)
      return res.status(401).json({ error: 'Incorrect email or password.' });

    // FIX: Check account is not suspended
    if (user.is_active === false)
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });

    const token = signToken(user.id, user.token_version || 0);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.is_email_verified,
        subscriptionStatus: user.subscription_status,
        subscriptionPlan:   user.subscription_plan,
      },
    });
  } catch (err) { next(err); }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────
exports.verifyEmail = async (req, res, next) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });
    // Sanity check — tokens are 64-char hex
    if (!/^[a-f0-9]{64}$/.test(token))
      return res.status(400).json({ error: 'Invalid verification token format.' });

    const result = await db.query(
      `SELECT id, name, email, email_verify_expires FROM users
       WHERE email_verify_token = $1 AND is_email_verified = FALSE`,
      [token]
    );
    const user = result.rows[0];

    if (!user)
      return res.status(400).json({ error: 'Invalid or already used verification link.' });
    if (new Date() > new Date(user.email_verify_expires))
      return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });

    await db.query(
      `UPDATE users
       SET is_email_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    res.json({ message: 'Email verified successfully. Welcome to Hriatrengna!' });
  } catch (err) { next(err); }
};

// ── RESEND VERIFICATION ───────────────────────────────────────
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Always return same message to prevent email enumeration
    const GENERIC = 'If your email is registered and unverified, a new link has been sent.';

    const result = await db.query(
      'SELECT id, name, email, is_email_verified FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    if (!user || user.is_email_verified) return res.json({ message: GENERIC });

    const verifyToken   = generateToken();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      'UPDATE users SET email_verify_token = $1, email_verify_expires = $2 WHERE id = $3',
      [verifyToken, verifyExpires, user.id]
    );

    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${verifyToken}`;
    await emailService.sendVerifyEmail(user, verifyUrl);

    res.json({ message: GENERIC });
  } catch (err) { next(err); }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const GENERIC = 'If an account exists with that email, a reset link has been sent.';

    if (!isValidEmail(email)) return res.json({ message: GENERIC }); // don't reveal validation

    const result = await db.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];

    if (!user) return res.json({ message: GENERIC });

    const resetToken   = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, user.id]
    );

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    try {
      await emailService.sendPasswordReset(user, resetUrl);
    } catch (emailErr) {
      console.error('[FORGOT PASSWORD] Email send failed:', emailErr.message);
      // Still return success to prevent email enumeration, but log it
    }

    res.json({ message: GENERIC });
  } catch (err) { next(err); }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────
// POST /api/auth/refresh
// Accepts a Bearer token that is still valid OR expired within the last 7 days
// (clockTolerance grace). Returns a fresh 7-day token without requiring the
// user to re-enter their password. Validates token_version so that sessions
// invalidated by password-reset/change are still rejected.
exports.refreshToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token required.' });

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      // Allow tokens expired within the last 7 days so a user who hasn't
      // opened the app in a while can still refresh silently.
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true,
      });
    } catch {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Enforce the 7-day grace window manually
    const now       = Math.floor(Date.now() / 1000);
    const GRACE_SEC = 7 * 24 * 60 * 60; // 7 days
    if (decoded.exp && now - decoded.exp > GRACE_SEC)
      return res.status(401).json({ error: 'Token too old to refresh. Please sign in again.' });

    const result = await db.query(
      'SELECT id, is_active, token_version FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = result.rows[0];
    if (!user)
      return res.status(401).json({ error: 'User no longer exists.' });
    if (user.is_active === false)
      return res.status(403).json({ error: 'Account suspended.' });

    const tokenVersion = decoded.tokenVersion || 0;
    if (user.token_version > tokenVersion)
      return res.status(401).json({ error: 'Session invalidated. Please sign in again.' });

    const newToken = signToken(user.id, user.token_version || 0);
    res.json({ token: newToken });
  } catch (err) { next(err); }
};

// ── RESET PASSWORD ────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password)
      return res.status(400).json({ error: 'Token and new password are required.' });
    if (!/^[a-f0-9]{64}$/.test(token))
      return res.status(400).json({ error: 'Invalid reset token format.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (password.length > 128)
      return res.status(400).json({ error: 'Password must be 128 characters or less.' });

    const result = await db.query(
      `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    const user = result.rows[0];

    if (!user)
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const passwordHash = await bcrypt.hash(password, 12);

    // Invalidate the reset token AND bump a token_version to invalidate active JWTs
    await db.query(
      `UPDATE users
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL,
           token_version = COALESCE(token_version, 0) + 1
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) { next(err); }
};

// ── GET CURRENT USER ──────────────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const [userRes, memorialContext, weddingContext] = await Promise.all([
      db.query(
        `SELECT id, name, email, phone, is_email_verified, subscription_status,
                subscription_plan, current_period_end, album_quota, created_at,
                cancel_at_period_end, grace_period_until, lifetime_expires_at,
                memorial_plan, wedding_plan, is_demo, demo_expires_at
         FROM users WHERE id = $1`,
        [req.userId]
      ),
      getPlanContextForType(req.userId, 'memorial'),
      getPlanContextForType(req.userId, 'wedding'),
    ]);

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const memorialSub = memorialContext.planSlug
      ? {
          ...(memorialContext.subscription || {}),
          plan_type: 'memorial',
          plan_slug: memorialContext.planSlug,
          album_quota: memorialContext.albumQuota,
          subscription_count: memorialContext.subscription?.subscription_count || 1,
        }
      : null;
    const weddingSub  = weddingContext.planSlug
      ? {
          ...(weddingContext.subscription || {}),
          plan_type: 'wedding',
          plan_slug: weddingContext.planSlug,
          album_quota: weddingContext.albumQuota,
          subscription_count: weddingContext.subscription?.subscription_count || 1,
        }
      : null;

    res.json({
      user: {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        phone:              user.phone,
        isEmailVerified:    user.is_email_verified,
        subscriptionStatus: user.subscription_status,
        subscriptionPlan:   user.subscription_plan,
        memorialPlan:       memorialContext.planSlug || user.memorial_plan,
        weddingPlan:        weddingContext.planSlug || user.wedding_plan,
        currentPeriodEnd:   user.current_period_end,
        cancelAtPeriodEnd:  user.cancel_at_period_end,
        gracePeriodUntil:   user.grace_period_until,
        lifetimeExpiresAt:  user.lifetime_expires_at,
        albumQuota:         user.album_quota || 1,
        createdAt:          user.created_at,
        isDemo:             user.is_demo || false,
        demoExpiresAt:      user.demo_expires_at || null,
        // Dual subscription flags — KEY for canMakeWedding / canMakeMemorial
        hasMemorial:        !!memorialSub,
        hasWedding:         !!weddingSub,
        memorialSub:        memorialSub || null,
        weddingSub:         weddingSub  || null,
      },
    });
  } catch (err) { next(err); }
};

// ── CHANGE PASSWORD ───────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new password are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    if (newPassword.length > 128)
      return res.status(400).json({ error: 'New password must be 128 characters or less.' });
    if (currentPassword === newPassword)
      return res.status(400).json({ error: 'New password must be different from your current password.' });

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1', [req.userId]
    );
    const user = result.rows[0];

    // Google-only users have no password_hash — they must set a password first
    if (!user.password_hash)
      return res.status(400).json({ error: 'Your account uses Google Sign-In and has no password. Please use "Forgot password" to set one.' });

    if (!(await bcrypt.compare(currentPassword, user.password_hash)))
      return res.status(401).json({ error: 'Current password is incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Bump token_version to invalidate other active sessions
    await db.query(
      `UPDATE users
       SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1
       WHERE id = $2`,
      [passwordHash, req.userId]
    );

    res.json({ message: 'Password changed successfully.' });
  } catch (err) { next(err); }
};

// ── UPDATE PROFILE ─────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, partner1Name, partner2Name, weddingDate, venue, biography, profilePhoto, coverPhoto, weddingSlug } = req.body;
    const sanitizedName = name !== undefined ? sanitizePlainText(name) : undefined;
    const sanitizedPhone = phone !== undefined ? sanitizePlainText(phone) : undefined;
    const sanitizedPartner1 = partner1Name !== undefined ? sanitizePlainText(partner1Name) : undefined;
    const sanitizedPartner2 = partner2Name !== undefined ? sanitizePlainText(partner2Name) : undefined;
    const sanitizedVenue = venue !== undefined ? sanitizePlainText(venue) : undefined;
    const sanitizedBiography = biography !== undefined ? sanitizePlainText(biography) : undefined;
    const sanitizedWeddingSlug = weddingSlug !== undefined ? sanitizePlainText(weddingSlug).toLowerCase() : undefined;
    const MAX_NAME = 100, MAX_BIO = 2000, MAX_VENUE = 200, MAX_SLUG = 50;
    if (sanitizedPartner1 && sanitizedPartner1.length > MAX_NAME) return res.status(400).json({ error: `Partner 1 name must be ${MAX_NAME} characters or less.` });
    if (sanitizedPartner2 && sanitizedPartner2.length > MAX_NAME) return res.status(400).json({ error: `Partner 2 name must be ${MAX_NAME} characters or less.` });
    if (sanitizedVenue && sanitizedVenue.length > MAX_VENUE) return res.status(400).json({ error: `Venue must be ${MAX_VENUE} characters or less.` });
    if (sanitizedBiography && sanitizedBiography.length > MAX_BIO) return res.status(400).json({ error: `Biography must be ${MAX_BIO} characters or less.` });
    if (sanitizedWeddingSlug && sanitizedWeddingSlug.length > MAX_SLUG) return res.status(400).json({ error: `URL slug must be ${MAX_SLUG} characters or less.` });
    if (sanitizedWeddingSlug && !/^[a-z0-9-]+$/.test(sanitizedWeddingSlug)) return res.status(400).json({ error: 'URL slug can only contain lowercase letters, numbers, and hyphens.' });

    const fields = [
      { col: 'name',         val: sanitizedName || undefined },
      { col: 'phone',        val: sanitizedPhone || undefined },
      { col: 'partner1_name', val: sanitizedPartner1 || undefined },
      { col: 'partner2_name', val: sanitizedPartner2 || undefined },
      { col: 'wedding_date', val: weddingDate },
      { col: 'venue_name', val: sanitizedVenue || undefined },
      { col: 'biography', val: sanitizedBiography || undefined },
      { col: 'profile_photo', val: profilePhoto },
      { col: 'cover_photo', val: coverPhoto },
      { col: 'wedding_slug', val: sanitizedWeddingSlug || undefined },
    ];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (f.val !== undefined && f.val !== '') {
        updates.push(`${f.col} = $${updates.length + 1}`);
        values.push(f.val);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    values.push(req.userId);
    const paramIndex = updates.length + 1;
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, phone, partner1_name, partner2_name, wedding_date, venue_name, biography, profile_photo, cover_photo, wedding_slug`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
};

// ── UPLOAD PROFILE PHOTO ─────────────────────────────────────────
exports.uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete the old profile photo from R2 before uploading the new one
    const oldRow = await db.query('SELECT profile_photo FROM users WHERE id = $1', [req.userId]);
    const oldUrl = oldRow.rows[0]?.profile_photo;
    if (oldUrl) {
      const r2Base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      const oldKey = oldUrl.startsWith(r2Base + '/') ? oldUrl.slice(r2Base.length + 1) : null;
      if (oldKey) r2Service.deleteFile(oldKey).catch(() => {});
    }

    const result = await r2Service.uploadFile({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      albumId: `user-${req.userId}`,
      type: 'photo',
    });

    await db.query(
      'UPDATE users SET profile_photo = $1 WHERE id = $2',
      [result.url, req.userId]
    );

    res.json({ url: result.url });
  } catch (err) { next(err); }
};

// ── UPLOAD COVER PHOTO ───────────────────────────────────────────
exports.uploadCoverPhoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete the old cover photo from R2 before uploading the new one
    const oldRow = await db.query('SELECT cover_photo FROM users WHERE id = $1', [req.userId]);
    const oldUrl = oldRow.rows[0]?.cover_photo;
    if (oldUrl) {
      const r2Base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      const oldKey = oldUrl.startsWith(r2Base + '/') ? oldUrl.slice(r2Base.length + 1) : null;
      if (oldKey) r2Service.deleteFile(oldKey).catch(() => {});
    }

    const result = await r2Service.uploadFile({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      albumId: `user-${req.userId}`,
      type: 'photo',
    });

    await db.query(
      'UPDATE users SET cover_photo = $1 WHERE id = $2',
      [result.url, req.userId]
    );

    res.json({ url: result.url });
  } catch (err) { next(err); }
};

// ── GOOGLE OAuth ─────────────────────────────────────────────────
exports.googleAuth = async (req, res, next) => {
  try {
    const { code, referralCode } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code is required.' });
    const normalizedReferral = normalizeReferralCode(referralCode);
    const affiliateId = await resolveAffiliateId(normalizedReferral);

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
    const redirectUri = `${frontendUrl}/google-callback`;

    // CRITICAL: redirect_uri passed to getToken() MUST exactly match what was
    // passed to generateAuthUrl(). We pass it explicitly rather than relying on
    // the OAuth2Client constructor value to avoid any env/runtime mismatch.
    const { tokens } = await googleClient.getToken({ code, redirect_uri: redirectUri });
    
    // Get user info from Google
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists by google_id or email
    let user = null;
    let isNewUser = false;

    const existingByGoogle = await db.query(
      'SELECT id, name, email, is_email_verified, subscription_status, subscription_plan, is_active, token_version, affiliate_id FROM users WHERE google_id = $1',
      [googleId]
    );

    if (existingByGoogle.rows.length) {
      user = existingByGoogle.rows[0];
      if (!user.affiliate_id && affiliateId) {
        await db.query(
          'UPDATE users SET affiliate_id = $1, referral_code_used = COALESCE(referral_code_used, $2) WHERE id = $3',
          [affiliateId, normalizedReferral || null, user.id]
        );
        user.affiliate_id = affiliateId;
      }
    } else {
      // Check if email exists with regular account
      const existingByEmail = await db.query(
        'SELECT id, name, email, is_email_verified, subscription_status, subscription_plan, is_active, token_version, google_id, affiliate_id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingByEmail.rows.length) {
        // Link Google account to existing user
        user = existingByEmail.rows[0];
        if (!user.google_id || (!user.affiliate_id && affiliateId)) {
          await db.query(
            `UPDATE users SET
               google_id = COALESCE(google_id, $1),
               affiliate_id = COALESCE(affiliate_id, $2),
               referral_code_used = COALESCE(referral_code_used, $3)
             WHERE id = $4`,
            [googleId, affiliateId, normalizedReferral || null, user.id]
          );
          user.google_id = user.google_id || googleId;
          user.affiliate_id = user.affiliate_id || affiliateId;
        }
      } else {
        // Create new user
        isNewUser = true;
        const defaultPlan = 'monthly';
        const result = await db.query(
          `INSERT INTO users (name, email, google_id, password_hash, is_email_verified, subscription_plan, affiliate_id, referral_code_used)
           VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)
           RETURNING id, name, email, is_email_verified, subscription_status, subscription_plan, is_active, token_version, affiliate_id`,
          [name, email.toLowerCase(), googleId, true, defaultPlan, affiliateId, normalizedReferral || null]
        );
        user = result.rows[0];
        
        // Send welcome email
        emailService.sendWelcome(user).catch(err => console.error('[WELCOME EMAIL]', err.message));
      }
    }

    // Check if account is suspended
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
    }

    const token = signToken(user.id, user.token_version || 0);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.is_email_verified,
        subscriptionStatus: user.subscription_status,
        subscriptionPlan: user.subscription_plan,
      },
      isNewUser,
    });
  } catch (err) {
    // Log the full error for better debugging
    console.error('[GOOGLE AUTH] Error exchanging code:', err);
    // The library often includes a detailed response from Google
    if (err.response?.data) {
      console.error('[GOOGLE AUTH] Google API Response:', err.response.data);
    }
    next(err);
  }
};

// ── GOOGLE AUTH URL ─────────────────────────────────────────────
exports.googleAuthUrl = async (req, res, next) => {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;
    const redirectUri = `${frontendUrl}/google-callback`;
    
    console.log('[GOOGLE AUTH] Generating auth URL with redirect_uri:', redirectUri);
    
    const authUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      redirect_uri: redirectUri,
    });

    res.json({ url: authUrl });
  } catch (err) {
    next(err);
  }
};

// ── REGISTER DEMO ACCOUNT ─────────────────────────────────────
// Creates a throwaway account with active status, 24h expiry.
// No email required — uses a random disposable address.
// Quota: 10 photos per type (memorial + wedding).
exports.registerDemo = async (req, res, next) => {
  try {
    // Check demo is enabled in app settings
    const setting = await db.query(
      "SELECT value FROM app_settings WHERE key = 'demo_enabled'", []
    );
    if (setting.rows[0]?.value === 'false') {
      return res.status(403).json({ error: 'Demo accounts are currently disabled.' });
    }

    const { type = 'memorial' } = req.body; // 'memorial' | 'wedding'
    const now     = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

    // Random demo identity
    const rand        = Math.random().toString(36).substring(2, 8).toUpperCase();
    const demoName    = `Demo User ${rand}`;
    const demoEmail   = `demo-${rand.toLowerCase()}@trial.hriatrengna.in`;
    const demoPass    = await require('bcryptjs').hash(rand, 10);

    // Get demo photo limit from settings
    const limitRes = await db.query(
      "SELECT value FROM app_settings WHERE key = 'demo_max_photos'", []
    );
    const maxPhotos = parseInt(limitRes.rows[0]?.value) || 10;

    const result = await db.query(
      `INSERT INTO users
         (name, email, password_hash, is_email_verified, subscription_status,
          subscription_plan, album_quota, is_demo, demo_expires_at)
       VALUES ($1,$2,$3,TRUE,'active',$4,1,TRUE,$5)
       RETURNING id, name, email, subscription_status, subscription_plan,
                 album_quota, is_demo, demo_expires_at`,
      [demoName, demoEmail, demoPass,
       type === 'wedding' ? 'wedding-basic' : 'memorial-basic',
       expires]
    );

    const user  = result.rows[0];
    const token = require('jsonwebtoken').sign(
      { userId: user.id, isDemo: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[AUTH] Demo account created: ${demoEmail} expires ${expires.toISOString()}`);

    res.json({
      token,
      user: {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        subscriptionStatus: 'active',
        subscriptionPlan:   user.subscription_plan,
        albumQuota:         1,
        isDemo:             true,
        demoExpiresAt:      expires.toISOString(),
        maxPhotos,
      },
    });
  } catch (err) { next(err); }
};
