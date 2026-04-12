'use strict';
/**
 * studio.billing.controller.js
 *
 * Studio-scoped subscription billing via Razorpay.
 * Uses studio_subscriptions table — NOT users.subscription_plan.
 *
 * Routes:
 *   GET  /api/studio/billing/plans    — list studio pricing plans (public)
 *   GET  /api/studio/billing/status   — current studio entitlement
 *   POST /api/studio/billing/subscribe  — create Razorpay subscription
 *   POST /api/studio/billing/verify     — verify payment + activate
 *   POST /api/studio/billing/cancel     — cancel at period end
 */

const Razorpay = require('razorpay');
const crypto   = require('crypto');
const db       = require('../utils/db');
const {
  getStudioEntitlement,
  logStudioAudit,
  logStudioUsage,
} = require('../utils/studio-entitlement');

const getRazorpay = () => new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const toINR = p => (p / 100).toFixed(2);

const normalizeRazorpayError = (err) => {
  if (err instanceof Error) return err;
  const msg = err?.error?.description || err?.description || JSON.stringify(err);
  const e = new Error('Razorpay: ' + msg);
  e.status = err?.statusCode || 502;
  return e;
};

// ── GET /api/studio/billing/plans (public) ────────────────────
exports.getStudioPlans = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, product_type, price_inr, interval, interval_count,
              features, max_albums, is_featured, sort_order
       FROM pricing_plans
       WHERE product_type = 'studio_photographer' AND is_active = TRUE
       ORDER BY sort_order`
    );
    res.json({
      plans: result.rows.map(p => ({
        ...p,
        price_display:     '₹' + Math.floor(p.price_inr / 100).toLocaleString('en-IN'),
        price_inr_decimal: p.price_inr / 100,
      })),
    });
  } catch (err) { next(err); }
};

// ── GET /api/studio/billing/status ────────────────────────────
exports.getBillingStatus = async (req, res, next) => {
  try {
    const entitlement = await getStudioEntitlement(req.studioId);
    const subsRes = await db.query(
      `SELECT * FROM studio_subscriptions
       WHERE studio_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [req.studioId]
    );

    // Seat usage
    const seatRes = await db.query(
      'SELECT COUNT(*)::int AS count FROM studio_members WHERE studio_id = $1',
      [req.studioId]
    );

    res.json({
      ...entitlement,
      seatsUsed:     seatRes.rows[0].count,
      albumsUsed:    req.studio.albums_used,
      subscriptions: subsRes.rows,
      studios:       req.userStudios,
    });
  } catch (err) { next(err); }
};


// Order-based overrides for studio billing endpoints.
exports.createSubscription = async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan is required.' });

    const planRes = await db.query(
      `SELECT * FROM pricing_plans
       WHERE slug = $1 AND product_type = 'studio_photographer' AND is_active = TRUE`,
      [plan]
    );
    if (!planRes.rows.length) {
      return res.status(400).json({ error: 'Invalid or inactive studio plan.' });
    }

    const pricingPlan = planRes.rows[0];
    const ownerRes = await db.query(
      'SELECT u.* FROM users u JOIN studios s ON s.owner_user_id = u.id WHERE s.id = $1',
      [req.studioId]
    );
    const owner = ownerRes.rows[0];
    const { STUDIO_PLAN_DEFAULTS } = require('../utils/studio-entitlement');
    const defaults = STUDIO_PLAN_DEFAULTS[plan] || STUDIO_PLAN_DEFAULTS['studio-starter'];

    const razorpay = getRazorpay();
    const receipt = `studio-${String(req.studioId).slice(0, 8)}-${Date.now()}`;
    const order = await razorpay.orders.create({
      amount: pricingPlan.price_inr,
      currency: 'INR',
      receipt,
      notes: {
        studioId: req.studioId,
        plan,
        productType: 'studio_photographer',
      },
    });

    const subRes = await db.query(
      `INSERT INTO studio_subscriptions
         (studio_id, plan_slug, status, razorpay_subscription_id, razorpay_order_id,
          album_quota, seat_quota, branding_enabled, custom_domain_enabled, whitelabel_enabled)
       VALUES ($1, $2, 'pending', NULL, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        req.studioId,
        plan,
        order.id,
        defaults.albumQuota,
        defaults.seatQuota,
        defaults.brandingEnabled,
        defaults.customDomainEnabled,
        defaults.whitelabelEnabled,
      ]
    );

    await logStudioAudit(req.studioId, req.userId, 'billing_subscribe_initiated',
      'plan', plan, { orderId: order.id, studioSubscriptionId: subRes.rows[0].id }, req.ip);

    res.json({
      orderId: order.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: pricingPlan.price_inr,
      currency: 'INR',
      plan: pricingPlan,
      customer: { name: owner?.name || '', email: owner?.email || '', contact: owner?.phone || '' },
    });
  } catch (err) { next(normalizeRazorpayError(err)); }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
    }

    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment verification failed. Order mismatch.' });
    }

    if (payment.notes?.studioId && payment.notes.studioId !== req.studioId) {
      return res.status(403).json({ error: 'Payment does not belong to this studio.' });
    }

    if (payment.status === 'captured') {
      const subRes = await db.query(
        `SELECT id, status, current_period_end
         FROM studio_subscriptions
         WHERE studio_id = $1
           AND razorpay_order_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.studioId, razorpay_order_id]
      );

      const current = subRes.rows[0];
      if (current?.status === 'active') {
        return res.json({
          message: 'Payment already confirmed.',
          status: 'active',
          subscriptionId: current.id,
          currentPeriodEnd: current.current_period_end,
        });
      }
    }

    res.json({
      message: 'Payment signature verified. Waiting for webhook confirmation.',
      status: payment.status || 'pending',
    });
  } catch (err) { next(normalizeRazorpayError(err)); }
};

exports.cancelSubscription = async (req, res, next) => {
  try {
    const subRes = await db.query(
      `SELECT * FROM studio_subscriptions
       WHERE studio_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [req.studioId]
    );
    if (!subRes.rows.length) {
      return res.status(404).json({ error: 'No active studio subscription found.' });
    }

    await db.query(
      `UPDATE studio_subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [subRes.rows[0].id]
    );

    await logStudioAudit(req.studioId, req.userId, 'billing_cancelled',
      'subscription', subRes.rows[0].id, {}, req.ip);

    res.json({ message: 'Studio subscription will cancel at the end of the billing period.' });
  } catch (err) { next(err); }
};
