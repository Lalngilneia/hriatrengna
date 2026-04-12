'use strict';
const db   = require('../utils/db');
const r2   = require('../services/r2.service');
const push = require('../services/push.service');
const { getPublicAccessState } = require('../utils/public-access');

// ── SUBMIT GUEST WISH (public — no auth) ──────────────────────
exports.submit = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug))
      return res.status(404).json({ error: 'Album not found.' });

    const { guestName, message } = req.body;
    if (!message || message.trim().length < 2)
      return res.status(400).json({ error: 'Message is required.' });
    if (message.length > 2000)
      return res.status(400).json({ error: 'Message too long (max 2000 characters).' });

    // Find album
    const albumRes = await db.query(
      `SELECT a.id, a.name, a.type, a.partner1_name, a.partner2_name,
              a.allow_public_tributes, a.allow_public_wishes, a.studio_id,
              u.subscription_status, u.grace_period_until
         FROM albums a
         JOIN users u ON u.id = a.user_id
        WHERE a.slug = $1 AND a.is_published = TRUE`,
      [slug]
    );
    if (!albumRes.rows.length)
      return res.status(404).json({ error: 'Album not found.' });

    const album = albumRes.rows[0];
    const access = await getPublicAccessState({
      ownerStatus: album.subscription_status,
      ownerGracePeriodUntil: album.grace_period_until,
      studioId: album.studio_id,
    });
    if (!access.hasAccess)
      return res.status(404).json({ error: 'Album not found.' });
    const isWedding  = album.type === 'wedding';
    const isMemorial = album.type === 'memorial';

    // Check if contributions are enabled for this album type
    const tributeType = isWedding ? 'wish' : 'tribute';
    const isAllowed   = isWedding ? album.allow_public_wishes : album.allow_public_tributes;
    if (!isAllowed) {
      return res.status(403).json({ error: 'Public contributions are not enabled for this album.' });
    }

    // Rate limit: max 3 wishes per IP per album per hour
    const rateRes = await db.query(
      `SELECT COUNT(*) FROM guest_wishes
        WHERE album_id = $1 AND ip_address = $2
          AND created_at > NOW() - INTERVAL '1 hour'`,
      [album.id, req.ip]
    );
    if (parseInt(rateRes.rows[0].count) >= 3)
      return res.status(429).json({ error: 'Too many wishes submitted. Please try again later.' });

    const result = await db.query(
      `INSERT INTO guest_wishes (album_id, guest_name, message, ip_address, tribute_type, status)
       VALUES ($1, $2, $3, $4, $5, 'approved') RETURNING *`,
      [album.id, guestName?.trim().substring(0, 255) || 'Anonymous', message.trim(), req.ip, tributeType]
    );

    // Push notification to admin
    push.notify.custom(
      `💌 New Guest Wish`,
      `${guestName || 'Anonymous'} left a wish on "${album.name}"`,
      'guest-wish'
    ).catch(() => {});

    res.json({ message: isWedding ? 'Your wish has been submitted! Thank you for celebrating with us.' : 'Your tribute has been added. Thank you for honouring their memory.' });
  } catch (err) { next(err); }
};

// ── LIST WISHES FOR SUBSCRIBER ────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const validStatuses = ['pending', 'approved', 'rejected', 'all'];
    const statusFilter = validStatuses.includes(status) ? status : 'pending';

    const result = await db.query(
      `SELECT gw.id, gw.guest_name, gw.message, gw.video_key, gw.status, gw.created_at,
              a.name AS album_name, a.slug AS album_slug
         FROM guest_wishes gw
         JOIN albums a ON a.id = gw.album_id
        WHERE a.user_id = $1
          ${statusFilter !== 'all' ? 'AND gw.status = $2' : ''}
        ORDER BY gw.created_at DESC LIMIT 100`,
      statusFilter !== 'all' ? [req.userId, statusFilter] : [req.userId]
    );
    res.json({ wishes: result.rows });
  } catch (err) { next(err); }
};

// ── MODERATE WISH (subscriber) ────────────────────────────────
exports.moderate = async (req, res, next) => {
  try {
    const { wishId } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action))
      return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });

    const status = action === 'approve' ? 'approved' : 'rejected';

    // Ensure wish belongs to subscriber's album
    const result = await db.query(
      `UPDATE guest_wishes gw SET status = $1
         FROM albums a
        WHERE gw.id = $2 AND gw.album_id = a.id AND a.user_id = $3
       RETURNING gw.id, gw.status`,
      [status, wishId, req.userId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Wish not found.' });

    res.json({ message: `Wish ${status}.`, wish: result.rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE WISH (subscriber) ──────────────────────────────────
exports.delete = async (req, res, next) => {
  try {
    const { wishId } = req.params;
    const result = await db.query(
      `DELETE FROM guest_wishes gw USING albums a
        WHERE gw.id = $1 AND gw.album_id = a.id AND a.user_id = $2
       RETURNING gw.id`,
      [wishId, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Wish not found.' });
    res.json({ message: 'Wish deleted.' });
  } catch (err) { next(err); }
};

// ── ADMIN: LIST ALL WISHES ────────────────────────────────────
exports.adminList = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT gw.*, a.name AS album_name, a.slug AS album_slug, u.name AS owner_name
         FROM guest_wishes gw
         JOIN albums a ON a.id = gw.album_id
         JOIN users  u ON u.id = a.user_id
        WHERE ($1::text IS NULL OR gw.status = $1)
        ORDER BY gw.created_at DESC LIMIT 100`,
      [req.query.status || null]
    );
    res.json({ wishes: result.rows });
  } catch (err) { next(err); }
};

// ── LIST PUBLIC WISHES/TRIBUTES FOR ALBUM PAGE ────────────────
exports.listPublic = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug))
      return res.status(404).json({ error: 'Album not found.' });

    const accessRes = await db.query(
      `SELECT a.id, a.studio_id, u.subscription_status, u.grace_period_until
         FROM albums a
         JOIN users u ON u.id = a.user_id
        WHERE a.slug = $1 AND a.is_published = TRUE`,
      [slug]
    );
    const album = accessRes.rows[0];
    if (!album) return res.status(404).json({ error: 'Album not found.' });

    const access = await getPublicAccessState({
      ownerStatus: album.subscription_status,
      ownerGracePeriodUntil: album.grace_period_until,
      studioId: album.studio_id,
    });
    if (!access.hasAccess)
      return res.status(404).json({ error: 'Album not found.' });

    const result = await db.query(
      `SELECT gw.id, gw.guest_name, gw.message, gw.tribute_type, gw.created_at
         FROM guest_wishes gw
        WHERE gw.album_id = $1 AND gw.status = 'approved'
        ORDER BY gw.created_at DESC LIMIT 50`,
      [album.id]
    );
    res.json({ items: result.rows });
  } catch (err) { next(err); }
};
