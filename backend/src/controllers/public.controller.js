const db      = require('../utils/db');
const bcrypt  = require('bcryptjs');
const { recordView } = require('./analytics.controller');
const r2 = require('../services/r2.service');
const { sanitizeBiographyHtml } = require('../utils/content-sanitizer');
const { getPublicAccessState } = require('../utils/public-access');

// Lightweight HTML sanitizer — strips dangerous tags/attributes before public render
// Allows: b, i, u, em, strong, p, br, ul, ol, li — blocks: script, iframe, on*, href=javascript:
function sanitizeBiography(html) {
  if (!html) return '';
  return html
    // Remove script, style, iframe, object, embed tags (and their content)
    .replace(/<(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remove all event handler attributes (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: hrefs
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
    // Remove data: URIs (potential XSS vector)
    .replace(/src\s*=\s*["']?\s*data:[^"'\s>]*/gi, '')
    // Trim
    .trim();
}

// Plain-text escape for non-HTML fields
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── GET PUBLIC ALBUM BY SLUG ──────────────────────────────────
exports.getAlbum = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Basic slug validation — alphanumeric + hyphens only
    if (!/^[a-z0-9-]+$/.test(slug))
      return res.status(404).json({ error: 'Album not found.' });

    // Demo album — always available
    if (slug === 'demo') {
      return res.json({
        album: {
          name: 'Margaret Rose Chen',
          slug: 'demo',
          birthDate: '1950-03-15',
          deathDate: '2024-11-20',
          biography: '<p>Margaret was a loving mother, grandmother, and friend to all who knew her. Her warmth and kindness touched every life she encountered.</p><p>She loved gardening, cooking, and spending time with her family. Her legacy lives on through the many lives she touched.</p>',
          avatarUrl: null,
          coverUrl: null,
          viewCount: 0,
          createdAt: new Date().toISOString(),
        },
        media: {
          photos: [],
          videos: [],
          audio: [],
          tributes: [
            { id: '1', tribute_text: 'Margaret was the most wonderful mother anyone could ask for. Her love was unconditional and her wisdom priceless.', tribute_from: 'Robert Chen (Son)', display_order: 1 },
            { id: '2', tribute_text: 'A true angel on earth. Grandma Margaret taught me the value of kindness and patience.', tribute_from: 'Emily (Granddaughter)', display_order: 2 },
          ],
        },
      });
    }

    const albumRes = await db.query(
      `SELECT a.*, u.subscription_status, u.grace_period_until,
              COALESCE(a.allow_public_tributes, false) AS allow_public_tributes,
              COALESCE(a.allow_public_wishes, false) AS allow_public_wishes,
              s.name AS studio_name
       FROM albums a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN studios s ON s.id = a.studio_id
       WHERE a.slug = $1 AND a.is_published = TRUE`,
      [slug]
    );

    if (!albumRes.rows.length)
      return res.status(404).json({ error: 'Album not found or not yet published.' });

    const album = albumRes.rows[0];

    // Allow access if: active/trialing OR within grace period
    const access = await getPublicAccessState({
      ownerStatus: album.subscription_status,
      ownerGracePeriodUntil: album.grace_period_until,
      studioId: album.studio_id,
    });
    if (!access.hasAccess)
      return res.status(403).json({ error: 'This album is currently unavailable.' });

    // Get media — only public-safe fields
    const mediaRes = await db.query(
      `SELECT id, type, file_name, mime_type, duration_sec,
              tribute_text, tribute_from, caption,
              display_order, created_at,
         CASE WHEN r2_key IS NOT NULL
           THEN CONCAT($1::text, '/', r2_key) ELSE NULL END AS url
       FROM media WHERE album_id = $2
       ORDER BY display_order, created_at`,
      [process.env.R2_PUBLIC_URL, album.id]
    );

    const grouped = { photos: [], videos: [], audio: [], tributes: [] };
    for (const m of mediaRes.rows) {
      if (m.type === 'photo')   grouped.photos.push(m);
      if (m.type === 'video')   grouped.videos.push(m);
      if (m.type === 'audio')   grouped.audio.push(m);
      if (m.type === 'tribute') grouped.tributes.push({
        ...m,
        tribute_text: escapeHtml(m.tribute_text),
        tribute_from: escapeHtml(m.tribute_from),
      });
    }

    // Fetch life events for public display
    const eventsRes = await db.query(
      `SELECT id, title, description, event_date, event_year, icon, display_order
       FROM life_events WHERE album_id = $1
       ORDER BY event_date ASC NULLS LAST, display_order ASC`,
      [album.id]
    );

    // Fetch approved guest wishes / tributes (works for both wedding and memorial)
    const wishesRes = await db.query(
      `SELECT id, guest_name, message, video_key, created_at,
              COALESCE(tribute_type, 'wish') AS tribute_type
       FROM guest_wishes
       WHERE album_id = $1 AND status = 'approved'
       ORDER BY created_at ASC`,
      [album.id]
    );

    const wishes = wishesRes.rows.map(w => ({
      ...w,
      guest_name: escapeHtml(w.guest_name),
      message:    escapeHtml(w.message),
      videoUrl:   w.video_key ? r2.getPublicUrl(w.video_key) : null,
    }));

    res.json({
      album: {
        name:         album.name,
        slug:         album.slug,
        type:         album.type         || 'memorial',
        theme:        album.theme        || 'classic',
        // Memorial fields
        birthDate:    album.birth_date   || null,
        deathDate:    album.death_date   || null,
        birthYear:    album.birth_year   || null,
        deathYear:    album.death_year   || null,
        biography:    sanitizeBiographyHtml(album.biography),
        // Wedding fields
        weddingDate:  album.wedding_date  || null,
        partner1Name: album.partner1_name || null,
        partner2Name: album.partner2_name || null,
        venueName:    album.venue_name    || null,
        albumLabel:   album.album_label   || null,
        // Media
        avatarUrl:    r2.getPublicUrl(album.avatar_key),
        coverUrl:     r2.getPublicUrl(album.cover_key),
        viewCount:    album.view_count,
        createdAt:    album.created_at,
        // Grace period info
        gracePeriodUntil:   album.grace_period_until || null,
        allowPublicTributes: album.allow_public_tributes || false,
        allowPublicWishes:   album.allow_public_wishes   || false,
        // Photographer custom theme config (merged over preset theme on frontend)
        customConfig: album.custom_theme_config || {},
        // Studio branding
        studioName:   album.studio_name || null,
      },
      media:       grouped,
      lifeEvents:  eventsRes.rows,
      guestWishes: wishes,
    });

    // Fire-and-forget: record view AFTER response is sent so it never blocks the page load
    recordView({
      albumId:   album.id,
      ip:        req.ip,
      userAgent: req.headers['user-agent'] || '',
      referrer:  req.headers['referer']    || '',
    });
  } catch (err) { next(err); }
};

// ── VERIFY ALBUM PASSWORD (public) ───────────────────────────
exports.verifyAlbumPassword = async (req, res, next) => {
  try {
    const { slug } = req.params;
    // Validate slug format before DB query
    if (!/^[a-z0-9-]+$/.test(slug))
      return res.status(404).json({ error: 'Album not found.' });

    const { password } = req.body;
    const result = await db.query(
      'SELECT id, is_password_protected, password_hash FROM albums WHERE slug = $1',
      [slug]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Album not found.' });

    const album = result.rows[0];
    if (!album.is_password_protected)
      return res.json({ valid: true, message: 'Album is not password protected.' });
    if (!password)
      return res.status(400).json({ error: 'Password required.' });

    const match = await bcrypt.compare(password, album.password_hash);
    if (!match) return res.status(401).json({ valid: false, error: 'Incorrect password.' });

    res.json({ valid: true });
  } catch (err) { next(err); }
};

// ── GET WEDDING COLLECTION ───────────────────────────────────────
// Gets all wedding albums for a user, with their general settings.
//
// SECURITY FIXES vs original:
//   1. Subscription/grace-period check — expired accounts return 403.
//      Original served media for any account regardless of subscription status.
//   2. Per-album password gate — password-protected albums return metadata only;
//      photos/videos are stripped. Frontend should show a lock icon + link to
//      the individual /album/:slug page where the password flow lives.
//   3. Error handling uses next(err) — original leaked raw DB error messages to
//      the public in production via res.status(500).json({ error: err.message }).
exports.getWeddingCollection = async (req, res, next) => {
  const { slug } = req.params;

  try {
    console.log('[WEDDING] Getting collection for slug:', slug);

    // ── 1. Resolve user from wedding_slug or album slug ──────────
    let userId    = null;
    let albumUser = null;

    // Include subscription fields needed for the gate check below
    const userBySlug = await db.query(
      `SELECT id, name, email, subscription_status, grace_period_until
       FROM users WHERE wedding_slug = $1`,
      [slug]
    );

    if (userBySlug.rows.length > 0) {
      userId    = userBySlug.rows[0].id;
      albumUser = userBySlug.rows[0];
      console.log('[WEDDING] Found by wedding_slug, userId:', userId);
    } else {
      const albumResult = await db.query(
        `SELECT a.*, u.name AS user_name, u.email,
                u.subscription_status, u.grace_period_until
         FROM albums a
         JOIN users u ON a.user_id = u.id
         WHERE a.slug = $1 AND a.type = 'wedding'`,
        [slug]
      );

      if (!albumResult.rows.length) {
        console.log('[WEDDING] Album not found for slug:', slug);
        return res.status(404).json({ error: 'Wedding collection not found.' });
      }

      userId    = albumResult.rows[0].user_id;
      albumUser = albumResult.rows[0];
      console.log('[WEDDING] Found by album slug, userId:', userId);
    }

    // ── 2. Subscription / grace-period gate (FIX: was missing) ──
    // Mirror the same logic used in getAlbum so wedding collections
    // are protected the same way individual memorial albums are.
    const access = await getPublicAccessState({
      ownerStatus: albumUser.subscription_status,
      ownerGracePeriodUntil: albumUser.grace_period_until,
      studioId: albumUser.studio_id || null,
    });
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'This wedding collection is currently unavailable.' });
    }

    const r2Url = process.env.R2_PUBLIC_URL || 'https://cdn.hriatrengna.in';

    // ── 3. Fetch all wedding albums — strip media for password-locked ones ──
    // CASE expressions in the subqueries return an empty array for any album
    // where is_password_protected = TRUE, so photos/videos never leave the
    // server for locked albums. The frontend receives isPasswordProtected:true
    // and should render a lock state with a link to /album/:slug.
    const albumsResult = await db.query(
      `SELECT a.*,
        CASE WHEN a.is_password_protected = TRUE
          THEN '[]'::json
          ELSE COALESCE(
            (SELECT json_agg(json_build_object(
              'id', m.id,
              'type', m.type,
              'url', $1 || '/' || m.r2_key,
              'file_name', m.file_name,
              'caption', m.caption
            )) FROM media m
             WHERE m.album_id = a.id AND m.type = 'photo' AND m.r2_key IS NOT NULL),
            '[]'::json)
        END AS photos,
        CASE WHEN a.is_password_protected = TRUE
          THEN '[]'::json
          ELSE COALESCE(
            (SELECT json_agg(json_build_object(
              'id', m.id,
              'type', m.type,
              'url', $1 || '/' || m.r2_key,
              'file_name', m.file_name,
              'caption', m.caption
            )) FROM media m
             WHERE m.album_id = a.id AND m.type = 'video' AND m.r2_key IS NOT NULL),
            '[]'::json)
        END AS videos
       FROM albums a
       WHERE a.user_id = $2 AND a.type = 'wedding'
       ORDER BY a.album_label, a.created_at`,
      [r2Url, userId]
    );

    // ── 4. User profile ──────────────────────────────────────────
    let userProfile = {
      partner1_name: albumUser.name || '',
      partner2_name: '',
      wedding_date:  null,
      venue:         '',
      biography:     '',
      profile_photo: '',
      cover_photo:   '',
    };

    try {
      const userResult = await db.query(
        `SELECT
          COALESCE(partner1_name, '') AS partner1_name,
          COALESCE(partner2_name, '') AS partner2_name,
          wedding_date,
          COALESCE(venue_name, '')    AS venue_name,
          COALESCE(biography, '')     AS biography,
          COALESCE(profile_photo, '') AS profile_photo,
          COALESCE(cover_photo, '')   AS cover_photo
         FROM users WHERE id = $1`,
        [userId]
      );
      if (userResult.rows.length > 0) {
        const u = userResult.rows[0];
        userProfile = {
          partner1_name: u.partner1_name || albumUser.name || '',
          partner2_name: u.partner2_name || '',
          wedding_date:  u.wedding_date,
          venue:         u.venue_name || '',
          biography:     u.biography  || '',
          profile_photo: u.profile_photo || '',
          cover_photo:   u.cover_photo   || '',
        };
      }
    } catch (profileErr) {
      console.log('[WEDDING] Profile fetch error:', profileErr.message);
    }

    // ── 5. Shape response ────────────────────────────────────────
    const albums = albumsResult.rows.map(album => ({
      id:                    album.id,
      name:                  album.name,
      slug:                  album.slug,
      album_label:           album.album_label,
      cover_key:             album.cover_key,
      avatar_key:            album.avatar_key,
      allow_public_tributes: album.allow_public_tributes,
      allow_public_wishes:   album.allow_public_wishes,
      // FIX: expose lock status so the frontend can show a lock icon
      isPasswordProtected:   album.is_password_protected || false,
      // custom theme from photographer
      custom_theme_config:   album.custom_theme_config || {},
      media: {
        // Empty arrays for password-protected albums (stripped by SQL CASE above)
        photos: album.photos || [],
        videos: album.videos || [],
      },
    }));

    console.log('[WEDDING] Returning', albums.length, 'albums');

    res.json({
      user:   userProfile,
      albums: albums,
    });

  } catch (err) {
    // FIX: use next(err) — original leaked raw DB messages to public in production
    console.error('[WEDDING] Error:', err);
    next(err);
  }
};
