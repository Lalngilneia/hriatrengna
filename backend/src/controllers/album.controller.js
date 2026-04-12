'use strict';
const db          = require('../utils/db');
const slugify     = require('slugify');
const QRCode      = require('qrcode');
const bcrypt      = require('bcryptjs');
const r2          = require('../services/r2.service');
const emailService = require('../services/email.service');
const plaqueService = require('../services/qr-plaque.service');
const push        = require('../services/push.service');
const { sanitizeBiographyHtml } = require('../utils/content-sanitizer');
const {
  MEMORIAL_THEME_IDS,
  WEDDING_THEME_IDS,
  getAlbumPlanContext,
  getPlanContextForType,
} = require('../utils/plan-access');

// ── INPUT LIMITS ──────────────────────────────────────────────
const MAX_NAME = 150;
const MAX_BIO  = 20000;

// ── SLUG GENERATOR ────────────────────────────────────────────
const generateSlug = async (name) => {
  const base   = slugify(name, { lower: true, strict: true }) || 'memorial';
  let   unique = base;
  for (let i = 1; i <= 100; i++) {
    const exists = await db.query('SELECT id FROM albums WHERE slug = $1', [unique]);
    if (!exists.rows.length) return unique;
    unique = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
};

// ── CLIENT ACCESS HELPER ──────────────────────────────────────
// Returns the album if the user owns it OR has album_client_access.
// requireRole: null = any access, 'client_editor' = needs edit rights
async function getAlbumWithAccess(albumId, userId, requireRole = null) {
  const result = await db.query(
    `SELECT a.*, aca.role AS client_role
     FROM albums a
     LEFT JOIN album_client_access aca
       ON aca.album_id = a.id AND aca.user_id = $2
     WHERE a.id = $1
       AND (a.user_id = $2 OR aca.user_id = $2)`,
    [albumId, userId]
  );
  if (!result.rows.length) return null;
  const album = result.rows[0];
  if (requireRole && album.user_id !== userId) {
    if (album.client_role !== 'client_editor') return null;
  }
  return album;
}

// ── CREATE ALBUM ──────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const requestedType = (req.body.type || 'memorial').toLowerCase();
    const sub = await getPlanContextForType(req.userId, requestedType);

    if (!sub?.planSlug) {
      return res.status(403).json({
        error: requestedType === 'wedding'
          ? 'A Wedding subscription is required to create wedding albums.'
          : 'A Memorial subscription is required to create memorial albums.',
        requiredType: requestedType,
      });
    }

    const quota      = Math.max(1, parseInt(sub.albumQuota, 10) || 1);
    const countRes   = await db.query(
      'SELECT COUNT(*)::int AS n FROM albums WHERE user_id = $1 AND type = $2',
      [req.userId, requestedType]
    );
    const albumCount = countRes.rows[0].n;
    if (albumCount >= quota) {
      return res.status(400).json({
        error: `Your ${requestedType} plan allows ${quota} album${quota > 1 ? 's' : ''}. All ${quota} used. Please upgrade to add more.`,
        quota, used: albumCount,
      });
    }

    const { name, birthDate, deathDate, birthYear, deathYear, biography, type } = req.body;
    const biographyHtml = biography !== undefined ? sanitizeBiographyHtml(biography) : undefined;

    if (!name?.trim())
      return res.status(400).json({ error: 'Album name is required.' });
    if (name.trim().length > MAX_NAME)
      return res.status(400).json({ error: `Album name must be ${MAX_NAME} characters or less.` });
    if (biographyHtml && biographyHtml.length > MAX_BIO)
      return res.status(400).json({ error: `Biography must be ${MAX_BIO} characters or less.` });

    const bd = birthDate || null;
    const dd = deathDate || null;
    const by = bd ? new Date(bd).getFullYear() : (birthYear ? parseInt(birthYear) : null);
    const dy = dd ? new Date(dd).getFullYear() : (deathYear ? parseInt(deathYear) : null);

    const slug = await generateSlug(name.trim());

    const albumType    = type || 'memorial';
    const weddingDate  = req.body.weddingDate  || null;
    const partner1Name = req.body.partner1Name || null;
    const partner2Name = req.body.partner2Name || null;
    const venueName    = req.body.venueName    || null;
    const collectionId = req.body.collectionId || null;
    const albumLabel   = req.body.albumLabel   || null;

    const result = await db.query(
      `INSERT INTO albums
         (user_id, name, slug, birth_year, death_year, birth_date, death_date, biography, type,
          wedding_date, partner1_name, partner2_name, venue_name, collection_id, album_label,
          allow_public_wishes, allow_public_tributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [req.userId, name.trim(), slug, by, dy, bd, dd, biographyHtml || null, albumType,
       weddingDate, partner1Name, partner2Name, venueName, collectionId, albumLabel,
       albumType === 'wedding', false]
    );
    const album = result.rows[0];

    const userRes = await db.query('SELECT name, email FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows[0])
      emailService.sendAlbumCreated({ ...userRes.rows[0], id: req.userId }, album).catch(console.error);

    res.status(201).json({ album });
  } catch (err) { next(err); }
};

// ── LIST USER'S OWN ALBUMS ────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*,
         (SELECT COUNT(*) FROM media m WHERE m.album_id = a.id AND m.type != 'tribute') AS media_count,
         (SELECT COUNT(*) FROM media m WHERE m.album_id = a.id AND m.type = 'tribute')  AS tribute_count
       FROM albums a
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [req.userId]
    );
    res.json({ albums: result.rows });
  } catch (err) { next(err); }
};

// ── LIST CLAIMED ALBUMS (client access) ───────────────────────
exports.listClaimed = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.*,
         (SELECT COUNT(*) FROM media m WHERE m.album_id = a.id AND m.type != 'tribute') AS media_count,
         aca.role AS client_role
       FROM album_client_access aca
       JOIN albums a ON a.id = aca.album_id
       WHERE aca.user_id = $1
       ORDER BY aca.granted_at DESC`,
      [req.userId]
    );
    res.json({ albums: result.rows });
  } catch (err) { next(err); }
};

// ── GET SINGLE ALBUM ──────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId);
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    res.json({ album });
  } catch (err) { next(err); }
};

// ── UPDATE ALBUM ──────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { name, birthDate, deathDate, birthYear, deathYear, biography,
            isPublished, avatarKey, coverKey, allowPublicTributes, allowPublicWishes } = req.body;
    const biographyHtml = biography !== undefined ? sanitizeBiographyHtml(biography) : undefined;

    if (name !== undefined && name.trim().length > MAX_NAME)
      return res.status(400).json({ error: `Album name must be ${MAX_NAME} characters or less.` });
    if (biography !== undefined && biographyHtml && biographyHtml.length > MAX_BIO)
      return res.status(400).json({ error: `Biography must be ${MAX_BIO} characters or less.` });

    const bd = birthDate !== undefined ? (birthDate || null) : undefined;
    const dd = deathDate !== undefined ? (deathDate || null) : undefined;
    const by = bd !== undefined
      ? (bd ? new Date(bd).getFullYear() : null)
      : (birthYear !== undefined ? (birthYear ? parseInt(birthYear) : null) : undefined);
    const dy = dd !== undefined
      ? (dd ? new Date(dd).getFullYear() : null)
      : (deathYear !== undefined ? (deathYear ? parseInt(deathYear) : null) : undefined);

    const publishValue = isPublished !== undefined
      ? (isPublished === true || isPublished === 'true' || isPublished === '1' || isPublished === 1)
      : undefined;

    const avatarKeyValue = 'avatarKey' in req.body ? req.body.avatarKey : undefined;
    const coverKeyValue  = 'coverKey'  in req.body ? req.body.coverKey  : undefined;

    const setParts = ['updated_at = NOW()'];
    const params   = [];
    let   pi       = 1;
    const add = (col, val) => { setParts.push(col + ' = $' + pi++); params.push(val); };

    if (name      !== undefined) add('name',         name.trim() || null);
    if (by        !== undefined) add('birth_year',   by);
    if (dy        !== undefined) add('death_year',   dy);
    if (bd        !== undefined) add('birth_date',   bd);
    if (dd        !== undefined) add('death_date',   dd);
    if (biography !== undefined) add('biography',    biographyHtml || null);
    if (publishValue !== undefined) add('is_published', publishValue);
    if (allowPublicTributes !== undefined) add('allow_public_tributes', Boolean(allowPublicTributes));
    if (allowPublicWishes   !== undefined) add('allow_public_wishes',   Boolean(allowPublicWishes));
    if (avatarKeyValue !== undefined) add('avatar_key', avatarKeyValue);
    if (coverKeyValue  !== undefined) add('cover_key',  coverKeyValue);

    const weddingFields = {
      wedding_date:  req.body.weddingDate  !== undefined ? (req.body.weddingDate  || null) : undefined,
      partner1_name: req.body.partner1Name !== undefined ? (req.body.partner1Name || null) : undefined,
      partner2_name: req.body.partner2Name !== undefined ? (req.body.partner2Name || null) : undefined,
      venue_name:    req.body.venueName    !== undefined ? (req.body.venueName    || null) : undefined,
      album_label:   req.body.albumLabel   !== undefined ? (req.body.albumLabel   || null) : undefined,
      collection_id: req.body.collectionId !== undefined ? (req.body.collectionId || null) : undefined,
    };
    for (const [col, val] of Object.entries(weddingFields)) {
      if (val !== undefined) add(col, val);
    }

    if (setParts.length === 1) {
      const cur = await getAlbumWithAccess(req.params.id, req.userId);
      if (!cur) return res.status(404).json({ error: 'Album not found.' });
      return res.json({ album: cur });
    }

    // Verify access (owner OR client_editor)
    const accessCheck = await getAlbumWithAccess(req.params.id, req.userId, 'client_editor');
    if (!accessCheck) return res.status(404).json({ error: 'Album not found.' });

    params.push(req.params.id);
    const query = 'UPDATE albums SET ' + setParts.join(', ') + ' WHERE id = $' + pi + ' RETURNING *';

    const result = await db.query(query, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Album not found.' });

    if (publishValue === true && result.rows[0].is_published) {
      const ownerRes = await db.query('SELECT name FROM users WHERE id = $1', [result.rows[0].user_id]);
      push.notify.albumPublished(result.rows[0].name, ownerRes.rows[0]?.name || 'Unknown').catch(() => {});
    }

    const userRes = await db.query('SELECT name, email FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows[0]) {
      emailService.sendAlbumUpdated({ ...userRes.rows[0], id: req.userId }, result.rows[0]).catch(console.error);
    }

    res.json({ album: result.rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE ALBUM ──────────────────────────────────────────────
// Only album owner can delete (not clients)
exports.delete = async (req, res, next) => {
  try {
    const albumCheck = await db.query(
      'SELECT id, name, avatar_key, cover_key, background_music_key FROM albums WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (!albumCheck.rows.length) return res.status(404).json({ error: 'Album not found.' });

    const media = await db.query(
      'SELECT r2_key FROM media WHERE album_id = $1 AND r2_key IS NOT NULL', [req.params.id]
    );
    await Promise.allSettled(media.rows.map(m => r2.deleteFile(m.r2_key)));

    const { avatar_key, cover_key, background_music_key } = albumCheck.rows[0];
    if (avatar_key)           await r2.deleteFile(avatar_key).catch(() => {});
    if (cover_key)            await r2.deleteFile(cover_key).catch(() => {});
    if (background_music_key) await r2.deleteFile(background_music_key).catch(() => {});

    await db.query('DELETE FROM albums WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);

    const userRes = await db.query('SELECT name, email FROM users WHERE id = $1', [req.userId]);
    if (userRes.rows[0]) {
      emailService.sendAlbumDeleted(
        { ...userRes.rows[0], id: req.userId }, albumCheck.rows[0].name
      ).catch(console.error);
    }
    res.json({ message: 'Album deleted successfully.' });
  } catch (err) { next(err); }
};

// ── GENERATE QR CODE ──────────────────────────────────────────
exports.getQR = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId);
    if (!album) return res.status(404).json({ error: 'Album not found.' });

    const albumUrl = process.env.APP_URL + '/album/' + album.slug;
    const format   = req.query.format === 'svg' ? 'svg' : 'png';

    if (format === 'svg') {
      const svg = await QRCode.toString(albumUrl, {
        type: 'svg', color: { dark: '#F4F4F4', light: '#1A1A1A' }, margin: 2, width: 300,
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="' + album.slug + '-qr.svg"');
      return res.send(svg);
    }

    const buffer = await QRCode.toBuffer(albumUrl, {
      type: 'png', color: { dark: '#F4F4F4', light: '#1A1A1A' },
      margin: 2, width: 600, errorCorrectionLevel: 'H',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="' + album.slug + '-qr.png"');
    res.send(buffer);
  } catch (err) { next(err); }
};

// ── UPLOAD AVATAR ─────────────────────────────────────────────
exports.uploadAvatar = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId, 'client_editor');
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    if (album.avatar_key) r2.deleteFile(album.avatar_key).catch(() => {});

    const { key, url } = await r2.uploadFile({
      buffer: req.file.buffer, mimetype: req.file.mimetype,
      originalname: req.file.originalname, albumId: req.params.id, type: 'photo',
    });

    await db.query('UPDATE albums SET avatar_key = $1 WHERE id = $2', [key, req.params.id]);
    res.json({ avatarUrl: url, avatarKey: key });
  } catch (err) { next(err); }
};

// ── UPLOAD COVER ──────────────────────────────────────────────
exports.uploadCover = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId, 'client_editor');
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    if (album.cover_key) r2.deleteFile(album.cover_key).catch(() => {});

    const { key, url } = await r2.uploadFile({
      buffer: req.file.buffer, mimetype: req.file.mimetype,
      originalname: req.file.originalname, albumId: req.params.id, type: 'photo',
    });

    await db.query('UPDATE albums SET cover_key = $1 WHERE id = $2', [key, req.params.id]);
    res.json({ coverUrl: url, coverKey: key });
  } catch (err) { next(err); }
};

// ── ALBUM HEALTH SCORE ────────────────────────────────────────
exports.healthScore = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId);
    if (!album) return res.status(404).json({ error: 'Album not found.' });

    const mediaRes = await db.query('SELECT type FROM media WHERE album_id = $1', [req.params.id]);
    const media = mediaRes.rows;

    const checks = [
      { id: 'cover',     label: 'Add a cover photo',      done: !!album.cover_key },
      { id: 'avatar',    label: 'Add a profile photo',     done: !!album.avatar_key },
      { id: 'bio',       label: 'Write a biography',       done: !!(album.biography && album.biography.length > 50) },
      { id: 'dates',     label: 'Add birth & death dates', done: !!(album.birth_date && album.death_date) },
      { id: 'photos',    label: 'Upload at least 5 photos',done: media.filter(m => m.type === 'photo').length >= 5 },
      { id: 'published', label: 'Publish your album',      done: !!album.is_published },
      { id: 'tribute',   label: 'Add a tribute message',   done: media.some(m => m.type === 'tribute') },
    ];

    res.json({ score: Math.round((checks.filter(c => c.done).length / checks.length) * 100), checks });
  } catch (err) { next(err); }
};

// ── UPDATE ALBUM THEME ────────────────────────────────────────
const VALID_ALBUM_THEMES  = [...MEMORIAL_THEME_IDS, ...WEDDING_THEME_IDS];
const VALID_PLAQUE_THEMES = ['classic', 'dark', 'floral', 'traditional', 'minimal'];
const VALID_LANGUAGES     = ['en','hi','ta','te','kn','ml','mr','gu','bn','pa','ur','or','as'];

exports.updateTheme = async (req, res, next) => {
  try {
    const { theme, language } = req.body;
    // Theme changes use the plan context (needs plan-based check)
    const context = await getAlbumPlanContext(req.userId, req.params.id);
    if (!context) {
      // Client editors can still change theme — use simpler access check
      const album = await getAlbumWithAccess(req.params.id, req.userId, 'client_editor');
      if (!album) return res.status(404).json({ error: 'Album not found.' });
      if (theme && !VALID_ALBUM_THEMES.includes(theme))
        return res.status(400).json({ error: 'Invalid theme.' });
      if (language && !VALID_LANGUAGES.includes(language))
        return res.status(400).json({ error: 'Invalid language code.' });
      const r = await db.query(
        'UPDATE albums SET theme = COALESCE($1,theme), language = COALESCE($2,language) WHERE id = $3 RETURNING id,theme,language',
        [theme||null, language||null, req.params.id]
      );
      return res.json({ album: r.rows[0] });
    }

    if (theme && !VALID_ALBUM_THEMES.includes(theme))
      return res.status(400).json({ error: 'Invalid theme. Choose from: ' + VALID_ALBUM_THEMES.join(', ') });
    if (language && !VALID_LANGUAGES.includes(language))
      return res.status(400).json({ error: 'Invalid language code. Supported: ' + VALID_LANGUAGES.join(', ') });
    if (theme && !context.allowedThemes.includes(theme)) {
      return res.status(403).json({
        error: context.canChangeTheme
          ? 'This theme is not available for the current album type.'
          : 'Your current plan does not allow changing album themes. Upgrade to unlock more themes.',
      });
    }

    const result = await db.query(
      'UPDATE albums SET theme = COALESCE($1,theme), language = COALESCE($2,language) WHERE id = $3 AND user_id = $4 RETURNING id, theme, language',
      [theme||null, language||null, req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Album not found.' });
    res.json({ album: result.rows[0] });
  } catch (err) { next(err); }
};

// ── UPLOAD BACKGROUND MUSIC ───────────────────────────────────
exports.uploadMusic = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId, 'client_editor');
    if (!album) return res.status(404).json({ error: 'Album not found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    if (album.background_music_key) r2.deleteFile(album.background_music_key).catch(() => {});

    const { key, url } = await r2.uploadFile({
      buffer: req.file.buffer, mimetype: req.file.mimetype,
      originalname: req.file.originalname, albumId: req.params.id, type: 'audio',
    });

    await db.query(
      'UPDATE albums SET background_music_key = $1, background_music_name = $2 WHERE id = $3',
      [key, req.file.originalname, req.params.id]
    );
    res.json({ musicUrl: url, musicKey: key, musicName: req.file.originalname });
  } catch (err) { next(err); }
};

// ── DELETE BACKGROUND MUSIC ───────────────────────────────────
exports.deleteMusic = async (req, res, next) => {
  try {
    const album = await getAlbumWithAccess(req.params.id, req.userId, 'client_editor');
    if (!album) return res.status(404).json({ error: 'Album not found.' });

    if (album.background_music_key) r2.deleteFile(album.background_music_key).catch(() => {});

    await db.query(
      'UPDATE albums SET background_music_key = NULL, background_music_name = NULL WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Background music removed.' });
  } catch (err) { next(err); }
};

// ── SET ALBUM PASSWORD ────────────────────────────────────────
// Only owner can set/remove album password
exports.setPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const albumCheck = await db.query(
      'SELECT id FROM albums WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]
    );
    if (!albumCheck.rows.length) return res.status(404).json({ error: 'Album not found.' });

    if (!password) {
      await db.query(
        'UPDATE albums SET is_password_protected = FALSE, password_hash = NULL WHERE id = $1',
        [req.params.id]
      );
      return res.json({ message: 'Album password removed. Album is now public.' });
    }

    if (password.length < 4 || password.length > 50)
      return res.status(400).json({ error: 'Password must be 4-50 characters.' });

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE albums SET is_password_protected = TRUE, password_hash = $1 WHERE id = $2',
      [hash, req.params.id]
    );
    res.json({ message: 'Album password set. Visitors will need to enter the password.' });
  } catch (err) { next(err); }
};

// ── SET ALBUM HEIR ────────────────────────────────────────────
// Only owner can set heir
exports.setHeir = async (req, res, next) => {
  try {
    const { heirEmail } = req.body;
    const albumCheck = await db.query(
      'SELECT id FROM albums WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]
    );
    if (!albumCheck.rows.length) return res.status(404).json({ error: 'Album not found.' });

    const email = heirEmail ? heirEmail.toLowerCase().trim() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email address.' });

    await db.query('UPDATE albums SET heir_email = $1 WHERE id = $2', [email, req.params.id]);
    res.json({ message: email ? 'Heir set to ' + email + '.' : 'Heir removed.' });
  } catch (err) { next(err); }
};

// ── SET NFC UID ───────────────────────────────────────────────
exports.setNfc = async (req, res, next) => {
  try {
    const { nfcUid } = req.body;
    const context = await getAlbumPlanContext(req.userId, req.params.id);
    if (!context) return res.status(404).json({ error: 'Album not found.' });
    if (!context.canUseNfc) {
      return res.status(403).json({
        error: 'NFC linking is not included in your current plan. Upgrade to unlock NFC support.',
      });
    }

    if (nfcUid) {
      if (typeof nfcUid !== 'string' || nfcUid.length > 50)
        return res.status(400).json({ error: 'NFC UID must be a string of at most 50 characters.' });
      if (!/^[A-Fa-f0-9:]+$/.test(nfcUid.trim()))
        return res.status(400).json({ error: 'NFC UID must contain only hex characters (0-9, A-F) and optional colons.' });
    }

    const uid = nfcUid ? nfcUid.trim().toUpperCase() : null;
    await db.query('UPDATE albums SET nfc_uid = $1 WHERE id = $2', [uid, req.params.id]);
    res.json({ message: uid ? 'NFC UID registered.' : 'NFC UID removed.' });
  } catch (err) { next(err); }
};

// ── DOWNLOAD QR PLAQUE ────────────────────────────────────────
exports.downloadPlaque = async (req, res, next) => {
  try {
    const format = ['png', 'pdf'].includes(req.query.format) ? req.query.format : 'png';
    const theme  = VALID_PLAQUE_THEMES.includes(req.query.theme) ? req.query.theme : 'classic';

    // getAlbumPlanContext checks user_id ownership; allow client_editor too
    let context = await getAlbumPlanContext(req.userId, req.params.id);
    if (!context) {
      const album = await getAlbumWithAccess(req.params.id, req.userId);
      if (!album) return res.status(404).json({ error: 'Album not found.' });
      // Clients can download plaque (no plan check needed for clients)
      const albumUrl = process.env.APP_URL + '/album/' + album.slug;
      const dates    = plaqueService.formatDates(album.birth_date, album.death_date, album.birth_year, album.death_year);
      if (format === 'pdf') {
        const pdf = await plaqueService.generatePlaquePDF({ albumUrl, name: album.name, dates, theme });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="' + album.slug + '-plaque.pdf"');
        return res.send(pdf);
      }
      const png = await plaqueService.generatePlaquePNG({ albumUrl, name: album.name, dates, theme });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'attachment; filename="' + album.slug + '-plaque.png"');
      return res.send(png);
    }

    if (!context.canDownloadPlaque) {
      return res.status(403).json({
        error: 'Plaque downloads are not included in your current plan. Upgrade to unlock print-ready plaque exports.',
      });
    }

    const album    = context.album;
    const albumUrl = process.env.APP_URL + '/album/' + album.slug;
    const dates    = plaqueService.formatDates(album.birth_date, album.death_date, album.birth_year, album.death_year);

    if (format === 'pdf') {
      const pdf = await plaqueService.generatePlaquePDF({ albumUrl, name: album.name, dates, theme });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + album.slug + '-plaque.pdf"');
      return res.send(pdf);
    }

    const png = await plaqueService.generatePlaquePNG({ albumUrl, name: album.name, dates, theme });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="' + album.slug + '-plaque.png"');
    res.send(png);
  } catch (err) { next(err); }
};
