'use strict';
/**
 * studio.controller.js
 * Full B2B photographer studio controller.
 *
 * Phase 1:
 *   createStudio, getStudio, updateStudio, uploadLogo
 *   createClientAlbum, listClientAlbums, getClientAlbum
 *   sendClaimLink, bulkQrPdf, getDeliveryCard
 *   claimAlbum (public), checkClaim (public)
 *
 * Phase 2:
 *   inviteMember, listMembers, removeMember
 *   getUpsellAlerts, resolveUpsell
 *   getStats
 */

const crypto  = require('crypto');
const db       = require('../utils/db');
const r2       = require('../services/r2.service');
const qrcode   = require('qrcode');
const { sanitizePlainText } = require('../utils/content-sanitizer');
const emailService = require('../services/email.service');
const { getPublicAlbumPath, getPublicAlbumUrl } = require('../utils/public-album-url');
const {
  requireStudioEntitlement,
  getStudioEntitlement,
  logStudioAudit,
  logStudioUsage,
} = require('../utils/studio-entitlement');

const APP_URL = process.env.APP_URL || 'https://hriatrengna.in';
const CDN     = process.env.R2_PUBLIC_URL || 'https://cdn.hriatrengna.in';

// ── HELPERS ──────────────────────────────────────────────────
const isEmail  = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const safe     = (v, max) => v != null ? sanitizePlainText(String(v), max) : undefined;
const genToken = () => crypto.randomBytes(32).toString('hex');

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    + '-' + Math.random().toString(36).slice(2, 6);
}

// ═══════════════════════════════════════════════════════════
// STUDIO MANAGEMENT
// ═══════════════════════════════════════════════════════════

// POST /api/studio — create studio account
// Creating a studio does NOT require a subscription yet — the owner
// can create the studio profile and then subscribe to unlock features.
exports.createStudio = async (req, res, next) => {
  try {
    const { name, email, phone, website, bio } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Studio name is required.' });

    // One studio per user (for now — multi-studio is a future feature)
    const existing = await db.query(
      'SELECT id FROM studios WHERE owner_user_id = $1', [req.userId]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'You already have a studio account.' });

    const result = await db.query(
      `INSERT INTO studios (owner_user_id, name, email, phone, website, bio)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, safe(name,255), email||null, safe(phone,30), safe(website,500), safe(bio,1000)]
    );

    // Auto-add owner as studio member
    await db.query(
      `INSERT INTO studio_members (studio_id, user_id, role, invited_by)
       VALUES ($1,$2,'owner',$2) ON CONFLICT DO NOTHING`,
      [result.rows[0].id, req.userId]
    );

    await logStudioAudit(result.rows[0].id, req.userId, 'studio_created', 'studio', result.rows[0].id, { name }, req.ip);

    res.status(201).json({
      studio:    formatStudio(result.rows[0]),
      // Tell the frontend the studio needs a subscription to use features
      needsSubscription: true,
    });
  } catch (err) { next(err); }
};

// GET /api/studio/me
exports.getStudio = async (req, res, next) => {
  try {
    const studioRes = await db.query('SELECT * FROM studios WHERE id = $1', [req.studioId]);
    if (!studioRes.rows.length) return res.status(404).json({ error: 'Studio not found.' });

    // Get member count
    const memberRes = await db.query(
      'SELECT COUNT(*)::int AS count FROM studio_members WHERE studio_id = $1', [req.studioId]
    );

    res.json({
      studio:      formatStudio(studioRes.rows[0]),
      memberCount: memberRes.rows[0].count,
      role:        req.studioRole,
    });
  } catch (err) { next(err); }
};

// PUT /api/studio/me
exports.updateStudio = async (req, res, next) => {
  try {
    if (req.studioRole !== 'owner')
      return res.status(403).json({ error: 'Only the studio owner can update settings.' });

    const { name, email, phone, website, bio, brandingEnabled } = req.body;
    const fields = [
      { col: 'name',             val: name     ? safe(name,255)    : undefined },
      { col: 'email',            val: email    || null },
      { col: 'phone',            val: phone    ? safe(phone,30)    : undefined },
      { col: 'website',          val: website  ? safe(website,500) : undefined },
      { col: 'bio',              val: bio      ? safe(bio,1000)    : undefined },
      { col: 'branding_enabled', val: typeof brandingEnabled === 'boolean' ? brandingEnabled : undefined },
    ].filter(f => f.val !== undefined);

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

    const setClauses = fields.map((f,i) => `${f.col} = $${i+1}`).join(', ');
    const values     = [...fields.map(f => f.val), req.studioId];

    const result = await db.query(
      `UPDATE studios SET ${setClauses}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json({ studio: formatStudio(result.rows[0]) });
  } catch (err) { next(err); }
};

// POST /api/studio/me/logo
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const oldRes = await db.query('SELECT logo_key FROM studios WHERE id = $1', [req.studioId]);
    const oldKey = oldRes.rows[0]?.logo_key;
    if (oldKey) r2.deleteFile(oldKey).catch(() => {});

    const { key, url } = await r2.uploadFile({
      buffer: req.file.buffer, mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      albumId: `studio-${req.studioId}`, type: 'photo',
    });

    await db.query('UPDATE studios SET logo_key = $1 WHERE id = $2', [key, req.studioId]);
    res.json({ key, url: `${CDN}/${key}` });
  } catch (err) { next(err); }
};

// GET /api/studio/me/stats
exports.getStats = async (req, res, next) => {
  try {
    const [albumStats, upsellStats] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*)::int                                         AS total_albums,
           COUNT(*) FILTER (WHERE claimed_at IS NOT NULL)::int  AS claimed,
           COUNT(*) FILTER (WHERE claimed_at IS NULL)::int      AS unclaimed,
           COUNT(*) FILTER (WHERE is_published = TRUE)::int     AS published
         FROM albums WHERE studio_id = $1`,
        [req.studioId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS pending
         FROM upsell_notifications
         WHERE studio_id = $1 AND resolved_at IS NULL`,
        [req.studioId]
      ),
    ]);

    const s           = albumStats.rows[0];
    const entitlement = req.studioEntitlement || await getStudioEntitlement(req.studioId);
    const studio      = req.studio;

    res.json({
      albumQuota:     entitlement.hasActiveSub ? entitlement.albumQuota : studio.album_quota,
      albumsUsed:     studio.albums_used,
      albumsLeft:     (entitlement.hasActiveSub ? entitlement.albumQuota : studio.album_quota) - studio.albums_used,
      seatQuota:      entitlement.seatQuota,
      hasActiveSub:   entitlement.hasActiveSub,
      planSlug:       entitlement.planSlug,
      totalAlbums:    s.total_albums,
      claimed:        s.claimed,
      unclaimed:      s.unclaimed,
      published:      s.published,
      pendingUpsells: upsellStats.rows[0].pending,
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// CLIENT ALBUM MANAGEMENT
// ═══════════════════════════════════════════════════════════

// POST /api/studio/albums — create a client album
exports.createClientAlbum = async (req, res, next) => {
  try {
    const studio = req.studio;

    // Entitlement check — must have active studio subscription
    const entitlement = req.studioEntitlement || await getStudioEntitlement(req.studioId);
    if (!entitlement.hasActiveSub)
      return res.status(403).json({
        error: 'An active Studio subscription is required to create client albums.',
        code:  'STUDIO_NO_SUBSCRIPTION',
        upgradeUrl: '/studio/billing',
      });

    // Quota check against studio_subscriptions value
    if (studio.albums_used >= entitlement.albumQuota)
      return res.status(403).json({
        error: `Album quota reached (${entitlement.albumQuota} slots). Please upgrade your plan.`,
        code: 'QUOTA_EXCEEDED',
        upgradeUrl: '/studio/billing',
      });

    const { clientName, clientEmail, albumType = 'wedding',
            weddingDate, partner1Name, partner2Name, venueName } = req.body;

    if (!clientName?.trim())
      return res.status(400).json({ error: 'Client name is required.' });
    if (clientEmail && !isEmail(clientEmail))
      return res.status(400).json({ error: 'Invalid client email.' });

    const slug        = slugify(safe(clientName, 60));
    const claimToken  = genToken();
    const studioOwner = await db.query(
      'SELECT id FROM users WHERE id = $1', [studio.owner_user_id]
    );

    // Create album owned by the studio's owner user
    const result = await db.query(
      `INSERT INTO albums
         (user_id, studio_id, name, slug, type,
          wedding_date, partner1_name, partner2_name, venue_name,
          client_name, client_email, claim_token,
          is_published, allow_public_wishes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, TRUE, TRUE)
       RETURNING *`,
      [
        studio.owner_user_id, req.studioId,
        safe(clientName, 255), slug, albumType,
        weddingDate || null,
        partner1Name ? safe(partner1Name, 255) : null,
        partner2Name ? safe(partner2Name, 255) : null,
        venueName    ? safe(venueName, 255)    : null,
        safe(clientName, 255),
        clientEmail  ? clientEmail.toLowerCase().trim() : null,
        claimToken,
      ]
    );

    // Increment studio usage counter
    await db.query(
      'UPDATE studios SET albums_used = albums_used + 1 WHERE id = $1', [req.studioId]
    );

    await logStudioAudit(req.studioId, req.userId, 'album_created', 'album', result.rows[0].id,
      { clientName, albumType }, req.ip);
    await logStudioUsage(req.studioId, 'album_created', { albumId: result.rows[0].id, albumType });

    const album      = result.rows[0];
    const claimUrl   = `${APP_URL}/claim/${claimToken}`;
    const albumUrl   = getPublicAlbumUrl(album.type, album.slug, APP_URL);
    const qrDataUrl  = await qrcode.toDataURL(albumUrl, { width: 300, margin: 2 });

    res.status(201).json({
      album:    formatAlbum(album),
      claimUrl,
      albumUrl,
      qrDataUrl,
    });
  } catch (err) {
    if (err.code === '23505') // unique slug violation
      return next(Object.assign(new Error('Album slug conflict. Please try again.'), { status: 409 }));
    next(err);
  }
};

// GET /api/studio/albums
exports.listClientAlbums = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE a.studio_id = $1';
    const params = [req.studioId];
    let idx = 2;

    if (status === 'claimed')   { where += ` AND a.claimed_at IS NOT NULL`; }
    if (status === 'unclaimed') { where += ` AND a.claimed_at IS NULL`; }
    if (search) {
      where += ` AND (a.client_name ILIKE $${idx} OR a.client_email ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    const [albumsRes, countRes] = await Promise.all([
      db.query(
        `SELECT a.*,
                COALESCE(mc.photo_count, 0)::int AS photo_count,
                COALESCE(mc.video_count, 0)::int AS video_count
         FROM albums a
         LEFT JOIN (
           SELECT album_id,
             COUNT(*) FILTER (WHERE type='photo')::int AS photo_count,
             COUNT(*) FILTER (WHERE type='video')::int AS video_count
           FROM media GROUP BY album_id
         ) mc ON mc.album_id = a.id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT $${idx} OFFSET $${idx+1}`,
        [...params, parseInt(limit), offset]
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM albums a ${where}`, params),
    ]);

    res.json({
      albums: albumsRes.rows.map(formatAlbum),
      total:  countRes.rows[0].total,
      page:   parseInt(page),
      pages:  Math.ceil(countRes.rows[0].total / parseInt(limit)),
    });
  } catch (err) { next(err); }
};

// GET /api/studio/albums/:albumId
exports.getClientAlbum = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const result = await db.query(
      `SELECT a.*,
              COALESCE(mc.photo_count,0)::int AS photo_count,
              COALESCE(mc.video_count,0)::int AS video_count,
              COALESCE(mc.audio_count,0)::int AS audio_count
       FROM albums a
       LEFT JOIN (
         SELECT album_id,
           COUNT(*) FILTER (WHERE type='photo')::int AS photo_count,
           COUNT(*) FILTER (WHERE type='video')::int AS video_count,
           COUNT(*) FILTER (WHERE type='audio')::int AS audio_count
         FROM media GROUP BY album_id
       ) mc ON mc.album_id = a.id
       WHERE a.id = $1 AND a.studio_id = $2`,
      [albumId, req.studioId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Album not found.' });

    const album     = result.rows[0];
    const claimUrl  = album.claim_token ? `${APP_URL}/claim/${album.claim_token}` : null;
    const albumUrl  = getPublicAlbumUrl(album.type, album.slug, APP_URL);
    const qrDataUrl = await qrcode.toDataURL(albumUrl, { width: 300, margin: 2 });

    res.json({ album: formatAlbum(album), claimUrl, albumUrl, qrDataUrl });
  } catch (err) { next(err); }
};

// DELETE /api/studio/albums/:albumId
exports.deleteClientAlbum = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const albumRes = await db.query(
      'SELECT id FROM albums WHERE id = $1 AND studio_id = $2', [albumId, req.studioId]
    );
    if (!albumRes.rows.length) return res.status(404).json({ error: 'Album not found.' });

    await db.query('DELETE FROM albums WHERE id = $1', [albumId]);
    await db.query(
      'UPDATE studios SET albums_used = GREATEST(albums_used - 1, 0) WHERE id = $1',
      [req.studioId]
    );
    await logStudioAudit(req.studioId, req.userId, 'album_deleted', 'album', albumId, {}, req.ip);
    await logStudioUsage(req.studioId, 'album_deleted', { albumId });
    res.json({ message: 'Album deleted.' });
  } catch (err) { next(err); }
};

// ── SEND CLAIM LINK ───────────────────────────────────────────
exports.sendClaimLink = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const albumRes = await db.query(
      'SELECT * FROM albums WHERE id = $1 AND studio_id = $2', [albumId, req.studioId]
    );
    if (!albumRes.rows.length) return res.status(404).json({ error: 'Album not found.' });
    const album = albumRes.rows[0];

    if (!album.client_email)
      return res.status(400).json({ error: 'No client email on this album. Add one first.' });
    if (album.claimed_at)
      return res.status(400).json({ error: 'Album already claimed by client.' });

    const claimUrl   = `${APP_URL}/claim/${album.claim_token}`;
    const studio     = req.studio;
    const albumUrl   = getPublicAlbumUrl(album.type, album.slug, APP_URL);
    const qrDataUrl  = await qrcode.toDataURL(albumUrl, { width: 200, margin: 2 });

    // Send claim email
    await emailService.sendStudioClaimLink({
      toEmail:    album.client_email,
      clientName: album.client_name || 'Valued Client',
      studioName: studio.name,
      albumName:  album.name,
      claimUrl,
      albumUrl,
      qrDataUrl,
    });

    res.json({ message: `Claim link sent to ${album.client_email}` });
  } catch (err) { next(err); }
};

// ── BULK QR PDF ───────────────────────────────────────────────
// GET /api/studio/albums/qr-sheet?ids=id1,id2,...
exports.bulkQrSheet = async (req, res, next) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 50);
    if (!ids.length) return res.status(400).json({ error: 'No album IDs provided.' });

    const result = await db.query(
      `SELECT id, name, slug, type, client_name, claim_token
       FROM albums WHERE id = ANY($1::uuid[]) AND studio_id = $2
       ORDER BY client_name`,
      [ids, req.studioId]
    );

    // Generate QR data URLs for each album
    const items = await Promise.all(result.rows.map(async a => {
      const albumUrl  = getPublicAlbumUrl(a.type, a.slug, APP_URL);
      const publicPath = getPublicAlbumPath(a.type, a.slug);
      const claimUrl  = a.claim_token ? `${APP_URL}/claim/${a.claim_token}` : albumUrl;
      const qrDataUrl = await qrcode.toDataURL(albumUrl, { width: 200, margin: 2 });
      return { ...a, albumUrl, publicPath, claimUrl, qrDataUrl };
    }));

    // Return JSON — frontend renders and saves as image/PDF using html2canvas
    res.json({ items, studio: { name: req.studio.name } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// CLIENT CLAIM FLOW (PUBLIC)
// ═══════════════════════════════════════════════════════════

// GET /api/public/claim/:token — check if token is valid
exports.checkClaim = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!/^[a-f0-9]{64}$/.test(token))
      return res.status(400).json({ error: 'Invalid claim token.' });

    const result = await db.query(
      `SELECT a.id, a.name, a.slug, a.type, a.client_name, a.claimed_at,
              s.name AS studio_name, s.logo_key AS studio_logo_key
       FROM albums a
       JOIN studios s ON s.id = a.studio_id
       WHERE a.claim_token = $1`,
      [token]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: 'Claim link is invalid or has expired.' });

    const album = result.rows[0];
    if (album.claimed_at)
      return res.status(410).json({
        error:    'This album has already been claimed.',
        claimed:  true,
        albumUrl: getPublicAlbumUrl(album.type, album.slug, APP_URL),
      });

    res.json({
      albumName:       album.name,
      albumType:       album.type,
      clientName:      album.client_name,
      studioName:      album.studio_name,
      studioLogoUrl:   album.studio_logo_key ? `${CDN}/${album.studio_logo_key}` : null,
    });
  } catch (err) { next(err); }
};

// POST /api/public/claim/:token — client claims the album
//
// FIX: Clients are no longer given full legacy business ownership of the album.
// Instead we:
//   1. Create/find the user without mutating any subscription plan
//   2. Write a scoped album_client_access record (role = 'client_editor')
//   3. Record claimed_at + client_user_id on the album for studio tracking
//   4. Leave user_id (studio owner) untouched
exports.claimAlbum = async (req, res, next) => {
  try {
    const { token }    = req.params;
    const { password, name } = req.body;

    if (!/^[a-f0-9]{64}$/.test(token))
      return res.status(400).json({ error: 'Invalid claim token.' });
    if (!password || password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const albumRes = await db.query(
      `SELECT a.*, s.name AS studio_name, s.owner_user_id AS studio_owner_id
       FROM albums a JOIN studios s ON s.id = a.studio_id
       WHERE a.claim_token = $1 AND a.claimed_at IS NULL`,
      [token]
    );
    if (!albumRes.rows.length)
      return res.status(404).json({ error: 'Claim link is invalid, expired, or already used.' });

    const album  = albumRes.rows[0];
    const bcrypt = require('bcryptjs');
    const jwt    = require('jsonwebtoken');

    // Find or create a plain user account without changing subscription state.
    let clientUserId;
    const emailToUse = album.client_email;

    if (emailToUse) {
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1', [emailToUse]
      );
      if (existingUser.rows.length) {
        clientUserId = existingUser.rows[0].id;
      } else {
        const hash    = await bcrypt.hash(password, 12);
        const newUser = await db.query(
          `INSERT INTO users (name, email, password_hash, is_email_verified)
           VALUES ($1,$2,$3,TRUE) RETURNING id`,
          // This remains a plain consumer account with no legacy business status.
          [name?.trim() || album.client_name || 'Client', emailToUse, hash]
        );
        clientUserId = newUser.rows[0].id;
      }
    }

    // Mark album as claimed (studio tracking) — user_id stays as studio owner
    await db.query(
      `UPDATE albums
       SET claimed_at     = NOW(),
           client_user_id = $1,
           claim_token    = NULL
       WHERE id = $2`,
      [clientUserId || null, album.id]
    );

    // Grant scoped access via album_client_access
    if (clientUserId) {
      await db.query(
        `INSERT INTO album_client_access (album_id, user_id, role, granted_by)
         VALUES ($1,$2,'client_editor',$3)
         ON CONFLICT (album_id, user_id) DO UPDATE SET role = 'client_editor'`,
        [album.id, clientUserId, album.studio_owner_id]
      );
    }

    // Issue JWT
    const jwtToken = clientUserId
      ? jwt.sign({ userId: clientUserId, tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
      : null;

    res.json({
      message:  `Album claimed! Welcome, ${name?.trim() || album.client_name}.`,
      albumUrl: getPublicAlbumUrl(album.type, album.slug, APP_URL),
      token:    jwtToken,
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// PHASE 2: TEAM MEMBERS
// ═══════════════════════════════════════════════════════════

// GET /api/studio/members
exports.listMembers = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT sm.id, sm.role, sm.joined_at,
              u.id AS user_id, u.name, u.email
       FROM studio_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.studio_id = $1
       ORDER BY sm.joined_at`,
      [req.studioId]
    );
    res.json({ members: result.rows });
  } catch (err) { next(err); }
};

// POST /api/studio/members — now proxies to the invite flow
// Kept for backwards-compat. Frontend should use POST /api/studio/invites.
exports.inviteMember = async (req, res, next) => {
  // Delegate to the invite controller
  const inviteCtrl = require('./studio.invite.controller');
  return inviteCtrl.sendInvite(req, res, next);
};

// DELETE /api/studio/members/:userId
exports.removeMember = async (req, res, next) => {
  try {
    if (req.studioRole !== 'owner')
      return res.status(403).json({ error: 'Only studio owner can remove members.' });
    if (req.params.userId === req.userId)
      return res.status(400).json({ error: 'Cannot remove yourself.' });

    await db.query(
      'DELETE FROM studio_members WHERE studio_id = $1 AND user_id = $2',
      [req.studioId, req.params.userId]
    );
    await logStudioAudit(req.studioId, req.userId, 'member_removed', 'user', req.params.userId, {}, req.ip);
    res.json({ message: 'Member removed.' });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// PHASE 2: UPSELL ALERTS
// ═══════════════════════════════════════════════════════════

// GET /api/studio/upsells
exports.getUpsellAlerts = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT un.*, a.name AS album_name, a.slug, a.type AS album_type, a.client_name
        FROM upsell_notifications un
        JOIN albums a ON a.id = un.album_id
        WHERE un.studio_id = $1 AND un.resolved_at IS NULL
        ORDER BY un.sent_at DESC`,
      [req.studioId]
    );
    res.json({
      upsells: result.rows.map((row) => ({
        ...row,
        publicPath: getPublicAlbumPath(row.album_type, row.slug),
        publicUrl: getPublicAlbumUrl(row.album_type, row.slug, APP_URL),
      })),
    });
  } catch (err) { next(err); }
};

// PUT /api/studio/upsells/:id/resolve
exports.resolveUpsell = async (req, res, next) => {
  try {
    await db.query(
      `UPDATE upsell_notifications SET resolved_at = NOW()
       WHERE id = $1 AND studio_id = $2`,
      [req.params.id, req.studioId]
    );
    res.json({ message: 'Marked as resolved.' });
  } catch (err) { next(err); }
};


// ── PHOTOGRAPHER: CUSTOMIZE CLIENT ALBUM ─────────────────────
// Photographers can set theme, font, layout, colors for client albums
// Uses existing album.theme + new custom_theme_config JSONB column
exports.customizeAlbum = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const {
      theme,         // preset theme slug: 'classic','dark','floral', etc
      customColors,  // { bg, accent, text, card }
      fontFamily,    // 'Playfair Display' | 'Lora' | 'Crimson Pro' | 'Inter'
      layout,        // 'grid' | 'masonry' | 'slideshow' | 'magazine'
      showDates,
      showCaptions,
      showBio,
      heroStyle,     // 'full' | 'minimal' | 'split'
    } = req.body;

    // Verify album belongs to this studio
    const albumRes = await db.query(
      `SELECT id, type FROM albums WHERE id = $1 AND studio_id = $2`,
      [albumId, req.studioId]
    );
    if (!albumRes.rows.length)
      return res.status(404).json({ error: 'Album not found.' });

    // Validate theme if provided
    const VALID_THEMES = [
      'classic','dark','floral','traditional','minimal',
      'classic-romance','floral-garden','minimalist','royal','retro-film','tropical',
    ];
    if (theme && !VALID_THEMES.includes(theme))
      return res.status(400).json({ error: `Invalid theme. Valid: ${VALID_THEMES.join(', ')}` });

    // Validate colors (hex only)
    const hexRe = /^#[0-9A-Fa-f]{6}$/;
    let safeColors = null;
    if (customColors && typeof customColors === 'object') {
      safeColors = {};
      for (const [key, val] of Object.entries(customColors)) {
        if (['bg','accent','text','card','border'].includes(key) && hexRe.test(val)) {
          safeColors[key] = val;
        }
      }
    }

    const VALID_FONTS    = ['Playfair Display','Lora','Crimson Pro','Inter','Great Vibes'];
    const VALID_LAYOUTS  = ['grid','masonry','slideshow','magazine'];
    const VALID_HERO     = ['full','minimal','split'];

    const config = {
      ...(safeColors   ? { customColors: safeColors } : {}),
      ...(fontFamily && VALID_FONTS.includes(fontFamily)   ? { fontFamily }   : {}),
      ...(layout     && VALID_LAYOUTS.includes(layout)     ? { layout }       : {}),
      ...(heroStyle  && VALID_HERO.includes(heroStyle)     ? { heroStyle }    : {}),
      ...(typeof showDates    === 'boolean' ? { showDates }    : {}),
      ...(typeof showCaptions === 'boolean' ? { showCaptions } : {}),
      ...(typeof showBio      === 'boolean' ? { showBio }      : {}),
    };

    const fields = [];
    const values = [];
    let idx = 1;

    if (theme) {
      fields.push(`theme = $${idx++}`);
      values.push(theme);
    }
    if (Object.keys(config).length > 0) {
      fields.push(`custom_theme_config = $${idx++}`);
      values.push(JSON.stringify(config));
    }

    if (!fields.length)
      return res.status(400).json({ error: 'No customisation fields provided.' });

    values.push(albumId);
    const result = await db.query(
      `UPDATE albums SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING id, theme, custom_theme_config`,
      values
    );

    res.json({
      message:      'Album customised.',
      albumId,
      theme:        result.rows[0].theme,
      customConfig: result.rows[0].custom_theme_config || {},
    });
  } catch (err) { next(err); }
};

// GET /api/studio/albums/:albumId/customize — read current config
exports.getAlbumCustomization = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const result = await db.query(
      `SELECT id, name, slug, theme, custom_theme_config, type
       FROM albums WHERE id = $1 AND studio_id = $2`,
      [albumId, req.studioId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'Album not found.' });

    const a = result.rows[0];
    res.json({
      albumId:      a.id,
      albumName:    a.name,
      albumType:    a.type,
      slug:         a.slug,
      theme:        a.theme || 'classic',
      customConfig: a.custom_theme_config || {},
      publicPath:   getPublicAlbumPath(a.type, a.slug),
      publicUrl:    getPublicAlbumUrl(a.type, a.slug, APP_URL),
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════
function formatStudio(s) {
  return {
    id:              s.id,
    name:            s.name,
    email:           s.email,
    phone:           s.phone,
    website:         s.website,
    bio:             s.bio,
    plan:            s.plan,
    logoUrl:         s.logo_key ? `${CDN}/${s.logo_key}` : null,
    albumQuota:      s.album_quota,
    albumsUsed:      s.albums_used,
    albumsLeft:      s.album_quota - s.albums_used,
    brandingEnabled: s.branding_enabled,
    isActive:        s.is_active,
    createdAt:       s.created_at,
  };
}

function formatAlbum(a) {
  return {
    id:           a.id,
    name:         a.name,
    slug:         a.slug,
    type:         a.type,
    clientName:   a.client_name,
    clientEmail:  a.client_email,
    claimToken:   a.claim_token,
    claimedAt:    a.claimed_at,
    isPublished:  a.is_published,
    weddingDate:  a.wedding_date,
    partner1Name: a.partner1_name,
    partner2Name: a.partner2_name,
    venueName:    a.venue_name,
    photoCount:   a.photo_count || 0,
    videoCount:   a.video_count || 0,
    publicPath:   getPublicAlbumPath(a.type, a.slug),
    publicUrl:    getPublicAlbumUrl(a.type, a.slug, APP_URL),
    albumUrl:     getPublicAlbumUrl(a.type, a.slug, APP_URL),
    createdAt:    a.created_at,
  };
}
