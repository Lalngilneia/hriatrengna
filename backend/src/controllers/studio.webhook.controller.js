'use strict';
/**
 * studio.webhook.controller.js
 *
 * Handles order-based Razorpay webhook events for studio subscriptions.
 */

const db = require('../utils/db');
const {
  STUDIO_PLAN_DEFAULTS,
  logStudioAudit,
  logStudioUsage,
} = require('../utils/studio-entitlement');

const toINR = p => (p / 100).toFixed(2);

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

async function activateStudioOrderById(orderId, paymentEntity = null) {
  const subRes = await db.query(
    `SELECT ss.id, ss.studio_id, ss.plan_slug, ss.current_period_end,
            pp.interval, pp.interval_count
     FROM studio_subscriptions ss
     LEFT JOIN pricing_plans pp ON pp.slug = ss.plan_slug
     WHERE ss.razorpay_order_id = $1
     ORDER BY ss.created_at DESC
     LIMIT 1`,
    [orderId]
  );

  if (!subRes.rows.length) return null;

  const sub = subRes.rows[0];
  const intervalMonths = sub.interval === 'yearly'
    ? Number(sub.interval_count || 1) * 12
    : Number(sub.interval_count || 1);
  const baseline = sub.current_period_end && new Date(sub.current_period_end) > new Date()
    ? new Date(sub.current_period_end)
    : new Date();
  const currentPeriodEnd = addMonths(baseline, intervalMonths);
  const defaults = STUDIO_PLAN_DEFAULTS[sub.plan_slug] || STUDIO_PLAN_DEFAULTS['studio-starter'];

  const result = await db.query(
    `UPDATE studio_subscriptions SET
       status               = 'active',
       current_period_end   = $1,
       cancel_at_period_end = FALSE,
       album_quota          = $2,
       seat_quota           = $3,
       branding_enabled     = $4,
       custom_domain_enabled = $5,
       whitelabel_enabled   = $6,
       updated_at           = NOW()
     WHERE id = $7
     RETURNING studio_id, plan_slug`,
    [currentPeriodEnd,
     defaults.albumQuota, defaults.seatQuota,
     defaults.brandingEnabled, defaults.customDomainEnabled, defaults.whitelabelEnabled,
     sub.id]
  );

  if (result.rows.length) {
    const { studio_id } = result.rows[0];
    // Sync studios.album_quota to reflect new entitlement
    await db.query(
      'UPDATE studios SET album_quota = $1 WHERE id = $2',
      [defaults.albumQuota, studio_id]
    );
    await logStudioAudit(studio_id, null, 'billing_webhook_activated',
      'subscription', sub.id, { planSlug: sub.plan_slug, currentPeriodEnd }, null);
    await logStudioUsage(studio_id, 'subscription_activated', { planSlug: sub.plan_slug });

    if (paymentEntity) {
      await db.query(
        `INSERT INTO transactions
           (user_id, razorpay_payment_id, razorpay_order_id,
            amount_paise, amount_inr, status, plan, payment_method, description, raw_payload)
         SELECT s.owner_user_id, $1, $2, $3, $4, 'captured', $5, $6,
                'Studio subscription payment', $7
         FROM studios s
         WHERE s.id = $8
         ON CONFLICT (razorpay_payment_id) DO NOTHING`,
        [
          paymentEntity.id,
          orderId,
          paymentEntity.amount,
          toINR(paymentEntity.amount),
          sub.plan_slug,
          paymentEntity.method,
          JSON.stringify(paymentEntity),
          studio_id,
        ]
      );
    }
  }
  return result.rows[0] || null;
}

async function markStudioOrderFailed(orderId, graceDays = 30) {
  const gracePeriodUntil = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);

  const result = await db.query(
    `UPDATE studio_subscriptions SET
       status             = 'past_due',
       grace_period_until = $1,
       updated_at         = NOW()
     WHERE razorpay_order_id = $2
     RETURNING studio_id`,
    [gracePeriodUntil, orderId]
  );

  if (result.rows.length) {
    const { studio_id } = result.rows[0];
    await logStudioAudit(studio_id, null, 'billing_webhook_payment_failed',
      'subscription', orderId, { gracePeriodUntil }, null);
    await logStudioUsage(studio_id, 'subscription_payment_failed', {});
  }
}

exports.handleStudioOrderCaptured = async (paymentEntity) => {
  if (!paymentEntity?.order_id) return null;
  return activateStudioOrderById(paymentEntity.order_id, paymentEntity);
};

exports.handleStudioPaymentFailed = async (paymentEntity) => {
  if (!paymentEntity?.order_id) return null;
  return markStudioOrderFailed(paymentEntity.order_id, 30);
};
