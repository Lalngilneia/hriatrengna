'use strict';
/**
 * pricing-engine.js
 *
 * Single source of truth for all custom subscription pricing logic.
 * No pricing math should exist anywhere else in the codebase.
 *
 * All monetary values are integers in paise (1 INR = 100 paise).
 * This avoids float rounding bugs when multiplying rates × months.
 */

const db = require('./db');

// ── Constants ─────────────────────────────────────────────────

const VALID_LENGTHS = [1, 3, 6, 12, 24, 36, 60];
const UPFRONT_DISCOUNT_PCT = 8;          // Additional % off for upfront payment
const BASE_PHOTOS = 100;                 // Included in every plan
const BASE_VIDEOS = 3;                   // Included in every plan
const PHOTOS_PER_PACK = 10;
const VIDEOS_PER_PACK = 3;

// Plan slugs used for custom configs in users/user_subscriptions tables
const CUSTOM_SLUG = {
  memorial: 'memorial-custom',
  wedding:  'wedding-custom',
};

// ── DB Fetchers ───────────────────────────────────────────────

/**
 * Fetch the base pricing row for a given plan type and length.
 * Returns null if not found or inactive.
 *
 * @param {string} planType   'memorial' | 'wedding'
 * @param {number} lengthMonths
 * @returns {Promise<{monthly_rate_paise: number, discount_pct: number}|null>}
 */
async function getBasePricingRow(planType, lengthMonths) {
  const res = await db.query(
    `SELECT monthly_rate_paise, discount_pct
     FROM base_pricing
     WHERE plan_type = $1
       AND length_months = $2
       AND is_active = TRUE
     LIMIT 1`,
    [planType, lengthMonths]
  );
  return res.rows[0] || null;
}

/**
 * Fetch all active add-on pricing rows, keyed by their slug.
 * Returns a map: { photo_pack: {price_paise, label}, ... }
 *
 * @returns {Promise<Object>}
 */
async function getAddonPricingMap() {
  const res = await db.query(
    `SELECT key, label, price_paise, unit, is_recurring
     FROM addon_pricing
     WHERE is_active = TRUE`
  );
  const map = {};
  for (const row of res.rows) {
    map[row.key] = row;
  }
  return map;
}

/**
 * Fetch both base and addon pricing in parallel (for checkout).
 *
 * @param {string} planType
 * @param {number} lengthMonths
 * @returns {Promise<{base: Object, addons: Object}>}
 */
async function fetchPricingData(planType, lengthMonths) {
  const [base, addons] = await Promise.all([
    getBasePricingRow(planType, lengthMonths),
    getAddonPricingMap(),
  ]);
  return { base, addons };
}

// ── Validation ────────────────────────────────────────────────

/**
 * Validate a customer-submitted config object.
 * Returns { valid: true } or { valid: false, error: string }.
 *
 * @param {Object} config
 * @param {string} config.planType
 * @param {number} config.lengthMonths
 * @param {number} config.extraPhotoPacks
 * @param {number} config.extraVideoPacks
 * @param {boolean} config.audioEnabled
 * @param {boolean} config.themesEnabled
 * @param {string} config.paymentMode  'monthly' | 'upfront'
 */
function validateConfig(config) {
  const {
    planType,
    lengthMonths,
    extraPhotoPacks,
    extraVideoPacks,
    audioEnabled,
    themesEnabled,
    paymentMode,
  } = config;

  if (!['memorial', 'wedding'].includes(planType))
    return { valid: false, error: 'Invalid plan type.' };

  if (!VALID_LENGTHS.includes(Number(lengthMonths)))
    return { valid: false, error: `Invalid subscription length. Allowed: ${VALID_LENGTHS.join(', ')} months.` };

  if (!Number.isInteger(Number(extraPhotoPacks)) || Number(extraPhotoPacks) < 0)
    return { valid: false, error: 'Extra photo packs must be a non-negative integer.' };

  if (!Number.isInteger(Number(extraVideoPacks)) || Number(extraVideoPacks) < 0)
    return { valid: false, error: 'Extra video packs must be a non-negative integer.' };

  if (typeof audioEnabled !== 'boolean')
    return { valid: false, error: 'audioEnabled must be a boolean.' };

  if (typeof themesEnabled !== 'boolean')
    return { valid: false, error: 'themesEnabled must be a boolean.' };

  if (!['monthly', 'upfront'].includes(paymentMode))
    return { valid: false, error: 'paymentMode must be "monthly" or "upfront".' };

  // Reasonable upper bounds — prevents absurd configs / DB abuse
  if (Number(extraPhotoPacks) > 490)  // 100 + 490×10 = 5000 max photos
    return { valid: false, error: 'Maximum 490 photo packs allowed.' };

  if (Number(extraVideoPacks) > 99)   // 3 + 99×3 = 300 max videos
    return { valid: false, error: 'Maximum 99 video packs allowed.' };

  return { valid: true };
}

// ── Core Calculation ──────────────────────────────────────────

/**
 * Calculate the full price breakdown for a config.
 * All arithmetic is done in paise (integers) to avoid float errors.
 * Final amounts are floored before being passed to Razorpay.
 *
 * @param {Object} config           Validated customer config
 * @param {Object} basePricingRow   Row from base_pricing table
 * @param {Object} addonMap         Map from getAddonPricingMap()
 * @returns {Object} Full price breakdown
 */
function calculatePrice(config, basePricingRow, addonMap) {
  const {
    extraPhotoPacks,
    extraVideoPacks,
    audioEnabled,
    themesEnabled,
    lengthMonths,
    paymentMode,
  } = config;

  // ── Monthly component ──────────────────────────────────────
  const baseMonthlyPaise = basePricingRow.monthly_rate_paise;

  // Add-ons: each is price × quantity, all in paise
  const photoAddonPaise  = (addonMap.photo_pack?.price_paise  || 0) * Number(extraPhotoPacks);
  const videoAddonPaise  = (addonMap.video_pack?.price_paise  || 0) * Number(extraVideoPacks);
  const audioAddonPaise  = audioEnabled  ? (addonMap.audio_toggle?.price_paise  || 0) : 0;
  const themesAddonPaise = themesEnabled ? (addonMap.themes_toggle?.price_paise || 0) : 0;

  const addonMonthlyPaise = photoAddonPaise + videoAddonPaise + audioAddonPaise + themesAddonPaise;
  const totalMonthlyPaise = baseMonthlyPaise + addonMonthlyPaise;

  // ── Period total before upfront discount ───────────────────
  // Multiply by length then floor — never accumulate floats
  const subtotalPaise = Math.floor(totalMonthlyPaise * Number(lengthMonths));

  // ── Upfront discount (applied to period total) ─────────────
  let upfrontDiscountPaise = 0;
  let totalChargedPaise    = subtotalPaise;

  if (paymentMode === 'upfront') {
    // Floor the discount so Razorpay always gets an integer
    upfrontDiscountPaise = Math.floor(subtotalPaise * UPFRONT_DISCOUNT_PCT / 100);
    totalChargedPaise    = subtotalPaise - upfrontDiscountPaise;
  }

  // ── Computed limits ────────────────────────────────────────
  const totalPhotos = BASE_PHOTOS + (Number(extraPhotoPacks) * PHOTOS_PER_PACK);
  const totalVideos = BASE_VIDEOS + (Number(extraVideoPacks) * VIDEOS_PER_PACK);

  return {
    // Snapshot values (stored in subscription_configs)
    baseMonthlyPaise,
    addonMonthlyPaise,
    totalMonthlyPaise,
    lengthDiscountPct: Number(basePricingRow.discount_pct),
    upfrontDiscountPct: paymentMode === 'upfront' ? UPFRONT_DISCOUNT_PCT : 0,
    subtotalPaise,
    upfrontDiscountPaise,
    totalChargedPaise,

    // Computed limits
    totalPhotos,
    totalVideos,

    // Human-readable breakdown (for API response / UI)
    display: {
      baseMonthly:       formatINR(baseMonthlyPaise),
      addonMonthly:      formatINR(addonMonthlyPaise),
      totalMonthly:      formatINR(totalMonthlyPaise),
      subtotal:          formatINR(subtotalPaise),
      upfrontDiscount:   formatINR(upfrontDiscountPaise),
      totalCharged:      formatINR(totalChargedPaise),
      lengthDiscountPct: Number(basePricingRow.discount_pct),
      upfrontDiscountPct: paymentMode === 'upfront' ? UPFRONT_DISCOUNT_PCT : 0,
      lengthLabel:       lengthLabel(Number(lengthMonths)),
    },
  };
}

// ── Convenience: full calculate from DB ───────────────────────

/**
 * Validate config, fetch pricing from DB, and return full breakdown.
 * Use this in controllers — it handles validation + DB fetch + calc.
 *
 * @param {Object} config  Raw config from request body
 * @returns {Promise<{error: string}|{pricing: Object, config: Object}>}
 */
async function resolvePrice(config) {
  // 1. Coerce types (body values come in as strings from JSON)
  const normalised = {
    planType:        String(config.planType || ''),
    lengthMonths:    parseInt(config.lengthMonths, 10),
    extraPhotoPacks: parseInt(config.extraPhotoPacks ?? 0, 10),
    extraVideoPacks: parseInt(config.extraVideoPacks ?? 0, 10),
    audioEnabled:    Boolean(config.audioEnabled),
    themesEnabled:   Boolean(config.themesEnabled),
    paymentMode:     String(config.paymentMode || 'monthly'),
  };

  // 2. Validate
  const validation = validateConfig(normalised);
  if (!validation.valid) return { error: validation.error };

  // 3. Fetch pricing from DB
  const { base, addons } = await fetchPricingData(
    normalised.planType,
    normalised.lengthMonths
  );

  if (!base) {
    return {
      error: `No active pricing found for ${normalised.planType} / ${normalised.lengthMonths} months.`,
    };
  }

  // 4. Calculate
  const pricing = calculatePrice(normalised, base, addons);

  return { pricing, config: normalised };
}

// ── Subscription config row builder ───────────────────────────

/**
 * Build the data object for inserting into subscription_configs.
 * Call after resolvePrice() succeeds.
 *
 * @param {string} userId
 * @param {Object} config    Normalised config from resolvePrice()
 * @param {Object} pricing   Pricing result from resolvePrice()
 * @returns {Object}
 */
function buildConfigRow(userId, config, pricing) {
  return {
    userId,
    planType:                config.planType,
    lengthMonths:            config.lengthMonths,
    basePhotos:              BASE_PHOTOS,
    baseVideos:              BASE_VIDEOS,
    extraPhotoPacks:         config.extraPhotoPacks,
    extraVideoPacks:         config.extraVideoPacks,
    audioEnabled:            config.audioEnabled,
    themesEnabled:           config.themesEnabled,
    totalPhotos:             pricing.totalPhotos,
    totalVideos:             pricing.totalVideos,
    basePriceMonthlyPaise:   pricing.baseMonthlyPaise,
    addonPriceMonthlyPaise:  pricing.addonMonthlyPaise,
    totalMonthlyPaise:       pricing.totalMonthlyPaise,
    lengthDiscountPct:       pricing.lengthDiscountPct,
    upfrontDiscountPct:      pricing.upfrontDiscountPct,
    totalChargedPaise:       pricing.totalChargedPaise,
    paymentMode:             config.paymentMode,
  };
}

/**
 * Insert a subscription_configs row and return its id.
 * Called after successful payment verification.
 *
 * @param {Object} row  Output of buildConfigRow()
 * @returns {Promise<string>} New config UUID
 */
async function insertConfigRow(row) {
  const res = await db.query(
    `INSERT INTO subscription_configs (
       user_id, plan_type, length_months,
       base_photos, base_videos,
       extra_photo_packs, extra_video_packs,
       audio_enabled, themes_enabled,
       total_photos, total_videos,
       base_price_monthly_paise, addon_price_monthly_paise,
       total_monthly_paise, length_discount_pct,
       upfront_discount_pct, total_charged_paise,
       payment_mode
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       $11,$12,$13,$14,$15,$16,$17,$18
     ) RETURNING id`,
    [
      row.userId,
      row.planType,
      row.lengthMonths,
      row.basePhotos,
      row.baseVideos,
      row.extraPhotoPacks,
      row.extraVideoPacks,
      row.audioEnabled,
      row.themesEnabled,
      row.totalPhotos,
      row.totalVideos,
      row.basePriceMonthlyPaise,
      row.addonPriceMonthlyPaise,
      row.totalMonthlyPaise,
      row.lengthDiscountPct,
      row.upfrontDiscountPct,
      row.totalChargedPaise,
      row.paymentMode,
    ]
  );
  return res.rows[0].id;
}

// ── Effective limits (respects admin overrides) ───────────────

/**
 * Get the effective limits for a user from their active config.
 * Admin overrides take precedence over config values.
 *
 * @param {Object} configRow  Row from subscription_configs
 * @returns {{ photos: number, videos: number, audioEnabled: boolean, themesEnabled: boolean }}
 */
function getEffectiveLimits(configRow) {
  if (!configRow) return { photos: BASE_PHOTOS, videos: BASE_VIDEOS, audioEnabled: false, themesEnabled: false };
  return {
    photos:        configRow.override_photos  ?? configRow.total_photos,
    videos:        configRow.override_videos  ?? configRow.total_videos,
    audioEnabled:  configRow.override_audio   ?? configRow.audio_enabled,
    themesEnabled: configRow.override_themes  ?? configRow.themes_enabled,
  };
}

/**
 * Get effective expiry for a subscription (admin override takes precedence).
 *
 * @param {Object} subRow        Row from user_subscriptions
 * @param {Object|null} configRow Row from subscription_configs (may be null)
 * @returns {Date|null}
 */
function getEffectiveExpiry(subRow, configRow) {
  if (configRow?.override_expiry) return new Date(configRow.override_expiry);
  if (subRow?.current_period_end)  return new Date(subRow.current_period_end);
  return null;
}

// ── Razorpay helpers ──────────────────────────────────────────

/**
 * Build notes object for Razorpay plan/subscription/order creation.
 * These notes are read back in webhook handlers.
 *
 * @param {string} userId
 * @param {Object} config   Normalised config
 * @returns {Object}
 */
function buildRazorpayNotes(userId, config) {
  return {
    userId,
    planType:     config.planType,
    planSlug:     CUSTOM_SLUG[config.planType],
    lengthMonths: String(config.lengthMonths),
    paymentMode:  config.paymentMode,
    isCustom:     'true',
  };
}

/**
 * Compute current_period_end for upfront payments.
 * Always computed server-side — never trusted from client.
 *
 * @param {number} lengthMonths
 * @returns {Date}
 */
function computePeriodEnd(lengthMonths) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(lengthMonths));
  return d;
}

// ── Formatters ────────────────────────────────────────────────

function formatINR(paise) {
  return '₹' + Math.floor(paise / 100).toLocaleString('en-IN');
}

function lengthLabel(months) {
  if (months === 1)  return '1 Month';
  if (months === 3)  return '3 Months';
  if (months === 6)  return '6 Months';
  if (months === 12) return '1 Year';
  if (months === 24) return '2 Years';
  if (months === 36) return '3 Years';
  if (months === 60) return '5 Years';
  return `${months} Months`;
}

// ── Exports ───────────────────────────────────────────────────

module.exports = {
  // Constants
  VALID_LENGTHS,
  UPFRONT_DISCOUNT_PCT,
  BASE_PHOTOS,
  BASE_VIDEOS,
  PHOTOS_PER_PACK,
  VIDEOS_PER_PACK,
  CUSTOM_SLUG,

  // DB fetchers
  getBasePricingRow,
  getAddonPricingMap,
  fetchPricingData,

  // Core logic
  validateConfig,
  calculatePrice,
  resolvePrice,

  // Config row helpers
  buildConfigRow,
  insertConfigRow,
  getEffectiveLimits,
  getEffectiveExpiry,

  // Razorpay helpers
  buildRazorpayNotes,
  computePeriodEnd,

  // Formatters
  formatINR,
  lengthLabel,
};
