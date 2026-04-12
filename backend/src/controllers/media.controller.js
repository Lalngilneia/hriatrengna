const db = require('../utils/db');
const r2 = require('../services/r2.service');
const { getAlbumPlanContext } = require('../utils/plan-access');

// ── INPUT LIMITS ──────────────────────────────────────────────
const MAX_TRIBUTE_TEXT = 2000;
const MAX_TRIBUTE_FROM = 100;
const MAX_CAPTION      = 300;
const DEFAULT_PLAN_LIMITS = {
  monthly:  { maxPhotos: 200,  maxVideos: 10 },
  yearly:   { maxPhotos: 500,  maxVideos: 30 },
  lifetime: { maxPhotos: 2000, maxVideos: 50 },
};

// Strip HTML tags for plain-text fields (tributes, captions)
const stripHtml = (str) => str ? String(str).replace(/<[^>]*>/g, '').trim() : '';

async function getMediaLimits(userId, albumId) {
  const context = await getAlbumPlanContext(userId, albumId);
  if (!context) return null;
  const fallback = DEFAULT_PLAN_LIMITS[context.planSlug] || null;
  return {
    subscriptionPlan: context.planSlug || null,
    maxPhotos: context.maxPhotos ?? fallback?.maxPhotos ?? null,
    maxVideos: context.maxVideos ?? fallback?.maxVideos ?? null,
  };
}

// ── ALBUM ACCESS HELPER (owner OR client_editor) ────────────
async function checkAlbumAccess(albumId, userId, requireEditor = false) {
  // Try owner-based plan context first
  const context = await getAlbumPlanContext(userId, albumId);
  if (context) return { context, isOwner: true };

  // Fall back to album_client_access
  const res2 = await db.query(
    'SELECT a.*, aca.role AS client_role FROM albums a JOIN album_client_access aca ON aca.album_id = a.id WHERE a.id = $1 AND aca.user_id = $2',
    [albumId, userId]
  );
  if (!res2.rows.length) return null;
  if (requireEditor && res2.rows[0].client_role !== 'client_editor') return null;
  return { context: null, isOwner: false, album: res2.rows[0] };
}

// ── UPLOAD MEDIA ──────────────────────────────────────────────
exports.upload = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const { type }    = req.body;

    // Allow album owner (plan context) OR client with editor role
    const access = await checkAlbumAccess(albumId, req.userId, true);
    if (!access) return res.status(404).json({ error: 'Album not found.' });

    const albumContext = access.context; // may be null for clients
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    // Demo account: enforce 10-photo total cap
    const userRow = await db.query(
      'SELECT is_demo FROM users WHERE id = $1', [req.userId]
    );
    if (userRow.rows[0]?.is_demo) {
      const demoCountRes = await db.query(
        `SELECT COUNT(*)::int AS total FROM media
         JOIN albums ON albums.id = media.album_id
         WHERE albums.user_id = $1 AND media.type IN ('photo','video')`,
        [req.userId]
      );
      const limitRes = await db.query(
        "SELECT value FROM app_settings WHERE key = 'demo_max_photos'", []
      );
      const demoLimit = parseInt(limitRes.rows[0]?.value) || 10;
      if (parseInt(demoCountRes.rows[0]?.total) >= demoLimit) {
        return res.status(403).json({
          error: `Demo accounts are limited to ${demoLimit} media files. Subscribe to upload more.`,
          isDemo: true, limit: demoLimit,
        });
      }
    }
    if (!['photo', 'video', 'audio'].includes(type))
      return res.status(400).json({ error: 'Invalid media type. Must be photo, video, or audio.' });

    if ((type === 'photo' || type === 'video') && access.isOwner) {
      // Only enforce plan-based media limits for album owners, not clients
      const limits = await getMediaLimits(req.userId, albumId);
      const countRes = await db.query(
        `SELECT type, COUNT(*)::int AS count
         FROM media
         WHERE album_id = $1 AND type = ANY($2::text[])
         GROUP BY type`,
        [albumId, ['photo', 'video']]
      );
      const counts = Object.fromEntries(countRes.rows.map(row => [row.type, row.count]));
      const currentPhotos = counts.photo || 0;
      const currentVideos = counts.video || 0;

      if (type === 'photo' && limits.maxPhotos !== null && currentPhotos >= limits.maxPhotos) {
        return res.status(400).json({
          error: `Photo limit reached for your ${limits.subscriptionPlan || 'current'} plan. Maximum ${limits.maxPhotos} photos allowed.`,
          code: 'PHOTO_LIMIT_REACHED',
          maxPhotos: limits.maxPhotos,
          currentPhotos,
        });
      }

      if (type === 'video' && limits.maxVideos !== null && currentVideos >= limits.maxVideos) {
        return res.status(400).json({
          error: `Video limit reached for your ${limits.subscriptionPlan || 'current'} plan. Maximum ${limits.maxVideos} videos allowed.`,
          code: 'VIDEO_LIMIT_REACHED',
          maxVideos: limits.maxVideos,
          currentVideos,
        });
      }
    }

    const { key, url, size, contentType, savedPercent, transcoded } = await r2.uploadFile({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      albumId,
      type,
    });

    // user_id on the media row = the uploader (client or owner)
    const result = await db.query(
      `INSERT INTO media (album_id, user_id, type, r2_key, file_name, file_size, mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [albumId, req.userId, type, key, req.file.originalname, size, contentType]
    );

    res.status(201).json({
      media: { ...result.rows[0], url },
      processing: {
        compressed: savedPercent > 0,
        savedPercent,
        transcoded,
      },
    });
  } catch (err) { next(err); }
};

// ── ADD TRIBUTE (text) ────────────────────────────────────────
exports.addTribute = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const text = stripHtml(req.body.text);
    const from = stripHtml(req.body.from);

    if (!text) return res.status(400).json({ error: 'Tribute text is required.' });
    if (text.length > MAX_TRIBUTE_TEXT)
      return res.status(400).json({ error: `Tribute must be ${MAX_TRIBUTE_TEXT} characters or less.` });
    if (from.length > MAX_TRIBUTE_FROM)
      return res.status(400).json({ error: `"From" name must be ${MAX_TRIBUTE_FROM} characters or less.` });

    // Allow owner or client_editor to add tributes
    const access = await checkAlbumAccess(albumId, req.userId, true);
    if (!access) return res.status(404).json({ error: 'Album not found.' });

    const result = await db.query(
      `INSERT INTO media (album_id, user_id, type, tribute_text, tribute_from)
       VALUES ($1,$2,'tribute',$3,$4) RETURNING *`,
      [albumId, req.userId, text, from || null]
    );

    res.status(201).json({ media: result.rows[0] });
  } catch (err) { next(err); }
};

// ── LIST MEDIA FOR ALBUM ──────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    // Allow owner or any client access (viewer can view media)
    const access = await checkAlbumAccess(albumId, req.userId, false);
    if (!access) return res.status(404).json({ error: 'Album not found.' });

    const result = await db.query(
      `SELECT *,
         CASE WHEN r2_key IS NOT NULL
           THEN CONCAT($1::text, '/', r2_key) ELSE NULL END AS url
       FROM media WHERE album_id = $2
       ORDER BY display_order, created_at`,
      [process.env.R2_PUBLIC_URL, albumId]
    );

    res.json({ media: result.rows });
  } catch (err) { next(err); }
};

// ── DELETE MEDIA ──────────────────────────────────────────────
exports.delete = async (req, res, next) => {
  try {
    // First find the media item and get its album_id
    const mediaRow = await db.query(
      'SELECT * FROM media WHERE id = $1', [req.params.mediaId]
    );
    if (!mediaRow.rows.length) return res.status(404).json({ error: 'Media not found.' });
    const media = mediaRow.rows[0];

    // Verify the requester has editor access to the album (owner OR client_editor)
    const access = await checkAlbumAccess(media.album_id, req.userId, true);
    if (!access) return res.status(404).json({ error: 'Media not found.' });

    if (media.r2_key) await r2.deleteFile(media.r2_key);
    await db.query('DELETE FROM media WHERE id = $1', [media.id]);
    res.json({ message: 'Media deleted.' });
  } catch (err) { next(err); }
};

// ── UPDATE MEDIA (caption) ────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const caption = stripHtml(req.body.caption);
    if (caption && caption.length > MAX_CAPTION)
      return res.status(400).json({ error: `Caption must be ${MAX_CAPTION} characters or less.` });

    // Verify editor access to the album (owner OR client_editor)
    const access = await checkAlbumAccess(req.params.albumId, req.userId, true);
    if (!access) return res.status(404).json({ error: 'Media not found.' });

    const result = await db.query(
      'UPDATE media SET caption = $1 WHERE id = $2 AND album_id = $3 RETURNING *',
      [caption || null, req.params.mediaId, req.params.albumId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Media not found.' });
    res.json({ media: result.rows[0] });
  } catch (err) { next(err); }
};
