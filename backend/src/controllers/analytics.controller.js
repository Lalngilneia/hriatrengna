'use strict';
const db = require('../utils/db');

// ── RECORD A VIEW (called from public.controller) ─────────────
// This is called internally, not as a route handler
async function recordView({ albumId, ip, userAgent, referrer }) {
  try {
    const device = detectDevice(userAgent);
    const ref    = categoriseReferrer(referrer);
    await db.query(
      `INSERT INTO album_views (album_id, visitor_ip, device, referrer)
       VALUES ($1, $2, $3, $4)`,
      [albumId, ip || null, device, ref]
    );
    // Also increment legacy view_count counter
    await db.query(
      'UPDATE albums SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1',
      [albumId]
    );
  } catch (err) {
    console.error('[ANALYTICS] recordView failed:', err.message);
    // Never block album page load
  }
}

// ── GET ANALYTICS FOR ALBUM OWNER ────────────────────────────
exports.getAlbumAnalytics = async (req, res, next) => {
  try {
    const albumCheck = await db.query(
      'SELECT id, view_count FROM albums WHERE id = $1 AND user_id = $2',
      [req.params.albumId, req.userId]
    );
    if (!albumCheck.rows.length)
      return res.status(404).json({ error: 'Album not found.' });

    const [summary, byDay, byDevice, byReferrer] = await Promise.all([
      // Total + periods
      db.query(`
        SELECT
          COUNT(*)                                                              AS total_views,
          COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '7 days')        AS views_7d,
          COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '30 days')       AS views_30d,
          COUNT(*) FILTER (WHERE viewed_at::date = CURRENT_DATE)               AS views_today,
          COUNT(DISTINCT visitor_ip)                                            AS unique_visitors
        FROM album_views WHERE album_id = $1
      `, [req.params.albumId]),

      // Daily views last 30 days
      db.query(`
        SELECT viewed_at::date AS date, COUNT(*) AS views
        FROM album_views
        WHERE album_id = $1 AND viewed_at > NOW() - INTERVAL '30 days'
        GROUP BY viewed_at::date
        ORDER BY date
      `, [req.params.albumId]),

      // Device breakdown
      db.query(`
        SELECT device, COUNT(*) AS count
        FROM album_views WHERE album_id = $1
        GROUP BY device ORDER BY count DESC
      `, [req.params.albumId]),

      // Referrer breakdown
      db.query(`
        SELECT referrer, COUNT(*) AS count
        FROM album_views WHERE album_id = $1
        GROUP BY referrer ORDER BY count DESC
      `, [req.params.albumId]),
    ]);

    res.json({
      summary:    summary.rows[0],
      byDay:      byDay.rows,
      byDevice:   byDevice.rows,
      byReferrer: byReferrer.rows,
    });
  } catch (err) { next(err); }
};

// ── HELPERS ───────────────────────────────────────────────────
function detectDevice(ua = '') {
  if (!ua) return 'unknown';
  const u = ua.toLowerCase();
  if (u.includes('mobile') || u.includes('android') || u.includes('iphone')) return 'mobile';
  if (u.includes('tablet') || u.includes('ipad')) return 'tablet';
  return 'desktop';
}

function categoriseReferrer(ref = '') {
  if (!ref) return 'direct';
  const r = ref.toLowerCase();
  if (r.includes('whatsapp'))  return 'whatsapp';
  if (r.includes('facebook'))  return 'facebook';
  if (r.includes('instagram')) return 'instagram';
  if (r.includes('google'))    return 'google';
  if (r.includes('twitter') || r.includes('x.com')) return 'twitter';
  return 'other';
}

module.exports = { recordView, getAlbumAnalytics: exports.getAlbumAnalytics };
