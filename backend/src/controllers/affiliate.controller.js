'use strict';
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../utils/db');
const emailService = require('../services/email.service');
const push    = require('../services/push.service');

// ── HELPERS ──────────────────────────────────────────────────
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const signAffiliateToken = (affiliateId, tokenVersion = 0) =>
  jwt.sign({ affiliateId, tokenVersion },
    // Use a dedicated secret for affiliates so affiliate tokens can't be used as
    // user tokens and vice versa. Falls back to JWT_SECRET if not set.
    process.env.AFFILIATE_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

function generateReferralCode(name) {
  const base    = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6).padEnd(4, 'X');
  const suffix  = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${base}-${suffix}`;
}

// ── AFFILIATE SELF-REGISTRATION (email/password, no Google) ──
// POST /api/affiliates/auth/register
exports.authRegister = async (req, res, next) => {
  try {
    const { name, email, password, phone, businessName, notes } = req.body;

    if (!name?.trim() || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = await db.query('SELECT id FROM affiliates WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length)
      return res.status(409).json({ error: 'An affiliate account with this email already exists.' });

    // Generate unique referral code
    let code = generateReferralCode(name);
    let attempts = 0;
    while (attempts < 10) {
      const taken = await db.query('SELECT id FROM affiliates WHERE referral_code = $1', [code]);
      if (!taken.rows.length) break;
      code = generateReferralCode(name + attempts);
      attempts++;
    }

    const passwordHash   = await bcrypt.hash(password, 12);
    const verifyToken    = crypto.randomBytes(32).toString('hex');
    const verifyExpires  = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO affiliates
         (name, email, password_hash, phone, business_name, notes, referral_code, status,
          email_verify_token, email_verify_expires)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9)
       RETURNING id, name, email, referral_code, status, created_at`,
      [
        name.trim(), email.toLowerCase().trim(), passwordHash,
        phone?.trim() || null, businessName?.trim() || null, notes?.trim() || null,
        code, verifyToken, verifyExpires,
      ]
    );

    const affiliate = result.rows[0];

    // Send verification email — reuse the existing verifyEmail template (best-effort)
    const verifyUrl = `${process.env.APP_URL}/affiliate/verify-email?token=${verifyToken}`;
    emailService.sendVerifyEmail(
      { email: affiliate.email, name: affiliate.name, id: affiliate.id },
      verifyUrl
    ).catch(emailErr => console.error('[AFFILIATE AUTH] Verification email failed:', emailErr.message));

    res.status(201).json({
      message: 'Application submitted! Please check your email to verify your address. We will review and approve within 2-3 business days.',
      affiliate: { id: affiliate.id, name: affiliate.name, email: affiliate.email },
    });

    // Push notification to admin — fire and forget
    push.notify.newAffiliateApplication(affiliate).catch(() => {});
  } catch (err) { next(err); }
};

// ── AFFILIATE EMAIL VERIFICATION ──────────────────────────────
// GET /api/affiliates/auth/verify-email?token=
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });

    const result = await db.query(
      `UPDATE affiliates
       SET is_email_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL
       WHERE email_verify_token = $1 AND email_verify_expires > NOW()
       RETURNING id, name, email, status`,
      [token]
    );

    if (!result.rows.length)
      return res.status(400).json({ error: 'Invalid or expired verification token.' });

    res.json({ message: 'Email verified successfully! Your application is under review.' });
  } catch (err) { next(err); }
};

// ── AFFILIATE SIGN-IN ─────────────────────────────────────────
// POST /api/affiliates/auth/login
exports.authLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const result = await db.query(
      'SELECT id, name, email, password_hash, status, is_email_verified, token_version FROM affiliates WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const affiliate = result.rows[0];

    // Constant-time failure — prevents email enumeration timing attacks
    // The dummy hash MUST be a valid 60-char bcrypt string or bcrypt.compare throws
    const DUMMY_HASH = '$2b$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const hash = affiliate?.password_hash || DUMMY_HASH;
    const match = await bcrypt.compare(password, hash);

    if (!affiliate || !match || !affiliate.password_hash)
      return res.status(401).json({ error: 'Invalid email or password.' });

    if (!affiliate.is_email_verified)
      return res.status(403).json({ error: 'Please verify your email before signing in.' });

    if (affiliate.status === 'rejected')
      return res.status(403).json({ error: 'Your affiliate application was not approved.' });

    if (affiliate.status === 'suspended')
      return res.status(403).json({ error: 'Your affiliate account has been suspended. Please contact support.' });

    await db.query('UPDATE affiliates SET last_login = NOW() WHERE id = $1', [affiliate.id]);

    const token = signAffiliateToken(affiliate.id, affiliate.token_version || 0);

    res.json({
      token,
      affiliate: {
        id:     affiliate.id,
        name:   affiliate.name,
        email:  affiliate.email,
        status: affiliate.status,
      },
    });
  } catch (err) { next(err); }
};

// ── AFFILIATE DASHBOARD — OWN STATS ──────────────────────────
// GET /api/affiliates/me
exports.getMe = async (req, res, next) => {
  try {
    const [aff, commissions, recentReferrals] = await Promise.all([
      db.query(
        `SELECT id, name, email, phone, business_name, referral_code, status,
                commission_rate, total_referrals, total_earnings, total_paid_out,
                bank_details, last_login, created_at
         FROM affiliates WHERE id = $1`,
        [req.affiliateId]
      ),
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
           COUNT(*) FILTER (WHERE status = 'paid')::int    AS paid_count,
           COALESCE(SUM(amount_inr) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
           COALESCE(SUM(amount_inr) FILTER (WHERE status = 'paid'),    0) AS paid_amount
         FROM commissions WHERE affiliate_id = $1`,
        [req.affiliateId]
      ),
      db.query(
        `SELECT u.name, u.email, u.subscription_plan, u.subscription_status, u.created_at,
                c.amount_inr AS commission_earned
         FROM users u
         LEFT JOIN commissions c ON c.user_id = u.id AND c.affiliate_id = $1
         WHERE u.affiliate_id = $1
         ORDER BY u.created_at DESC LIMIT 10`,
        [req.affiliateId]
      ),
    ]);

    if (!aff.rows.length) return res.status(404).json({ error: 'Affiliate not found.' });

    res.json({
      affiliate:       aff.rows[0],
      earnings:        commissions.rows[0],
      recentReferrals: recentReferrals.rows,
    });
  } catch (err) { next(err); }
};

// ── AFFILIATE UPDATE PROFILE (bank details etc.) ──────────────
// PUT /api/affiliates/me
exports.updateMe = async (req, res, next) => {
  try {
    const { phone, businessName, bankDetails } = req.body;

    const result = await db.query(
      `UPDATE affiliates SET
         phone         = COALESCE($1, phone),
         business_name = COALESCE($2, business_name),
         bank_details  = COALESCE($3::jsonb, bank_details),
         updated_at    = NOW()
       WHERE id = $4 RETURNING id, name, email, phone, business_name, bank_details`,
      [
        phone?.trim()       || null,
        businessName?.trim()|| null,
        bankDetails ? JSON.stringify(bankDetails) : null,
        req.affiliateId,
      ]
    );

    res.json({ affiliate: result.rows[0] });
  } catch (err) { next(err); }
};

// ── AFFILIATE COMMISSIONS LIST ────────────────────────────────
// GET /api/affiliates/me/commissions
exports.myCommissions = async (req, res, next) => {
  try {
    const pageNum  = Math.max(1, parseInt(req.query.page)  || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT c.id, c.amount_inr, c.commission_rate, c.status, c.paid_at, c.created_at,
                u.name AS referred_user, u.subscription_plan
         FROM commissions c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.affiliate_id = $1
         ORDER BY c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.affiliateId, limitNum, offset]
      ),
      db.query('SELECT COUNT(*) FROM commissions WHERE affiliate_id = $1', [req.affiliateId]),
    ]);

    res.json({ commissions: rows.rows, total: parseInt(total.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) { next(err); }
};

// ── PUBLIC: VALIDATE REFERRAL CODE ──────────────────────────
// GET /api/affiliates/validate/:code
exports.validateCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const result = await db.query(
      `SELECT id, name, business_name, referral_code
       FROM affiliates WHERE referral_code = $1 AND status = 'active'`,
      [code.toUpperCase()]
    );
    if (!result.rows.length)
      return res.status(404).json({ valid: false, error: 'Invalid or inactive referral code.' });

    res.json({ valid: true, affiliate: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: LIST AFFILIATES ────────────────────────────────────
exports.listAffiliates = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const params = [];
    const conds  = [];

    if (status) { params.push(status); conds.push(`a.status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conds.push(`(a.name ILIKE $${params.length} OR a.email ILIKE $${params.length})`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const countParams = [...params];
    params.push(limit, offset);

    const [rows, total] = await Promise.all([
      db.query(`
        SELECT a.*,
               COUNT(u.id)::int          AS referral_count,
               COALESCE(SUM(c.amount_inr) FILTER (WHERE c.status = 'pending'), 0) AS pending_earnings,
               COALESCE(SUM(c.amount_inr) FILTER (WHERE c.status = 'paid'),    0) AS paid_earnings
        FROM affiliates a
        LEFT JOIN users u ON u.affiliate_id = a.id
        LEFT JOIN commissions c ON c.affiliate_id = a.id
        ${where}
        GROUP BY a.id
        ORDER BY a.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      db.query(`SELECT COUNT(*) FROM affiliates a ${where}`, countParams),
    ]);

    res.json({ affiliates: rows.rows, total: parseInt(total.rows[0].count), page: +page, limit: +limit });
  } catch (err) { next(err); }
};

// ── ADMIN: GET SINGLE AFFILIATE ───────────────────────────────
exports.getAffiliate = async (req, res, next) => {
  try {
    const [aff, users, commissions] = await Promise.all([
      db.query(
        `SELECT id, name, email, phone, business_name, referral_code, status,
                commission_rate, total_referrals, total_earnings, total_paid_out,
                bank_details, notes, last_login, created_at, updated_at
         FROM affiliates WHERE id = $1`,
        [req.params.affiliateId]
      ),
      db.query(
        `SELECT u.id, u.name, u.email, u.subscription_status, u.subscription_plan,
                u.created_at, COALESCE(SUM(t.amount_inr), 0) AS total_paid
         FROM users u
         LEFT JOIN transactions t ON t.user_id = u.id AND t.status IN ('captured','paid')
         WHERE u.affiliate_id = $1
         GROUP BY u.id ORDER BY u.created_at DESC`,
        [req.params.affiliateId]
      ),
      db.query(
        `SELECT c.*, u.name AS user_name, u.email AS user_email
         FROM commissions c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.affiliate_id = $1
         ORDER BY c.created_at DESC LIMIT 50`,
        [req.params.affiliateId]
      ),
    ]);

    if (!aff.rows.length) return res.status(404).json({ error: 'Affiliate not found.' });
    res.json({ affiliate: aff.rows[0], users: users.rows, commissions: commissions.rows });
  } catch (err) { next(err); }
};

// ── ADMIN: UPDATE AFFILIATE ───────────────────────────────────
exports.updateAffiliate = async (req, res, next) => {
  try {
    const { status, commissionRate, notes, bankDetails } = req.body;

    const result = await db.query(
      `UPDATE affiliates SET
         status          = COALESCE($1, status),
         commission_rate = COALESCE($2, commission_rate),
         notes           = COALESCE($3, notes),
         bank_details    = COALESCE($4::jsonb, bank_details),
         updated_at      = NOW()
       WHERE id = $5 RETURNING *`,
      [status, commissionRate ?? null, notes ?? null,
       bankDetails ? JSON.stringify(bankDetails) : null,
       req.params.affiliateId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Affiliate not found.' });
    res.json({ affiliate: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: MARK COMMISSIONS AS PAID ──────────────────────────
exports.markCommissionsPaid = async (req, res, next) => {
  try {
    const { commissionIds, paymentRef } = req.body;
    if (!Array.isArray(commissionIds) || !commissionIds.length)
      return res.status(400).json({ error: 'commissionIds array is required.' });

    const result = await db.query(
      `UPDATE commissions SET status = 'paid', paid_at = NOW(), payment_ref = $1
       WHERE id = ANY($2::uuid[]) AND affiliate_id = $3
       RETURNING id, amount_inr`,
      [paymentRef || null, commissionIds, req.params.affiliateId]
    );

    // Update affiliate totals
    const totalPaid = result.rows.reduce((s, r) => s + parseFloat(r.amount_inr), 0);
    await db.query(
      'UPDATE affiliates SET total_paid_out = total_paid_out + $1, updated_at = NOW() WHERE id = $2',
      [totalPaid, req.params.affiliateId]
    );

    res.json({ message: `${result.rows.length} commission(s) marked as paid.`, totalPaid });
  } catch (err) { next(err); }
};

// ── INTERNAL: RECORD COMMISSION ON PAYMENT ───────────────────
// Called from payment.controller.js after successful payment
async function recordCommission({ userId, transactionId, amountInr }) {
  try {
    const userRes = await db.query(
      'SELECT affiliate_id FROM users WHERE id = $1', [userId]
    );
    const affiliateId = userRes.rows[0]?.affiliate_id;
    if (!affiliateId) return; // no referral

    const affRes = await db.query(
      'SELECT id, commission_rate, status FROM affiliates WHERE id = $1', [affiliateId]
    );
    const affiliate = affRes.rows[0];
    if (!affiliate || affiliate.status !== 'active') return;

    const commissionAmt = ((parseFloat(amountInr) * affiliate.commission_rate) / 100).toFixed(2);

    // Count BEFORE insert to correctly detect first referral
    const existingCommissions = await db.query(
      'SELECT COUNT(*) FROM commissions WHERE affiliate_id = $1 AND user_id = $2',
      [affiliateId, userId]
    );
    const isFirstReferral = parseInt(existingCommissions.rows[0].count) === 0;

    await db.query(
      `INSERT INTO commissions
         (affiliate_id, user_id, transaction_id, subscription_amount, commission_rate, amount_inr)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [affiliateId, userId, transactionId, amountInr, affiliate.commission_rate, commissionAmt]
    );

    await db.query(
      `UPDATE affiliates SET
         total_referrals = total_referrals + $1,
         total_earnings  = total_earnings + $2,
         updated_at      = NOW()
       WHERE id = $3`,
      [isFirstReferral ? 1 : 0, commissionAmt, affiliateId]
    );

    console.log(`[AFFILIATE] Commission ₹${commissionAmt} recorded for affiliate ${affiliateId}`);
  } catch (err) {
    console.error('[AFFILIATE] Commission recording failed:', err.message);
    // Never block payment flow
  }
}

// recordCommission is defined as a plain function (not exports.X) so export it here
exports.recordCommission = recordCommission;

// Re-export all for convenience (exports.X already set above for route handlers)
module.exports = exports;

// ── AFFILIATE FORGOT PASSWORD ─────────────────────────────────
// POST /api/affiliates/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const GENERIC = 'If an affiliate account exists with that email, a reset link has been sent.';
    if (!email || !isValidEmail(email)) return res.json({ message: GENERIC });

    const result = await db.query(
      'SELECT id, name, email FROM affiliates WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const affiliate = result.rows[0];
    if (!affiliate) return res.json({ message: GENERIC });

    const resetToken   = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'UPDATE affiliates SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, affiliate.id]
    );

    const resetUrl = `${process.env.APP_URL}/affiliate/reset-password?token=${resetToken}`;
    emailService.sendPasswordReset(
      { email: affiliate.email, name: affiliate.name, id: affiliate.id },
      resetUrl
    ).catch(err => console.error('[AFFILIATE FORGOT] Email failed:', err.message));

    res.json({ message: GENERIC });
  } catch (err) { next(err); }
};

// ── AFFILIATE RESET PASSWORD ──────────────────────────────────
// POST /api/affiliates/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: 'Token and new password are required.' });
    if (!/^[a-f0-9]{64}$/.test(token))
      return res.status(400).json({ error: 'Invalid reset token.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const result = await db.query(
      'SELECT id FROM affiliates WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    if (!result.rows.length)
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      `UPDATE affiliates SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL,
         token_version = COALESCE(token_version, 0) + 1
       WHERE id = $2`,
      [passwordHash, result.rows[0].id]
    );

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) { next(err); }
};

// ── ADMIN: DELETE AFFILIATE ───────────────────────────────────
exports.deleteAffiliate = async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM affiliates WHERE id = $1 RETURNING id, name, email',
      [req.params.affiliateId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Affiliate not found.' });

    // Unlink any users who were referred by this affiliate (set to null, don't delete users)
    await db.query(
      'UPDATE users SET affiliate_id = NULL WHERE affiliate_id = $1',
      [req.params.affiliateId]
    );

    res.json({ message: `Affiliate ${result.rows[0].name} deleted.` });
  } catch (err) { next(err); }
};

// ── AFFILIATE RESEND VERIFICATION EMAIL ──────────────────────
// POST /api/affiliates/auth/resend-verification
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const GENERIC = 'If an unverified account exists with that email, a new verification link has been sent.';
    if (!email || !isValidEmail(email)) return res.json({ message: GENERIC });

    const result = await db.query(
      'SELECT id, name, email, is_email_verified FROM affiliates WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const affiliate = result.rows[0];

    // Don't reveal whether email exists or is already verified
    if (!affiliate || affiliate.is_email_verified) return res.json({ message: GENERIC });

    const verifyToken   = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.query(
      'UPDATE affiliates SET email_verify_token = $1, email_verify_expires = $2 WHERE id = $3',
      [verifyToken, verifyExpires, affiliate.id]
    );

    const verifyUrl = `${process.env.APP_URL}/affiliate/verify-email?token=${verifyToken}`;
    emailService.sendVerifyEmail(
      { email: affiliate.email, name: affiliate.name, id: affiliate.id },
      verifyUrl
    ).catch(err => console.error('[AFFILIATE RESEND] Email failed:', err.message));

    res.json({ message: GENERIC });
  } catch (err) { next(err); }
};

// ── ADMIN: MANUALLY VERIFY AFFILIATE EMAIL ────────────────────
// POST /api/admin/affiliates/:affiliateId/verify
exports.adminVerifyAffiliate = async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE affiliates
       SET is_email_verified = TRUE, email_verify_token = NULL, email_verify_expires = NULL
       WHERE id = $1 RETURNING id, name, email, status`,
      [req.params.affiliateId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Affiliate not found.' });
    res.json({ message: `Email verified for ${result.rows[0].name}.`, affiliate: result.rows[0] });
  } catch (err) { next(err); }
};

// ── USER: GET OWN AFFILIATE DATA (via subscriber auth) ───────
// Called by the AffiliatePage inside the subscriber dashboard.
// Looks up affiliate record by matching the subscriber's email.
exports.getUserAffiliateData = async (req, res, next) => {
  try {
    // Get subscriber email
    const userRes = await db.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found.' });

    const email = userRes.rows[0].email;

    // Find affiliate with same email
    const affRes = await db.query(
      `SELECT id, name, email, referral_code, status, commission_rate,
              total_referrals, total_earnings, total_paid_out
       FROM affiliates WHERE email = $1`,
      [email]
    );

    if (!affRes.rows.length) {
      // Also check by affiliate_id on users table
      const linkRes = await db.query(
        `SELECT a.id, a.name, a.email, a.referral_code, a.status, a.commission_rate,
                a.total_referrals, a.total_earnings, a.total_paid_out
         FROM affiliates a
         JOIN users u ON u.affiliate_id = a.id
         WHERE a.id = (SELECT affiliate_id FROM users WHERE id = $1)`,
        [req.userId]
      );
      if (!linkRes.rows.length) return res.status(404).json({ error: 'No affiliate account found.' });
      affRes.rows.push(linkRes.rows[0]);
    }

    const affiliate = affRes.rows[0];

    // Get commission summary
    const earnings = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending_count,
         COUNT(*) FILTER (WHERE status = 'paid')::int     AS paid_count,
         COALESCE(SUM(amount_inr) FILTER (WHERE status = 'pending'), 0) AS pending_amount,
         COALESCE(SUM(amount_inr) FILTER (WHERE status = 'paid'),    0) AS paid_amount
       FROM commissions WHERE affiliate_id = $1`,
      [affiliate.id]
    );

    // Recent referrals
    const referrals = await db.query(
      `SELECT u.name, u.email, u.subscription_plan, u.subscription_status, u.created_at,
              c.amount_inr AS commission_earned
       FROM users u
       LEFT JOIN commissions c ON c.user_id = u.id AND c.affiliate_id = $1
       WHERE u.affiliate_id = $1
       ORDER BY u.created_at DESC LIMIT 20`,
      [affiliate.id]
    );

    res.json({
      affiliate,
      earnings:        earnings.rows[0],
      recentReferrals: referrals.rows,
    });
  } catch (err) { next(err); }
};
