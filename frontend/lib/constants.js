/**
 * lib/constants.js
 * Shared constants and pure helper functions.
 * No imports from other lib files — zero circular dependency risk.
 *
 * PRICING MODEL (custom configurator — replaces fixed tiers):
 *   Base price: Memorial ₹499/mo, Wedding ₹699/mo
 *   Length discounts: 0→30% in 5% steps across 7 options
 *   Add-ons: photo packs, video packs, audio toggle, themes toggle
 *   Upfront: additional 8% off the period total
 *
 * Legacy plan helpers (isOneTimePlan, planName, PLAN_MEDIA_LIMITS etc.) are
 * KEPT for backward compatibility — existing subscribers on old plans still
 * use them in AlbumSettings, Dashboard, AccountPage, AppShell.
 */

import { APP_URL, CDN } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM CONFIGURATOR CONSTANTS
// These mirror the values seeded in base_pricing + addon_pricing tables.
// Used for live UI price calculation before the API call.
// ─────────────────────────────────────────────────────────────────────────────

/** Base monthly rates per plan type (INR, for display only). */
export const BASE_PRICES_INR = { memorial: 499, wedding: 699 };

/** Additional discount applied when paying full period upfront. */
export const UPFRONT_DISCOUNT_PCT = 8;

/** Media included in every plan at base price. */
export const BASE_PHOTOS       = 100;
export const BASE_VIDEOS       = 3;
export const PHOTOS_PER_PACK   = 10;
export const VIDEOS_PER_PACK   = 3;

/**
 * Subscription length options with discount percentages.
 * Mirrors the base_pricing table exactly.
 * Monthly rates are pre-floored (no fractional paise).
 */
export const SUBSCRIPTION_LENGTHS = [
  { months: 1,  label: '1 Month',  discountPct: 0,  memorialMonthlyInr: 399, weddingMonthlyInr: 549 },
  { months: 3,  label: '3 Months', discountPct: 5,  memorialMonthlyInr: 379, weddingMonthlyInr: 521 },
  { months: 6,  label: '6 Months', discountPct: 10, memorialMonthlyInr: 360, weddingMonthlyInr: 494 },
  { months: 12, label: '1 Year',   discountPct: 15, memorialMonthlyInr: 339, weddingMonthlyInr: 467 },
  { months: 24, label: '2 Years',  discountPct: 20, memorialMonthlyInr: 319, weddingMonthlyInr: 439 },
  { months: 36, label: '3 Years',  discountPct: 25, memorialMonthlyInr: 299, weddingMonthlyInr: 412 },
  { months: 60, label: '5 Years',  discountPct: 30, memorialMonthlyInr: 279, weddingMonthlyInr: 384 },
];

/**
 * Default add-on prices (INR/month for recurring, one-time for physical).
 * These are fallback display values — the live API always returns the
 * authoritative prices from the addon_pricing table.
 */
export const DEFAULT_ADDON_PRICES_INR = {
  photo_pack:    19,    // per +10 photos / month
  video_pack:    59,    // per +3 videos / month
  audio_toggle:  49,    // per month
  themes_toggle: 49,    // per month
  qr_print:      299,   // one-time
  nfc_tag:       299,   // one-time
};

/**
 * Calculate the full price breakdown for a custom config.
 * Mirrors the server-side logic in pricing-engine.js.
 * All arithmetic in paise (integers) to avoid float rounding.
 *
 * @param {Object} config
 * @param {string} config.planType           'memorial' | 'wedding'
 * @param {number} config.lengthMonths       One of SUBSCRIPTION_LENGTHS[].months
 * @param {number} config.extraPhotoPacks    >= 0
 * @param {number} config.extraVideoPacks    >= 0
 * @param {boolean} config.audioEnabled
 * @param {boolean} config.themesEnabled
 * @param {string} config.paymentMode        'monthly' | 'upfront'
 * @param {Object} addonPricesInr            Map of key → price_inr (from API or defaults)
 * @param {number} baseMonthlyInr            From SUBSCRIPTION_LENGTHS or API
 * @returns {Object} price breakdown
 */
export function calculateConfigPrice(config, addonPricesInr = DEFAULT_ADDON_PRICES_INR, baseMonthlyInr = null) {
  const {
    planType, lengthMonths, extraPhotoPacks, extraVideoPacks,
    audioEnabled, themesEnabled, paymentMode,
  } = config;

  // Base monthly rate
  const lengthRow = SUBSCRIPTION_LENGTHS.find((l) => l.months === Number(lengthMonths));
  const baseMoInr = baseMonthlyInr
    ?? (planType === 'wedding' ? lengthRow?.weddingMonthlyInr : lengthRow?.memorialMonthlyInr)
    ?? BASE_PRICES_INR[planType] ?? 499;

  // Convert to paise for integer arithmetic
  const baseMoPaise = Math.round(baseMoInr * 100);

  const photoAddon  = Math.round((addonPricesInr.photo_pack    ?? DEFAULT_ADDON_PRICES_INR.photo_pack)    * 100) * Number(extraPhotoPacks);
  const videoAddon  = Math.round((addonPricesInr.video_pack    ?? DEFAULT_ADDON_PRICES_INR.video_pack)    * 100) * Number(extraVideoPacks);
  const audioAddon  = audioEnabled  ? Math.round((addonPricesInr.audio_toggle  ?? DEFAULT_ADDON_PRICES_INR.audio_toggle)  * 100) : 0;
  const themesAddon = themesEnabled ? Math.round((addonPricesInr.themes_toggle ?? DEFAULT_ADDON_PRICES_INR.themes_toggle) * 100) : 0;

  const addonMoPaise    = photoAddon + videoAddon + audioAddon + themesAddon;
  const totalMoPaise    = baseMoPaise + addonMoPaise;
  const subtotalPaise   = Math.floor(totalMoPaise * Number(lengthMonths));

  let upfrontDiscountPaise = 0;
  let totalChargedPaise    = subtotalPaise;
  if (paymentMode === 'upfront') {
    upfrontDiscountPaise = Math.floor(subtotalPaise * UPFRONT_DISCOUNT_PCT / 100);
    totalChargedPaise    = subtotalPaise - upfrontDiscountPaise;
  }

  const totalPhotos = BASE_PHOTOS + Number(extraPhotoPacks) * PHOTOS_PER_PACK;
  const totalVideos = BASE_VIDEOS + Number(extraVideoPacks) * VIDEOS_PER_PACK;
  const discountPct = lengthRow?.discountPct ?? 0;

  return {
    // Paise values (integers)
    baseMoPaise,
    addonMoPaise,
    totalMoPaise,
    subtotalPaise,
    upfrontDiscountPaise,
    totalChargedPaise,

    // INR display values (never used in Razorpay amount)
    baseMoInr:           baseMoPaise / 100,
    addonMoInr:          addonMoPaise / 100,
    totalMoInr:          totalMoPaise / 100,
    subtotalInr:         subtotalPaise / 100,
    upfrontDiscountInr:  upfrontDiscountPaise / 100,
    totalChargedInr:     totalChargedPaise / 100,

    // Limits
    totalPhotos,
    totalVideos,

    // Metadata
    discountPct,
    upfrontDiscountPct: paymentMode === 'upfront' ? UPFRONT_DISCOUNT_PCT : 0,
    lengthLabel:        lengthRow?.label ?? `${lengthMonths} Months`,
  };
}

/** Format paise → '₹X,XX,XXX' display string. */
export function fmtPaise(paise) {
  return '₹' + Math.floor(paise / 100).toLocaleString('en-IN');
}

/** Format INR number → '₹X,XX,XXX' display string. */
export function fmtINR(inr) {
  return '₹' + Math.floor(Number(inr)).toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY PLAN HELPERS  (kept for backward compatibility — do not remove)
// Used by: AlbumSettings, Dashboard, AppShell, AccountPage
// ─────────────────────────────────────────────────────────────────────────────

export const isWeddingPlan  = (plan) => Boolean(plan?.startsWith('wedding'));
export const isMemorialPlan = (plan) => !isWeddingPlan(plan) && Boolean(plan);

/**
 * isOneTimePlan — returns true for the old one-time/lifetime slugs AND
 * for the new 'upfront' custom plans (identified by checking paymentMode
 * on the subscription object if available).
 */
export const isOneTimePlan = (planSlugOrSub) => {
  if (!planSlugOrSub) return false;
  // Accept a subscription object from the status API
  if (typeof planSlugOrSub === 'object') {
    return planSlugOrSub.payment_mode === 'upfront' ||
      ['memorial-premium','wedding-premium','lifetime'].includes(planSlugOrSub.plan_slug);
  }
  return ['memorial-premium','wedding-premium','lifetime'].includes(planSlugOrSub);
};

export const isCustomPlan = (slug) =>
  slug === 'memorial-custom' || slug === 'wedding-custom';

export function getSubscriptionType(plan) {
  if (isWeddingPlan(plan)) return 'wedding';
  if (isMemorialPlan(plan)) return 'memorial';
  return 'memorial';
}

/** Human-readable plan name. Handles legacy + custom slugs. */
export function planName(planSlugOrSub) {
  if (!planSlugOrSub) return '—';
  const slug = typeof planSlugOrSub === 'object'
    ? planSlugOrSub.plan_slug
    : planSlugOrSub;

  const MAP = {
    'memorial-custom':   'Memorial Custom',
    'wedding-custom':    'Wedding Custom',
    'memorial-basic':    'Memorial Basic',
    'memorial-standard': 'Memorial Standard',
    'memorial-premium':  'Memorial Premium',
    'wedding-basic':     'Wedding Basic',
    'wedding-classic':   'Wedding Classic',
    'wedding-premium':   'Wedding Premium',
    'monthly':           'Monthly',
    'yearly':            'Yearly',
    'lifetime':          'Lifetime',
  };
  return MAP[slug] || slug || '—';
}

/**
 * PLAN_MEDIA_LIMITS — legacy map for old plan slugs.
 * Custom plans read limits from the subscription object (total_photos / total_videos).
 */
export const PLAN_MEDIA_LIMITS = {
  'memorial-basic':    { photos: 100,  videos: 5  },
  'memorial-standard': { photos: 200,  videos: 10 },
  'memorial-premium':  { photos: 1000, videos: 30 },
  'wedding-basic':     { photos: 100,  videos: 5  },
  'wedding-classic':   { photos: 200,  videos: 20 },
  'wedding-premium':   { photos: 1000, videos: 50 },
  monthly:             { photos: 200,  videos: 10 },
  yearly:              { photos: 500,  videos: 30 },
  lifetime:            { photos: 2000, videos: 50 },
};

export function getPlanMediaLimits(plan) {
  return PLAN_MEDIA_LIMITS[plan] || { photos: BASE_PHOTOS, videos: BASE_VIDEOS };
}

export const PLAN_FEATURE_ACCESS = {
  'memorial-basic':    { canChangeTheme: false, canUseNfc: false, canDownloadPlaque: false, allowedThemes: ['classic'], defaultTheme: 'classic' },
  'memorial-standard': { canChangeTheme: true,  canUseNfc: false, canDownloadPlaque: true,  allowedThemes: ['classic','warm-sepia','dark-memorial','nature','minimal-white'], defaultTheme: 'classic' },
  'memorial-premium':  { canChangeTheme: true,  canUseNfc: true,  canDownloadPlaque: true,  allowedThemes: ['classic','warm-sepia','dark-memorial','nature','minimal-white'], defaultTheme: 'classic' },
  'wedding-basic':     { canChangeTheme: false, canUseNfc: false, canDownloadPlaque: false, allowedThemes: ['classic-romance'], defaultTheme: 'classic-romance' },
  'wedding-classic':   { canChangeTheme: true,  canUseNfc: false, canDownloadPlaque: true,  allowedThemes: ['classic-romance','garden-bloom','golden-luxe','coastal-breeze','modern-minimal','rustic-charm'], defaultTheme: 'classic-romance' },
  'wedding-premium':   { canChangeTheme: true,  canUseNfc: false, canDownloadPlaque: true,  allowedThemes: ['classic-romance','garden-bloom','golden-luxe','coastal-breeze','modern-minimal','rustic-charm'], defaultTheme: 'classic-romance' },
  monthly:             { canChangeTheme: false, canUseNfc: false, canDownloadPlaque: false, allowedThemes: ['classic'], defaultTheme: 'classic' },
  yearly:              { canChangeTheme: true,  canUseNfc: false, canDownloadPlaque: true,  allowedThemes: ['classic','warm-sepia','dark-memorial','nature','minimal-white'], defaultTheme: 'classic' },
  lifetime:            { canChangeTheme: true,  canUseNfc: true,  canDownloadPlaque: true,  allowedThemes: ['classic','warm-sepia','dark-memorial','nature','minimal-white'], defaultTheme: 'classic' },
};

export function getAlbumQuota(plan, override) {
  // The override comes from the subscription object (album_quota column),
  // which the backend aggregates across all active subscriptions of a type.
  // Always trust it when present and valid.
  if (override != null && override > 0) return override;
  const quotas = {
    'memorial-basic': 1, 'memorial-standard': 1, 'memorial-premium': 3,
    'wedding-basic':  1, 'wedding-classic':   3, 'wedding-premium':  10,
    monthly: 1, yearly: 1, lifetime: 1,
    // Custom plans set quota via subscription_configs; without an override we
    // return null so callers treat it as unknown rather than hard-capping at 1.
    'memorial-custom': null,
    'wedding-custom':  null,
  };
  const fromMap = quotas[plan];
  // null means "custom plan with no override data yet" — treat as Infinity in
  // getRemainingAlbumSlots (it checks quota == null → Infinity already).
  return fromMap !== undefined ? fromMap : 1;
}

export const getPlanType = (slug) =>
  slug?.startsWith('wedding') ? 'wedding' : 'memorial';

export function getUserSubscription(user, type = 'memorial') {
  if (!user) return null;
  return type === 'wedding' ? user.weddingSub || null : user.memorialSub || null;
}

export function getPlanForType(user, type = 'memorial') {
  const sub = getUserSubscription(user, type);
  if (sub?.planSlug || sub?.plan_slug) return sub.planSlug || sub.plan_slug;
  // For wedding: fall back to subscriptionPlan only if it is itself a wedding slug.
  // This mirrors the memorial branch and supports legacy users whose plan is stored
  // in subscriptionPlan (e.g. 'wedding-basic') rather than the dedicated weddingPlan field.
  if (type === 'wedding')
    return user?.weddingPlan
      || (isWeddingPlan(user?.subscriptionPlan) ? user.subscriptionPlan : null)
      || null;
  if (type === 'memorial')
    return user?.memorialPlan
      || (isMemorialPlan(user?.subscriptionPlan) ? user.subscriptionPlan : null)
      || null;
  return user?.subscriptionPlan || null;
}

export function getQuotaForType(user, type = 'memorial') {
  const sub = getUserSubscription(user, type);
  const subQuota = sub?.albumQuota ?? sub?.album_quota;
  const plan = getPlanForType(user, type);
  return getAlbumQuota(plan, subQuota);
}

/**
 * getMediaLimitsForType — extended to handle custom plans.
 * Custom plans carry their limits in the subscription object (total_photos/total_videos).
 */
export function getMediaLimitsForType(user, type = 'memorial') {
  const sub  = getUserSubscription(user, type);
  const plan = getPlanForType(user, type);

  // Custom plan: read from subscription object (set by /api/payment/status)
  if (isCustomPlan(plan) && sub) {
    const photos = sub.override_photos ?? sub.max_photos ?? sub.total_photos ?? BASE_PHOTOS;
    const videos = sub.override_videos ?? sub.max_videos ?? sub.total_videos ?? BASE_VIDEOS;
    return { photos: Number(photos), videos: Number(videos) };
  }

  return getPlanMediaLimits(plan);
}

/**
 * getPlanFeatureAccess — extended to handle custom plans.
 * Custom plans derive access from subscription flags.
 */
export function getPlanFeatureAccess(planSlugOrSub, albumType = 'memorial') {
  const fallbackTheme  = albumType === 'wedding' ? 'classic-romance' : 'classic';
  const allThemes      = albumType === 'wedding'
    ? ['classic-romance','garden-bloom','golden-luxe','coastal-breeze','modern-minimal','rustic-charm']
    : ['classic','warm-sepia','dark-memorial','nature','minimal-white'];

  // Accept a subscription object for custom plans
  if (typeof planSlugOrSub === 'object' && planSlugOrSub !== null) {
    const sub = planSlugOrSub;
    const themesOn = Boolean(sub.override_themes ?? sub.themes_enabled ?? sub.can_change_theme);
    return {
      canChangeTheme:    themesOn,
      canUseNfc:         Boolean(sub.canUseNfc ?? sub.can_use_nfc ?? false),
      canDownloadPlaque: true,
      // audio_enabled / override_audio come from the subscription_configs join
      audioEnabled:      Boolean(sub.override_audio ?? sub.audio_enabled ?? false),
      allowedThemes:     themesOn ? allThemes : [fallbackTheme],
      defaultTheme:      fallbackTheme,
    };
  }

  // Legacy string slug
  const access = PLAN_FEATURE_ACCESS[planSlugOrSub] || {};
  return {
    canChangeTheme:    Boolean(access.canChangeTheme),
    canUseNfc:         Boolean(access.canUseNfc),
    // Legacy plans did not have per-plan audio; treat as disabled by default.
    audioEnabled:      Boolean(access.audioEnabled ?? false),
    canDownloadPlaque: Boolean(access.canDownloadPlaque),
    allowedThemes:     access.allowedThemes || [fallbackTheme],
    defaultTheme:      access.defaultTheme  || fallbackTheme,
  };
}

export function getAlbumFeatureAccess(user, albumType = 'memorial') {
  const sub  = getUserSubscription(user, albumType);
  const plan = getPlanForType(user, albumType);
  // Pass the sub object for custom plans so feature flags are read correctly
  if (isCustomPlan(plan) && sub) return getPlanFeatureAccess(sub, albumType);
  return getPlanFeatureAccess(plan, albumType);
}

export function getAlbumCountsByType(albums = []) {
  return albums.reduce((acc, album) => {
    const type = album?.type === 'wedding' ? 'wedding' : 'memorial';
    acc[type] += 1;
    return acc;
  }, { memorial: 0, wedding: 0 });
}

export function getRemainingAlbumSlots(user, albums = [], type = 'memorial') {
  const quota = getQuotaForType(user, type);
  if (quota === Infinity || quota == null) return Infinity;
  const counts = getAlbumCountsByType(albums);
  return Math.max(0, quota - (counts[type] || 0));
}

export function canCreateAlbumType(user, albums = [], type = 'memorial') {
  const hasPlan = type === 'wedding'
    ? (user?.hasWedding || isWeddingPlan(getPlanForType(user, 'wedding')))
    : (user?.hasMemorial || isMemorialPlan(getPlanForType(user, 'memorial')));
  if (!hasPlan) return false;
  return getRemainingAlbumSlots(user, albums, type) > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM & THEME CONSTANTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const WEDDING_ALBUM_LABELS = [
  { value: 'pre-wedding',  label: 'Pre-Wedding',  icon: '📸', desc: 'Couple shoots, engagement moments, and the build-up to the big day.' },
  { value: 'wedding-day',  label: 'Wedding Day',  icon: '💍', desc: 'Ceremony highlights, portraits, and the celebration itself.' },
  { value: 'honeymoon',    label: 'Honeymoon',    icon: '✈️', desc: 'Travel memories and your first adventure together after the wedding.' },
  { value: 'anniversary',  label: 'Anniversary',  icon: '🎂', desc: 'Return to the moments that keep the story growing year after year.' },
];

export function getAlbumLabelName(label) {
  return WEDDING_ALBUM_LABELS.find((item) => item.value === label)?.label || label || '';
}

export const MEMORIAL_THEMES = [
  { id: 'classic',        label: 'Classic',       icon: '🕯', desc: 'Timeless memorial styling with a calm, traditional tone.' },
  { id: 'warm-sepia',     label: 'Warm Sepia',    icon: '📜', desc: 'Soft sepia warmth for an heirloom, archival feel.' },
  { id: 'dark-memorial',  label: 'Dark Memorial', icon: '🌙', desc: 'A deep, contemplative palette for evening remembrance.' },
  { id: 'nature',         label: 'Nature',        icon: '🌿', desc: 'Leafy, organic tones suited to gentle outdoor memories.' },
  { id: 'minimal-white',  label: 'Minimal White', icon: '⬜', desc: 'Clean and restrained, keeping the focus on the story.' },
];

export const WEDDING_THEMES = [
  { id: 'classic-romance', label: 'Classic Romance', icon: '💐', desc: 'Elegant florals and soft romance for timeless weddings.' },
  { id: 'garden-bloom',    label: 'Garden Bloom',    icon: '🌸', desc: 'Fresh botanical styling inspired by garden ceremonies.' },
  { id: 'golden-luxe',     label: 'Golden Luxe',     icon: '✨', desc: 'Warm gold accents with a polished, celebratory finish.' },
  { id: 'coastal-breeze',  label: 'Coastal Breeze',  icon: '🌊', desc: 'Airy tones and light textures inspired by seaside weddings.' },
  { id: 'modern-minimal',  label: 'Modern Minimal',  icon: '🕊', desc: 'Minimal layouts with a crisp contemporary mood.' },
  { id: 'rustic-charm',    label: 'Rustic Charm',    icon: '🌾', desc: 'Earthy textures and intimate warmth for relaxed celebrations.' },
];

export const ALBUM_THEMES = [...MEMORIAL_THEMES, ...WEDDING_THEMES];

// ─────────────────────────────────────────────────────────────────────────────
// LIFE EVENTS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_ICONS = [
  { id: 'star',      emoji: '⭐', label: 'Milestone'   },
  { id: 'heart',     emoji: '❤️', label: 'Love'        },
  { id: 'book',      emoji: '📖', label: 'Achievement' },
  { id: 'travel',    emoji: '✈️', label: 'Travel'      },
  { id: 'family',    emoji: '👨‍👩‍👧', label: 'Family'     },
  { id: 'work',      emoji: '💼', label: 'Work'        },
  { id: 'education', emoji: '🎓', label: 'Education'   },
  { id: 'faith',     emoji: '🙏', label: 'Faith'       },
  { id: 'sport',     emoji: '🏅', label: 'Sport'       },
  { id: 'music',     emoji: '🎵', label: 'Music'       },
  { id: 'health',    emoji: '🏥', label: 'Health'      },
  { id: 'award',     emoji: '🏆', label: 'Award'       },
];

export const EVENT_ICON_OPTIONS = EVENT_ICONS;

export const EVENT_ICON_EMOJI_BY_ID = Object.fromEntries(
  EVENT_ICONS.map((e) => [e.id, e.emoji])
);

export const normalizeEventIcon = (icon) => {
  if (!icon) return 'star';
  const byId    = EVENT_ICONS.find((e) => e.id    === icon);
  if (byId) return icon;
  const byEmoji = EVENT_ICONS.find((e) => e.emoji === icon);
  return byEmoji?.id || 'star';
};

export const renderEventIcon = (icon) =>
  EVENT_ICON_EMOJI_BY_ID[normalizeEventIcon(icon)] || '⭐';

// ─────────────────────────────────────────────────────────────────────────────
// URL HELPERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function getQRUrl(pathOrSlug, isWedding = false) {
  if (!pathOrSlug) return '';
  const path = isWedding || String(pathOrSlug).startsWith('wedding/')
    ? String(pathOrSlug).replace(/^\/+/, '')
    : `album/${String(pathOrSlug).replace(/^\/+/, '')}`;
  const targetUrl = `${APP_URL}/${path}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetUrl)}`;
}

export function cdnUrl(key) {
  if (!key) return null;
  return `${CDN}/${key}`;
}

export function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MISC HELPERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export function nl2br(str) {
  if (!str) return '';
  return String(str).replace(/\n/g, '<br>');
}

export function parsePlanFeatures(features) {
  if (Array.isArray(features)) return features;
  try { return JSON.parse(features); } catch { return []; }
}

export function toINR(paise) {
  return (paise / 100).toFixed(2);
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function fmtDateForInput(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  return dateStr;
}
