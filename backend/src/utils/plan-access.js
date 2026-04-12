'use strict';
/**
 * plan-access.js
 *
 * Determines subscription limits and feature access for a user.
 *
 * Supports two subscription models:
 *
 *  1. LEGACY — old fixed-tier plans (memorial-basic, yearly, etc.)
 *     Still active for existing subscribers. Uses hardcoded maps
 *     as fallback so old accounts never break.
 *
 *  2. CUSTOM — new configurable plans (memorial-custom, wedding-custom)
 *     Reads limits from subscription_configs table via pricing-engine.
 *     Admin overrides in subscription_configs take precedence.
 *
 * All callers use the same public API:
 *   getPlanContextForType(userId, planType) → context object
 *   getAlbumPlanContext(userId, albumId)    → context + album
 *
 * Do NOT add pricing math here — that lives in pricing-engine.js.
 */

const db = require('./db');
const {
  CUSTOM_SLUG,
  getEffectiveLimits,
  getEffectiveExpiry,
} = require('./pricing-engine');

// ── Theme lists ───────────────────────────────────────────────

const MEMORIAL_THEME_IDS = [
  'classic',
  'warm-sepia',
  'dark-memorial',
  'nature',
  'minimal-white',
];

const WEDDING_THEME_IDS = [
  'classic-romance',
  'garden-bloom',
  'golden-luxe',
  'coastal-breeze',
  'modern-minimal',
  'rustic-charm',
];

// ── Legacy plan maps (kept for backward compatibility) ────────
// These apply only when plan_slug is NOT 'memorial-custom' or 'wedding-custom'.

const LEGACY_PLAN_LIMIT_DEFAULTS = {
  'memorial-basic':    { maxPhotos: 100,  maxVideos: 5,  maxAlbums: 1 },
  'memorial-standard': { maxPhotos: 200,  maxVideos: 10, maxAlbums: 1 },
  'memorial-premium':  { maxPhotos: 1000, maxVideos: 30, maxAlbums: 3 },
  'wedding-basic':     { maxPhotos: 100,  maxVideos: 5,  maxAlbums: 1 },
  'wedding-classic':   { maxPhotos: 200,  maxVideos: 20, maxAlbums: 3 },
  'wedding-premium':   { maxPhotos: 1000, maxVideos: 50, maxAlbums: 10 },
  monthly:             { maxPhotos: 200,  maxVideos: 10, maxAlbums: 1 },
  yearly:              { maxPhotos: 500,  maxVideos: 30, maxAlbums: 1 },
  lifetime:            { maxPhotos: 2000, maxVideos: 50, maxAlbums: 1 },
  // b2b: legacy business accounts created via admin panel before the studio system.
  // Treated as unlimited-quota so admin-created accounts never hit a wall.
  b2b:                 { maxPhotos: 9999, maxVideos: 999, maxAlbums: 999 },
};

const LEGACY_PLAN_ACCESS = {
  'memorial-basic': {
    canChangeTheme:   false,
    canUseNfc:        false,
    canDownloadPlaque: false,
    allowedThemes:    ['classic'],
    defaultTheme:     'classic',
  },
  'memorial-standard': {
    canChangeTheme:   true,
    canUseNfc:        false,
    canDownloadPlaque: true,
    allowedThemes:    MEMORIAL_THEME_IDS,
    defaultTheme:     'classic',
  },
  'memorial-premium': {
    canChangeTheme:   true,
    canUseNfc:        true,
    canDownloadPlaque: true,
    allowedThemes:    MEMORIAL_THEME_IDS,
    defaultTheme:     'classic',
  },
  'wedding-basic': {
    canChangeTheme:   false,
    canUseNfc:        false,
    canDownloadPlaque: false,
    allowedThemes:    ['classic-romance'],
    defaultTheme:     'classic-romance',
  },
  'wedding-classic': {
    canChangeTheme:   true,
    canUseNfc:        false,
    canDownloadPlaque: true,
    allowedThemes:    WEDDING_THEME_IDS,
    defaultTheme:     'classic-romance',
  },
  'wedding-premium': {
    canChangeTheme:   true,
    canUseNfc:        false,
    canDownloadPlaque: true,
    allowedThemes:    WEDDING_THEME_IDS,
    defaultTheme:     'classic-romance',
  },
  monthly: {
    canChangeTheme:   false,
    canUseNfc:        false,
    canDownloadPlaque: false,
    allowedThemes:    ['classic'],
    defaultTheme:     'classic',
  },
  yearly: {
    canChangeTheme:   true,
    canUseNfc:        false,
    canDownloadPlaque: true,
    allowedThemes:    MEMORIAL_THEME_IDS,
    defaultTheme:     'classic',
  },
  lifetime: {
    canChangeTheme:   true,
    canUseNfc:        true,
    canDownloadPlaque: true,
    allowedThemes:    MEMORIAL_THEME_IDS,
    defaultTheme:     'classic',
  },
  // b2b: legacy business accounts — grant full theme/plaque access
  b2b: {
    canChangeTheme:   true,
    canUseNfc:        false,
    canDownloadPlaque: true,
    allowedThemes:    [...MEMORIAL_THEME_IDS, ...WEDDING_THEME_IDS],
    defaultTheme:     'classic',
  },
};

// ── Helpers ───────────────────────────────────────────────────

const getPlanType = (slug, fallback = 'memorial') =>
  (slug || '').startsWith('wedding') ? 'wedding' : fallback;

const isCustomSlug = (slug) =>
  slug === CUSTOM_SLUG.memorial || slug === CUSTOM_SLUG.wedding;

// ── Legacy access resolver (unchanged from original) ──────────

function getLegacyPlanAccess(planSlug, planType = 'memorial') {
  const fallbackTheme  = planType === 'wedding' ? 'classic-romance' : 'classic';
  const fallbackThemes = planType === 'wedding' ? ['classic-romance'] : ['classic'];
  const access = LEGACY_PLAN_ACCESS[planSlug] || {};
  return {
    canChangeTheme:    Boolean(access.canChangeTheme),
    canUseNfc:         Boolean(access.canUseNfc),
    canDownloadPlaque: Boolean(access.canDownloadPlaque),
    allowedThemes:     access.allowedThemes || fallbackThemes,
    defaultTheme:      access.defaultTheme  || fallbackTheme,
  };
}

// ── Custom plan access resolver ───────────────────────────────

/**
 * Build access object for a custom subscription config.
 * NFC access is determined by whether the user has a paid
 * physical NFC order — not by the subscription itself.
 *
 * @param {Object} configRow  Row from subscription_configs (with effective limits applied)
 * @param {string} planType
 * @param {boolean} hasNfcOrder  TRUE if user has a paid physical_orders nfc_tag row
 * @returns {Object}
 */
function getCustomPlanAccess(configRow, planType, hasNfcOrder) {
  const limits      = getEffectiveLimits(configRow);
  const themeList   = planType === 'wedding' ? WEDDING_THEME_IDS : MEMORIAL_THEME_IDS;
  const defaultTheme = planType === 'wedding' ? 'classic-romance' : 'classic';

  return {
    canChangeTheme:    limits.themesEnabled,
    canUseNfc:         Boolean(hasNfcOrder),
    canDownloadPlaque: true,                // Always free for all custom plans
    allowedThemes:     limits.themesEnabled ? themeList : [defaultTheme],
    defaultTheme,
  };
}

// ── Active subscription fetcher ───────────────────────────────

/**
 * Returns the most recent active user_subscriptions row for a given type,
 * plus a roll-up across all active rows for album quota accounting.
 * Falls back to legacy users table columns for old accounts.
 *
 * @param {string} userId
 * @param {string} planType  'memorial' | 'wedding'
 * @returns {Promise<Object|null>}
 */
async function getActiveSubscriptionForType(userId, planType) {
  // ── New table lookup ───────────────────────────────────────
  const subRes = await db.query(
    `SELECT us.id, us.plan_slug, us.plan_type, us.status, us.album_quota,
            us.current_period_end, us.cancel_at_period_end, us.created_at,
            us.config_id, us.payment_mode,
            -- Pull config columns inline for custom plans
            sc.extra_photo_packs, sc.extra_video_packs,
            sc.audio_enabled, sc.themes_enabled,
            sc.total_photos, sc.total_videos,
            sc.override_photos, sc.override_videos,
            sc.override_audio, sc.override_themes,
            sc.override_expiry, sc.length_months
     FROM user_subscriptions us
     LEFT JOIN subscription_configs sc ON sc.id = us.config_id
     WHERE us.user_id = $1
       AND us.plan_type = $2
       AND us.status IN ('active', 'trialing')
     ORDER BY us.created_at DESC`,
    [userId, planType]
  );

  if (subRes.rows.length) {
    const latest = subRes.rows[0];
    const totalAlbumQuota = subRes.rows.reduce(
      (sum, row) => sum + (parseInt(row.album_quota, 10) || 1),
      0
    );

    // For custom plans, current_period_end may be from the config override
    // or from the subscription row itself. Use effective expiry.
    const effectiveExpiry = getEffectiveExpiry(latest, latest.config_id ? latest : null);

    // Album quota: sum all active subscriptions of this type
    const albumQuota = totalAlbumQuota || 1;

    return {
      ...latest,
      album_quota:        albumQuota,
      current_period_end: effectiveExpiry,
      subscription_count: subRes.rows.length,
      subscriptions:      subRes.rows,
    };
  }

  // ── Legacy fallback (users table columns) ──────────────────
  const legacyRes = await db.query(
    `SELECT subscription_plan  AS plan_slug,
            subscription_status AS status,
            album_quota,
            memorial_plan,
            wedding_plan
     FROM users
     WHERE id = $1`,
    [userId]
  );
  const legacy = legacyRes.rows[0];
  if (!legacy) return null;

  const legacyPlan = planType === 'wedding'
    ? legacy.wedding_plan  || legacy.plan_slug
    : legacy.memorial_plan || legacy.plan_slug;

  if (!legacyPlan) return null;
  if (!['active', 'trialing', 'lifetime'].includes(legacy.status)) return null;
  if (getPlanType(legacyPlan, 'memorial') !== planType) return null;

  return {
    plan_slug:          legacyPlan,
    plan_type:          planType,
    status:             legacy.status,
    album_quota:        legacy.album_quota,
    current_period_end: null,
    config_id:          null,
    payment_mode:       'monthly',
    subscription_count: 0,
    subscriptions:      [],
  };
}

// ── NFC order checker ─────────────────────────────────────────

/**
 * Returns TRUE if the user has at least one paid physical NFC order.
 * Used to gate NFC feature access.
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function userHasPaidNfcOrder(userId) {
  const res = await db.query(
    `SELECT 1 FROM physical_orders
     WHERE user_id = $1
       AND order_type = 'nfc_tag'
       AND payment_status = 'paid'
     LIMIT 1`,
    [userId]
  );
  return res.rows.length > 0;
}

// ── Main context builder ──────────────────────────────────────

/**
 * Returns the full plan context for a user + plan type.
 * This is the primary function called by controllers and middleware.
 *
 * Output shape is compatible with the original getPlanContextForType()
 * so existing callers don't break.
 *
 * @param {string} userId
 * @param {string} planType  'memorial' | 'wedding'
 * @returns {Promise<Object>}
 */
async function getPlanContextForType(userId, planType) {
  const subscription = await getActiveSubscriptionForType(userId, planType);
  const planSlug     = subscription?.plan_slug || null;

  // ── Custom plan path ───────────────────────────────────────
  if (isCustomSlug(planSlug) && subscription?.config_id) {
    const [nfcResult] = await Promise.all([
      userHasPaidNfcOrder(userId),
    ]);

    const limits = getEffectiveLimits(subscription);  // respects overrides
    const access = getCustomPlanAccess(subscription, planType, nfcResult);

    return {
      planType,
      planSlug,
      subscription,
      pricingPlan:  null,   // no pricing_plans row for custom
      isCustom:     true,
      albumQuota:   Math.max(1, parseInt(subscription.album_quota, 10) || 1),
      maxPhotos:    limits.photos,
      maxVideos:    limits.videos,
      audioEnabled: limits.audioEnabled,
      ...access,
    };
  }

  // ── Legacy plan path (unchanged logic) ────────────────────
  let pricingPlan = null;
  if (planSlug) {
    const planRes = await db.query(
      `SELECT slug, plan_type, max_photos, max_videos, max_albums
       FROM pricing_plans WHERE slug = $1 LIMIT 1`,
      [planSlug]
    );
    pricingPlan = planRes.rows[0] || null;
  }

  const defaults      = LEGACY_PLAN_LIMIT_DEFAULTS[planSlug] || {};
  const albumQuotaRaw = subscription?.album_quota ?? pricingPlan?.max_albums ?? defaults.maxAlbums ?? 1;
  const access        = getLegacyPlanAccess(planSlug, planType);

  return {
    planType,
    planSlug,
    subscription,
    pricingPlan,
    isCustom:     false,
    albumQuota:   albumQuotaRaw == null ? null : Math.max(1, parseInt(albumQuotaRaw, 10) || 1),
    maxPhotos:    pricingPlan?.max_photos ?? defaults.maxPhotos ?? null,
    maxVideos:    pricingPlan?.max_videos ?? defaults.maxVideos ?? null,
    audioEnabled: false,    // legacy plans had no audio toggle
    ...access,
  };
}

// ── Album context (public API — signature unchanged) ──────────

/**
 * Returns plan context scoped to a specific album.
 * Used by album and media controllers to enforce upload limits.
 *
 * @param {string} userId
 * @param {string} albumId
 * @returns {Promise<Object|null>}
 */
async function getAlbumPlanContext(userId, albumId) {
  const albumRes = await db.query(
    `SELECT id, user_id, type, theme, slug, name, birth_date, death_date, birth_year, death_year
     FROM albums
     WHERE id = $1 AND user_id = $2`,
    [albumId, userId]
  );
  const album = albumRes.rows[0];
  if (!album) return null;

  const planType = album.type === 'wedding' ? 'wedding' : 'memorial';
  const context  = await getPlanContextForType(userId, planType);
  return { ...context, album };
}

// ── Exports ───────────────────────────────────────────────────

module.exports = {
  // Theme lists (used by frontend constants and other controllers)
  MEMORIAL_THEME_IDS,
  WEDDING_THEME_IDS,

  // Helpers
  getPlanType,
  isCustomSlug,

  // Legacy access (kept for any direct callers)
  getPlanAccess: getLegacyPlanAccess,

  // Main API
  getPlanContextForType,
  getAlbumPlanContext,

  // Exposed for admin controller
  userHasPaidNfcOrder,
};
