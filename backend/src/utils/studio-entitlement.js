'use strict';
/**
 * studio-entitlement.js
 *
 * Single source of truth for studio plan features.
 * Plan limits come from studio_subscriptions, never from hardcoded UI/controller checks.
 */

const db = require('./db');

// ── Plan feature definitions ──────────────────────────────────
// These mirror what's stored in pricing_plans but are the authoritative
// runtime defaults in case a plan row is missing.
const STUDIO_PLAN_DEFAULTS = {
  'studio-starter': {
    albumQuota:           10,
    seatQuota:            5,
    brandingEnabled:      true,
    customDomainEnabled:  false,
    whitelabelEnabled:    false,
    bulkQrEnabled:        true,
    customizerEnabled:    false,
  },
  'studio-pro': {
    albumQuota:           20,
    seatQuota:            5,
    brandingEnabled:      true,
    customDomainEnabled:  true,
    whitelabelEnabled:    true,
    bulkQrEnabled:        true,
    customizerEnabled:    true,
  },
  'studio-agency': {
    albumQuota:           50,
    seatQuota:            12,
    brandingEnabled:      true,
    customDomainEnabled:  true,
    whitelabelEnabled:    true,
    bulkQrEnabled:        true,
    customizerEnabled:    true,
  },
};

/**
 * Returns the active studio_subscriptions row for a studio,
 * or null if no active subscription exists.
 */
async function getActiveStudioSubscription(studioId) {
  const res = await db.query(
    `SELECT *
     FROM studio_subscriptions
     WHERE studio_id = $1
       AND status IN ('active', 'trialing')
       AND (current_period_end IS NULL OR current_period_end > NOW()
            OR grace_period_until > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [studioId]
  );
  return res.rows[0] || null;
}

/**
 * Returns the full entitlement object for a studio.
 * All feature gates (seat limit, branding, customizer, etc.) come from here.
 */
async function getStudioEntitlement(studioId) {
  const sub = await getActiveStudioSubscription(studioId);

  if (!sub) {
    // No active subscription — return locked defaults
    return {
      hasActiveSub:         false,
      planSlug:             null,
      status:               'inactive',
      albumQuota:           0,
      seatQuota:            0,
      brandingEnabled:      false,
      customDomainEnabled:  false,
      whitelabelEnabled:    false,
      bulkQrEnabled:        false,
      customizerEnabled:    false,
      currentPeriodEnd:     null,
      cancelAtPeriodEnd:    false,
      gracePeriodUntil:     null,
    };
  }

  const planDefaults = STUDIO_PLAN_DEFAULTS[sub.plan_slug] || STUDIO_PLAN_DEFAULTS['studio-starter'];

  return {
    hasActiveSub:         true,
    planSlug:             sub.plan_slug,
    status:               sub.status,
    // subscription row wins; fall back to plan defaults
    albumQuota:           sub.album_quota           ?? planDefaults.albumQuota,
    seatQuota:            sub.seat_quota            ?? planDefaults.seatQuota,
    brandingEnabled:      sub.branding_enabled      ?? planDefaults.brandingEnabled,
    customDomainEnabled:  sub.custom_domain_enabled ?? planDefaults.customDomainEnabled,
    whitelabelEnabled:    sub.whitelabel_enabled    ?? planDefaults.whitelabelEnabled,
    bulkQrEnabled:        planDefaults.bulkQrEnabled,
    customizerEnabled:    sub.whitelabel_enabled
                            ? true
                            : planDefaults.customizerEnabled,
    currentPeriodEnd:     sub.current_period_end,
    cancelAtPeriodEnd:    sub.cancel_at_period_end,
    gracePeriodUntil:     sub.grace_period_until,
    subscriptionId:       sub.id,
    razorpaySubId:        sub.razorpay_subscription_id,
  };
}

/**
 * Middleware-style check: attach entitlement to req and optionally block
 * if the studio has no active subscription.
 * Usage: await requireStudioEntitlement(req, res, next)
 */
async function requireStudioEntitlement(req, res, next) {
  try {
    const entitlement = await getStudioEntitlement(req.studioId);
    req.studioEntitlement = entitlement;

    if (!entitlement.hasActiveSub) {
      return res.status(403).json({
        error: 'No active Studio subscription. Please subscribe to a photographer plan.',
        code:  'STUDIO_NO_SUBSCRIPTION',
        upgradeUrl: '/studio/billing',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Log a studio audit event.
 */
async function logStudioAudit(studioId, userId, action, targetType, targetId, details, ipAddress) {
  try {
    await db.query(
      `INSERT INTO studio_audit_log
         (studio_id, user_id, action, target_type, target_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [studioId, userId || null, action, targetType || null, targetId || null,
       details ? JSON.stringify(details) : null, ipAddress || null]
    );
  } catch (err) {
    console.error('[STUDIO_AUDIT] Failed to write audit log:', err.message);
  }
}

/**
 * Log a studio usage event.
 */
async function logStudioUsage(studioId, eventType, details) {
  try {
    await db.query(
      `INSERT INTO studio_usage_events (studio_id, event_type, details)
       VALUES ($1,$2,$3)`,
      [studioId, eventType, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[STUDIO_USAGE] Failed to write usage event:', err.message);
  }
}

module.exports = {
  STUDIO_PLAN_DEFAULTS,
  getActiveStudioSubscription,
  getStudioEntitlement,
  requireStudioEntitlement,
  logStudioAudit,
  logStudioUsage,
};
