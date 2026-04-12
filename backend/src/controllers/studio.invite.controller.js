'use strict';
/**
 * studio.invite.controller.js
 *
 * Proper invite flow with email tokens.
 * Members do NOT need an existing account — they register via invite link.
 *
 * Routes:
 *   POST   /api/studio/invites            — owner sends invite email
 *   GET    /api/studio/invites            — list pending invites
 *   DELETE /api/studio/invites/:id        — revoke invite
 *   GET    /api/public/studio-invite/:token — validate invite token (public)
 *   POST   /api/public/studio-invite/:token — accept invite (public, creates account if needed)
 */

const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../utils/db');
const emailService = require('../services/email.service');
const {
  getStudioEntitlement,
  logStudioAudit,
} = require('../utils/studio-entitlement');

const APP_URL = process.env.APP_URL || 'https://hriatrengna.in';
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const genToken = () => crypto.randomBytes(32).toString('hex');

// ── POST /api/studio/invites ──────────────────────────────────
exports.sendInvite = async (req, res, next) => {
  try {
    if (req.studioRole !== 'owner')
      return res.status(403).json({ error: 'Only the studio owner can invite members.' });

    const { email, role = 'photographer' } = req.body;
    if (!email || !isEmail(email))
      return res.status(400).json({ error: 'Valid email address required.' });
    if (!['photographer', 'viewer'].includes(role))
      return res.status(400).json({ error: 'Role must be photographer or viewer.' });

    // Check entitlement for seat quota
    const entitlement = await getStudioEntitlement(req.studioId);
    if (!entitlement.hasActiveSub)
      return res.status(403).json({
        error: 'Active studio subscription required to invite members.',
        code:  'STUDIO_NO_SUBSCRIPTION',
      });

    const seatRes = await db.query(
      'SELECT COUNT(*)::int AS used FROM studio_members WHERE studio_id = $1',
      [req.studioId]
    );
    if (seatRes.rows[0].used >= entitlement.seatQuota)
      return res.status(403).json({
        error: `Seat limit reached (${entitlement.seatQuota} for your plan). Upgrade to add more members.`,
        code:  'SEAT_LIMIT_REACHED',
      });

    // Check for existing membership
    const memberCheck = await db.query(
      `SELECT sm.id FROM studio_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.studio_id = $1 AND u.email = $2`,
      [req.studioId, email.toLowerCase().trim()]
    );
    if (memberCheck.rows.length)
      return res.status(409).json({ error: 'This person is already a member of your studio.' });

    const token     = genToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert invite (revoke old one for same email if exists)
    await db.query(
      `INSERT INTO studio_invites (studio_id, email, role, token, invited_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (studio_id, email) DO UPDATE SET
         role       = EXCLUDED.role,
         token      = EXCLUDED.token,
         invited_by = EXCLUDED.invited_by,
         expires_at = EXCLUDED.expires_at,
         accepted_at = NULL`,
      [req.studioId, email.toLowerCase().trim(), role, token, req.userId, expiresAt]
    );

    const inviteUrl = `${APP_URL}/studio/join/${token}`;

    // Send invite email (graceful fail — don't block if email service is down)
    try {
      await emailService.sendStudioInvite?.({
        toEmail:    email,
        studioName: req.studio.name,
        role,
        inviteUrl,
        expiresAt,
      });
    } catch (emailErr) {
      console.warn('[STUDIO_INVITE] Email failed:', emailErr.message);
    }

    await logStudioAudit(req.studioId, req.userId, 'member_invited',
      'invite', email, { role, inviteUrl }, req.ip);

    res.status(201).json({
      message:   `Invite sent to ${email}.`,
      inviteUrl, // also return so owner can share manually
      expiresAt,
    });
  } catch (err) { next(err); }
};

// ── GET /api/studio/invites ───────────────────────────────────
exports.listInvites = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, role, token, accepted_at, expires_at, created_at,
              (accepted_at IS NULL AND expires_at > NOW()) AS is_pending
       FROM studio_invites WHERE studio_id = $1
       ORDER BY created_at DESC`,
      [req.studioId]
    );
    res.json({
      invites: result.rows.map((invite) => ({
        ...invite,
        inviteUrl: `${APP_URL}/studio/join/${invite.token}`,
      })),
    });
  } catch (err) { next(err); }
};

// ── DELETE /api/studio/invites/:id ───────────────────────────
exports.revokeInvite = async (req, res, next) => {
  try {
    if (req.studioRole !== 'owner')
      return res.status(403).json({ error: 'Only the studio owner can revoke invites.' });

    await db.query(
      'DELETE FROM studio_invites WHERE id = $1 AND studio_id = $2',
      [req.params.id, req.studioId]
    );
    res.json({ message: 'Invite revoked.' });
  } catch (err) { next(err); }
};

// ── GET /api/public/studio-invite/:token (public) ────────────
exports.checkInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await db.query(
      `SELECT si.*, s.name AS studio_name, s.logo_key AS studio_logo_key
       FROM studio_invites si
       JOIN studios s ON s.id = si.studio_id
       WHERE si.token = $1`,
      [token]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: 'Invite link is invalid or has expired.' });

    const invite = result.rows[0];

    if (invite.accepted_at)
      return res.status(410).json({ error: 'This invite has already been accepted.' });

    if (new Date(invite.expires_at) < new Date())
      return res.status(410).json({ error: 'This invite link has expired. Ask the studio owner to resend.' });

    res.json({
      studioName:    invite.studio_name,
      studioLogoKey: invite.studio_logo_key,
      role:          invite.role,
      email:         invite.email,
      expiresAt:     invite.expires_at,
    });
  } catch (err) { next(err); }
};

// ── POST /api/public/studio-invite/:token (public) ───────────
exports.acceptInvite = async (req, res, next) => {
  try {
    const { token }    = req.params;
    const { password, name } = req.body;

    const result = await db.query(
      `SELECT si.*, s.id AS studio_id, s.name AS studio_name
       FROM studio_invites si JOIN studios s ON s.id = si.studio_id
       WHERE si.token = $1 AND si.accepted_at IS NULL AND si.expires_at > NOW()`,
      [token]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: 'Invite is invalid, expired, or already used.' });

    const invite = result.rows[0];

    if (!password || password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    // Find or create user (by invite email)
    let userId;
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1', [invite.email]
    );

    if (existing.rows.length) {
      userId = existing.rows[0].id;
    } else {
      const hash    = await bcrypt.hash(password, 12);
      const newUser = await db.query(
        `INSERT INTO users (name, email, password_hash, is_email_verified)
         VALUES ($1,$2,$3,TRUE) RETURNING id`,
        [name?.trim() || invite.email.split('@')[0], invite.email, hash]
      );
      userId = newUser.rows[0].id;
    }

    // Add to studio_members
    await db.query(
      `INSERT INTO studio_members (studio_id, user_id, role, invited_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (studio_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [invite.studio_id, userId, invite.role, invite.invited_by]
    );

    // Mark invite accepted
    await db.query(
      'UPDATE studio_invites SET accepted_at = NOW() WHERE token = $1', [token]
    );

    // Issue JWT
    const jwtToken = jwt.sign(
      { userId, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logStudioAudit(invite.studio_id, userId, 'member_joined',
      'user', userId, { role: invite.role, via: 'invite_token' }, req.ip);

    res.json({
      message:    `Welcome to ${invite.studio_name}!`,
      token:      jwtToken,
      studioName: invite.studio_name,
      role:       invite.role,
    });
  } catch (err) { next(err); }
};
