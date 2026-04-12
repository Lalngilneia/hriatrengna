'use strict';
/**
 * payment.controller.js
 *
 * Handles all consumer payment flows:
 *   - Pricing options & live price calculation
 *   - Custom subscription creation (monthly billing via Razorpay Subscription)
 *   - Custom order creation (upfront billing via Razorpay Order)
 *   - Payment verification for both modes
 *   - Physical QR / NFC orders
 *   - Subscription cancellation
 *   - Subscription status
 *   - Razorpay webhook handler
 *   - Invoices, refunds (unchanged from original)
 *
 * All pricing math is delegated to pricing-engine.js.
 * Studio billing is handled separately in studio.billing.controller.js.
 */

const Razorpay       = require('razorpay');
const crypto         = require('crypto');
const db             = require('../utils/db');
const invoiceService = require('../services/invoice.service');
const emailService   = require('../services/email.service');
const { recordCommission }    = require('./affiliate.controller');
const { getPlanContextForType } = require('../utils/plan-access');
const subscriptionService = require('../services/subscription.service');
const engine = require('../utils/pricing-engine');

// Ã¢â€â‚¬Ã¢â€â‚¬ Razorpay instance Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const getRazorpay = () => new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Shared helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const toINR = (paise) => (paise / 100).toFixed(2);

const normalizeRazorpayError = (err) => {
  if (err instanceof Error) return err;
  const msg = err?.error?.description || err?.description || JSON.stringify(err);
  const e   = new Error('Razorpay: ' + msg);
  e.status  = err?.statusCode || 502;
  return e;
};

const isNoBillingCycleCancelError = (err) => {
  const message = err?.error?.description || err?.description || err?.message || '';
  return /no billing cycle is going on/i.test(message);
};

const isMissingRazorpayEntityError = (err) => {
  const message = err?.error?.description || err?.description || err?.message || '';
  return /id provided does not exist|does not exist/i.test(message);
};

const toPaiseFromInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
};

const REFUND_ACTIVE_STATUSES = ['requested', 'approved', 'processing', 'processed'];

async function applyReferralCodeIfNeeded(userId, referralCode, affiliateId) {
  if (!referralCode || affiliateId) return;

  try {
    const refCode = String(referralCode).trim().toUpperCase();
    const affRes = await db.query(
      "SELECT id FROM affiliates WHERE referral_code = $1 AND status = 'active'",
      [refCode]
    );

    if (!affRes.rows.length) return;

    await db.query(
      `UPDATE users SET
         affiliate_id       = COALESCE(affiliate_id, $1),
         referral_code_used = COALESCE(referral_code_used, $2)
       WHERE id = $3`,
      [affRes.rows[0].id, refCode, userId]
    );
  } catch (err) {
    console.warn('[PAYMENT] Referral code resolution failed:', err.message);
  }
}

async function persistPendingUserSubscription({
  userId,
  planSlug,
  planType,
  razorpaySubscriptionId,
}) {
  const existing = await db.query(
    `SELECT id
     FROM user_subscriptions
     WHERE razorpay_subscription_id = $1
     LIMIT 1`,
    [razorpaySubscriptionId]
  );

  if (existing.rows.length) {
    await db.query(
      `UPDATE user_subscriptions SET
         user_id    = $1,
         plan_slug  = $2,
         plan_type  = $3,
         status     = 'pending',
         updated_at = NOW()
       WHERE id = $4`,
      [userId, planSlug, planType, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const inserted = await db.query(
    `INSERT INTO user_subscriptions
       (user_id, plan_slug, plan_type, status, razorpay_subscription_id,
        album_quota, payment_mode)
     VALUES ($1, $2, $3, 'pending', $4, 1, 'monthly')
     RETURNING id`,
    [userId, planSlug, planType, razorpaySubscriptionId]
  );

  return inserted.rows[0].id;
}

async function activateUserSubscription({
  userId,
  planSlug,
  planType,
  paymentMode,
  razorpaySubscriptionId = null,
  razorpayOrderId = null,
  currentPeriodEnd,
  configId,
}) {
  const lookupColumn = paymentMode === 'monthly'
    ? 'razorpay_subscription_id'
    : 'razorpay_order_id';
  const lookupValue = paymentMode === 'monthly'
    ? razorpaySubscriptionId
    : razorpayOrderId;

  if (!lookupValue) {
    throw new Error(`Missing ${lookupColumn} for ${paymentMode} subscription activation.`);
  }

  const existing = await db.query(
    `SELECT id
     FROM user_subscriptions
     WHERE ${lookupColumn} = $1
     LIMIT 1`,
    [lookupValue]
  );

  const applySubscriptionUpdate = async (subscriptionId) => {
    await db.query(
      `UPDATE user_subscriptions SET
         user_id                  = $1,
         plan_slug                = $2,
         plan_type                = $3,
         status                   = 'active',
         album_quota              = 1,
         current_period_end       = $4,
         cancel_at_period_end     = FALSE,
         config_id                = COALESCE(config_id, $5),
         payment_mode             = $6,
         razorpay_subscription_id = COALESCE($7, razorpay_subscription_id),
         razorpay_order_id        = COALESCE($8, razorpay_order_id),
         updated_at               = NOW()
       WHERE id = $9`,
      [
        userId,
        planSlug,
        planType,
        currentPeriodEnd,
        configId,
        paymentMode,
        razorpaySubscriptionId,
        razorpayOrderId,
        subscriptionId,
      ]
    );
  };

  if (existing.rows.length) {
    await applySubscriptionUpdate(existing.rows[0].id);
    return existing.rows[0].id;
  }

  const currentActive = await db.query(
    `SELECT id
     FROM user_subscriptions
     WHERE user_id = $1
       AND plan_type = $2
       AND status IN ('active', 'trialing')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, planType]
  );

  if (currentActive.rows.length) {
    console.warn(`[PAYMENT] Reusing active ${planType} subscription row ${currentActive.rows[0].id} for user ${userId}.`);
    await applySubscriptionUpdate(currentActive.rows[0].id);
    return currentActive.rows[0].id;
  }

  const inserted = await db.query(
    `INSERT INTO user_subscriptions
       (user_id, plan_slug, plan_type, status, razorpay_subscription_id,
        razorpay_order_id, album_quota, current_period_end, cancel_at_period_end,
        config_id, payment_mode)
     VALUES ($1,$2,$3,'active',$4,$5,1,$6,FALSE,$7,$8)
     RETURNING id`,
    [
      userId,
      planSlug,
      planType,
      razorpaySubscriptionId,
      razorpayOrderId,
      currentPeriodEnd,
      configId,
      paymentMode,
    ]
  );

  return inserted.rows[0].id;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Refresh user subscription state (unchanged logic) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Keeps the denormalised columns on `users` in sync after any change.

async function refreshUserSubscriptionState(userId) {
  const [memorialContext, weddingContext, subsRes] = await Promise.all([
    getPlanContextForType(userId, 'memorial'),
    getPlanContextForType(userId, 'wedding'),
    db.query(
      `SELECT status, plan_slug, plan_type, cancel_at_period_end, current_period_end
       FROM user_subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    ),
  ]);

  const allSubs    = subsRes.rows;
  const activeSubs = allSubs.filter((s) => ['active', 'trialing'].includes(s.status));

  let subscriptionStatus = 'inactive';
  if (activeSubs.length)                                                          subscriptionStatus = 'active';
  else if (allSubs.some((s) => s.status === 'past_due'))                         subscriptionStatus = 'past_due';
  else if (allSubs.some((s) => s.status === 'halted'))                           subscriptionStatus = 'halted';
  else if (allSubs.some((s) => ['canceled','cancelled','completed'].includes(s.status))) subscriptionStatus = 'canceled';

  const primaryPlan = memorialContext.planSlug || weddingContext.planSlug || allSubs[0]?.plan_slug || null;
  const currentPeriodEnd = [
    memorialContext.subscription?.current_period_end,
    weddingContext.subscription?.current_period_end,
  ].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;

  const cancelAtPeriodEnd = activeSubs.length > 0 && activeSubs.every((s) => Boolean(s.cancel_at_period_end));
  const legacyAlbumQuota  = memorialContext.albumQuota ?? weddingContext.albumQuota ?? null;

  await db.query(
    `UPDATE users SET
       subscription_status  = $1,
       subscription_plan    = $2,
       current_period_end   = $3,
       cancel_at_period_end = $4,
       memorial_plan        = $5,
       wedding_plan         = $6,
       album_quota          = COALESCE($7, album_quota)
     WHERE id = $8`,
    [
      subscriptionStatus, primaryPlan, currentPeriodEnd, cancelAtPeriodEnd,
      memorialContext.planSlug, weddingContext.planSlug, legacyAlbumQuota, userId,
    ]
  );

  return { subscriptionStatus, memorialContext, weddingContext };
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Get/create Razorpay customer (unchanged) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function getOrCreateCustomer(user, razorpay) {
  if (user.razorpay_customer_id) {
    try {
      const existing = await razorpay.customers.fetch(user.razorpay_customer_id);
      if (existing?.id) return existing.id;
    } catch (err) {
      if (!isMissingRazorpayEntityError(err)) throw err;
      console.warn(`[PAYMENT] Stored Razorpay customer ${user.razorpay_customer_id} is invalid for current key mode. Recreating for user ${user.id}.`);
      await db.query('UPDATE users SET razorpay_customer_id = NULL WHERE id = $1', [user.id]);
    }
  }

  try {
    const customer = await razorpay.customers.create({
      name: user.name, email: user.email, contact: user.phone || '',
    });
    await db.query('UPDATE users SET razorpay_customer_id = $1 WHERE id = $2', [customer.id, user.id]);
    return customer.id;
  } catch (err) {
    const desc = err?.error?.description || '';
    if (desc.includes('already exists')) {
      const list     = await razorpay.customers.all({ email: user.email });
      const existing = list?.items?.[0];
      if (existing) {
        await db.query('UPDATE users SET razorpay_customer_id = $1 WHERE id = $2', [existing.id, user.id]);
        return existing.id;
      }
    }
    throw err;
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Post-payment invoice + commission helper Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

async function issueInvoiceAndCommission(userId, transactionId, amountPaise, planSlug) {
  try {
    const userInfo = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const invoice  = await invoiceService.createInvoiceRecord({
      userId, transactionId,
      amountInr:  toINR(amountPaise),
      plan:       planSlug,
      userName:   userInfo.rows[0]?.name,
      userEmail:  userInfo.rows[0]?.email,
    });
    if (invoice && userInfo.rows[0]?.email) {
      const pdf = await invoiceService.generateInvoicePDF(invoice);
      await emailService.sendInvoice(
        { id: userId, name: userInfo.rows[0]?.name || 'Customer', email: userInfo.rows[0].email },
        invoice, pdf
      );
    }
    await recordCommission({ userId, transactionId, amountInr: toINR(amountPaise) });
  } catch (err) {
    console.error('[PAYMENT] Invoice/commission failed:', err.message);
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PUBLIC Ã¢â‚¬â€ PRICING OPTIONS
// GET /api/payment/pricing-options?type=memorial
// Returns base_pricing rows + addon_pricing for the configurator UI.
// No auth required Ã¢â‚¬â€ pricing is public.
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

exports.getPricingOptions = async (req, res, next) => {
  try {
    const planType = req.query.type === 'wedding' ? 'wedding' : 'memorial';

    const [baseRows, addonRows] = await Promise.all([
      db.query(
        `SELECT plan_type, length_months, discount_pct, monthly_rate_paise
         FROM base_pricing
         WHERE plan_type = $1 AND is_active = TRUE
         ORDER BY length_months`,
        [planType]
      ),
      db.query(
        `SELECT key, label, price_paise, unit, is_recurring
         FROM addon_pricing
         WHERE is_active = TRUE
         ORDER BY is_recurring DESC, key`
      ),
    ]);

    // Shape base rows into a map keyed by length_months for easy frontend use
    const basePricing = baseRows.rows.map((r) => ({
      lengthMonths:     r.length_months,
      discountPct:      Number(r.discount_pct),
      monthlyRatePaise: r.monthly_rate_paise,
      monthlyRateInr:   r.monthly_rate_paise / 100,
      label:            engine.lengthLabel(r.length_months),
    }));

    const addons = addonRows.rows.map((r) => ({
      key:         r.key,
      label:       r.label,
      pricePaise:  r.price_paise,
      priceInr:    r.price_paise / 100,
      unit:        r.unit,
      isRecurring: r.is_recurring,
    }));

    res.json({
      planType,
      basePhotos:          engine.BASE_PHOTOS,
      baseVideos:          engine.BASE_VIDEOS,
      photosPerPack:       engine.PHOTOS_PER_PACK,
      videosPerPack:       engine.VIDEOS_PER_PACK,
      upfrontDiscountPct:  engine.UPFRONT_DISCOUNT_PCT,
      basePricing,
      addons,
    });
  } catch (err) { next(err); }
};

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PUBLIC Ã¢â‚¬â€ CALCULATE PRICE (live preview, no payment created)
// POST /api/payment/calculate
// Body: { planType, lengthMonths, extraPhotoPacks, extraVideoPacks,
//         audioEnabled, themesEnabled, paymentMode }
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

exports.calculatePrice = async (req, res, next) => {
  try {
    const result = await engine.resolvePrice(req.body);
    if (result.error) return res.status(400).json({ error: result.error });

    const { pricing, config } = result;
    res.json({
      config,
      pricing: pricing.display,
      totalChargedPaise: pricing.totalChargedPaise,
      totalMonthlyPaise: pricing.totalMonthlyPaise,
      totalPhotos:       pricing.totalPhotos,
      totalVideos:       pricing.totalVideos,
    });
  } catch (err) { next(err); }
};

exports.createPhysicalOrder = async (req, res, next) => {
  try {
    const { albumId, orderType, shippingAddress } = req.body;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Validate orderType Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (!['qr_print', 'nfc_tag'].includes(orderType))
      return res.status(400).json({ error: 'orderType must be "qr_print" or "nfc_tag".' });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Validate shippingAddress Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const required = ['name', 'phone', 'address1', 'city', 'state', 'pincode'];
    const missing  = required.filter((f) => !shippingAddress?.[f]?.toString().trim());
    if (missing.length)
      return res.status(400).json({ error: `Missing shipping fields: ${missing.join(', ')}.` });

    // Pincode: 6-digit Indian postal code
    if (!/^\d{6}$/.test(shippingAddress.pincode.toString().trim()))
      return res.status(400).json({ error: 'Invalid pincode. Must be a 6-digit number.' });

    // Phone: basic Indian format
    if (!/^[6-9]\d{9}$/.test(shippingAddress.phone.toString().trim()))
      return res.status(400).json({ error: 'Invalid phone number.' });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Verify albumId belongs to this user (optional but recommended) Ã¢â€â‚¬
    if (albumId) {
      const albumCheck = await db.query(
        'SELECT id FROM albums WHERE id = $1 AND user_id = $2', [albumId, req.userId]
      );
      if (!albumCheck.rows.length)
        return res.status(404).json({ error: 'Album not found.' });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Fetch price from addon_pricing Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const addonKey = orderType; // 'qr_print' or 'nfc_tag'
    const addonRes = await db.query(
      'SELECT price_paise FROM addon_pricing WHERE key = $1 AND is_active = TRUE', [addonKey]
    );
    if (!addonRes.rows.length)
      return res.status(500).json({ error: 'Physical order pricing not configured. Contact support.' });
    const amountPaise = addonRes.rows[0].price_paise;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Load user Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const userRes = await db.query(
      'SELECT name, email, phone FROM users WHERE id = $1', [req.userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Create Razorpay Order Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const razorpay = getRazorpay();
    const receipt  = `phys-${orderType[0]}-${req.userId.substring(0, 8)}-${Date.now()}`;

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          userId:    req.userId,
          orderType,
          albumId:   albumId || '',
          isPhysical: 'true',
        },
      });
    } catch (orderErr) {
      throw normalizeRazorpayError(orderErr);
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Create pending physical_orders row Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const addr = shippingAddress;
    await db.query(
      `INSERT INTO physical_orders
         (user_id, album_id, order_type, amount_paise, razorpay_order_id,
          shipping_name, shipping_phone, shipping_address_1, shipping_address_2,
          shipping_city, shipping_state, shipping_pincode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        req.userId,
        albumId || null,
        orderType,
        amountPaise,
        rzpOrder.id,
        addr.name.trim(),
        addr.phone.trim(),
        addr.address1.trim(),
        addr.address2?.trim() || null,
        addr.city.trim(),
        addr.state.trim(),
        addr.pincode.toString().trim(),
      ]
    );

    res.json({
      orderId:       rzpOrder.id,
      amount:        amountPaise,
      currency:      'INR',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      orderType,
      customer:      { name: user.name, email: user.email, contact: user.phone || '' },
    });
  } catch (err) { next(normalizeRazorpayError(err)); }
};

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PROTECTED Ã¢â‚¬â€ VERIFY PHYSICAL PAYMENT
// POST /api/payment/verify-physical
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

exports.verifyPhysicalPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ error: 'Missing verification fields.' });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Verify signature Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ error: 'Physical payment verification failed. Signature mismatch.' });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Look up physical_orders row Ã¢â‚¬â€ must belong to this user Ã¢â€â‚¬
    const orderRes = await db.query(
      `SELECT * FROM physical_orders
       WHERE razorpay_order_id = $1 AND user_id = $2`,
      [razorpay_order_id, req.userId]
    );
    if (!orderRes.rows.length)
      return res.status(404).json({ error: 'Physical order not found.' });

    const physOrder = orderRes.rows[0];

    // Idempotency: already paid
    if (physOrder.payment_status === 'paid')
      return res.json({ message: 'Order already confirmed.', orderId: physOrder.id });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Fetch payment for amount verification Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const razorpay = getRazorpay();
    const payment  = await razorpay.payments.fetch(razorpay_payment_id);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Mark paid Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    await db.query(
      `UPDATE physical_orders SET
         razorpay_payment_id = $1,
         payment_status      = 'paid',
         updated_at          = NOW()
       WHERE id = $2`,
      [razorpay_payment_id, physOrder.id]
    );

    // Ã¢â€â‚¬Ã¢â€â‚¬ Transaction record Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const txResult = await db.query(
      `INSERT INTO transactions
         (user_id, razorpay_payment_id, razorpay_order_id,
          amount_paise, amount_inr, status, plan, payment_method, description, raw_payload)
       VALUES ($1,$2,$3,$4,$5,'captured','physical',$6,$7,$8)
       ON CONFLICT (razorpay_payment_id) DO NOTHING RETURNING id`,
      [
        req.userId,
        razorpay_payment_id,
        razorpay_order_id,
        payment.amount,
        toINR(payment.amount),
        payment.method,
        `Physical ${physOrder.order_type === 'nfc_tag' ? 'NFC Tag' : 'QR Print'} Order`,
        JSON.stringify(payment),
      ]
    );

    // Ã¢â€â‚¬Ã¢â€â‚¬ Notify admin (fire-and-forget) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    try {
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
      if (adminEmail) {
        const u = (await db.query('SELECT name, email FROM users WHERE id = $1', [req.userId])).rows[0];
        await emailService.sendAdminNotification?.({
          to:      adminEmail,
          subject: `New Physical Order: ${physOrder.order_type}`,
          body:    `User: ${u?.name} (${u?.email})\nType: ${physOrder.order_type}\nAmount: Ã¢â€šÂ¹${toINR(payment.amount)}\nShip to: ${physOrder.shipping_address_1}, ${physOrder.shipping_city}, ${physOrder.shipping_pincode}`,
        });
      }
    } catch (_) {}

    res.json({
      message:   'Physical order confirmed! We will ship within 5Ã¢â‚¬â€œ7 business days.',
      orderId:   physOrder.id,
      orderType: physOrder.order_type,
    });
  } catch (err) { next(normalizeRazorpayError(err)); }
};

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PROTECTED Ã¢â‚¬â€ GET USER'S PHYSICAL ORDERS
// GET /api/payment/physical-orders
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

exports.getUserPhysicalOrders = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, order_type, amount_paise, payment_status, fulfillment_status,
              tracking_number, tracking_carrier, shipped_at, delivered_at,
              shipping_name, shipping_city, shipping_state, shipping_pincode,
              album_id, created_at
       FROM physical_orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({
      orders: result.rows.map((r) => ({
        ...r,
        amount_inr: r.amount_paise / 100,
      })),
    });
  } catch (err) { next(err); }
};

exports.createCustomSubscription = async (req, res, next) => {
  try {
    const { referralCode, ...configInput } = req.body;
    const result = await engine.resolvePrice({ ...configInput, paymentMode: 'monthly' });
    if (result.error) return res.status(400).json({ error: result.error });

    const { pricing, config } = result;
    const userRes = await db.query(
      'SELECT id, name, email, phone, affiliate_id FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await applyReferralCodeIfNeeded(req.userId, referralCode, user.affiliate_id);

    const payload = await subscriptionService.createConsumerOrder({
      userId: req.userId,
      user,
      config,
      pricing,
      paymentMode: 'monthly',
    });

    res.json(payload);
  } catch (err) { next(normalizeRazorpayError(err)); }
};

exports.createCustomOrder = async (req, res, next) => {
  try {
    const { referralCode, ...configInput } = req.body;
    const result = await engine.resolvePrice({ ...configInput, paymentMode: 'upfront' });
    if (result.error) return res.status(400).json({ error: result.error });

    const { pricing, config } = result;
    const userRes = await db.query(
      'SELECT id, name, email, phone, affiliate_id FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await applyReferralCodeIfNeeded(req.userId, referralCode, user.affiliate_id);

    const payload = await subscriptionService.createConsumerOrder({
      userId: req.userId,
      user,
      config,
      pricing,
      paymentMode: 'upfront',
    });

    res.json(payload);
  } catch (err) { next(normalizeRazorpayError(err)); }
};

exports.verifyCustomPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment verification payload.' });
    }

    const valid = subscriptionService.verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!valid) {
      return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
    }

    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Payment verification failed. Order mismatch.' });
    }

    const notesUserId = payment.notes?.userId;
    if (notesUserId && notesUserId !== req.userId) {
      return res.status(403).json({ error: 'Payment verification failed. Ownership mismatch.' });
    }

    if (payment.status === 'captured') {
      const paymentRes = await db.query(
        `SELECT p.status AS payment_status,
                s.id AS subscription_id,
                s.status AS subscription_status,
                s.next_billing_date
         FROM payments p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE p.razorpay_order_id = $1
         ORDER BY p.created_at DESC
         LIMIT 1`,
        [razorpay_order_id]
      );

      const current = paymentRes.rows[0];
      if (current?.payment_status === 'success' && current?.subscription_status === 'active') {
        return res.json({
          message: 'Payment already confirmed.',
          status: 'active',
          subscriptionId: current.subscription_id,
          nextBillingDate: current.next_billing_date,
        });
      }

      // ── Failsafe activation ─────────────────────────────────────────────────
      // Razorpay confirms capture but our DB is not yet active. This means the
      // payment.captured webhook either hasn't arrived yet or failed (e.g. the
      // signature mismatch / outer-join bugs that existed previously).
      // We call confirmCapturedPayment() here so the subscription activates
      // immediately for the user. The function is fully idempotent — a subsequent
      // webhook call will safely no-op via the duplicate-payment check.
      console.log('[verifyCustomPayment] Razorpay shows captured but DB not active — running failsafe activation for order:', razorpay_order_id);
      try {
        const result = await subscriptionService.confirmCapturedPayment({
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          paymentEntity: payment,
        });
        if (result?.handled) {
          console.log('[verifyCustomPayment] Failsafe activation succeeded for user:', req.userId);
          return res.json({
            message: 'Payment confirmed and subscription activated.',
            status: 'active',
            subscriptionId: result.subscriptionId,
            nextBillingDate: result.nextBillingDate,
          });
        }
      } catch (activationErr) {
        // Log but do not fail the verify response — webhook may still arrive.
        console.error('[verifyCustomPayment] Failsafe activation error:', activationErr.message);
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
    const { subscriptionId = null, planType = 'memorial' } = req.body || {};

    let subs = [];
    if (subscriptionId) {
      const subRes = await db.query(
        `SELECT * FROM user_subscriptions
         WHERE user_id = $1 AND id = $2 AND status = 'active'`,
        [req.userId, subscriptionId]
      );
      subs = subRes.rows;
      if (!subs.length) return res.status(404).json({ error: 'Active subscription not found.' });
    } else {
      const subRes = await db.query(
        `SELECT * FROM user_subscriptions
         WHERE user_id = $1 AND plan_type = $2 AND status = 'active'`,
        [req.userId, planType]
      );
      subs = subRes.rows;
      if (!subs.length) return res.status(400).json({ error: `No active ${planType} subscription found.` });
    }

    if (subscriptionId) {
      await db.query(
        `UPDATE user_subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW()
         WHERE user_id = $1 AND id = $2 AND status = 'active'`,
        [req.userId, subscriptionId]
      );
    } else {
      await db.query(
        `UPDATE user_subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW()
         WHERE user_id = $1 AND plan_type = $2 AND status = 'active'`,
        [req.userId, planType]
      );
    }

    const internalIds = subs.map((sub) => sub.billing_subscription_id).filter(Boolean);
    if (internalIds.length) {
      await db.query(
        `UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [internalIds]
      );
    }

    await refreshUserSubscriptionState(req.userId);

    res.json({
      message: subscriptionId
        ? 'Subscription will cancel at the end of the current billing period.'
        : 'Subscriptions will cancel at the end of the current billing period.',
      cancelledCount: subs.length,
      cancelledSubscriptionIds: subs.map((sub) => sub.id),
    });
  } catch (err) { next(normalizeRazorpayError(err)); }
};

exports.renewSubscription = async (req, res, next) => {
  try {
    const payload = await subscriptionService.createRenewalOrder({
      userId: req.userId,
      subscriptionId: req.params.id,
    });
    res.json(payload);
  } catch (err) { next(normalizeRazorpayError(err)); }
};

exports.status = async (req, res, next) => {
  try {
    const [subsRes, albumCountRes, userRes, physicalRes] = await Promise.all([
      db.query(
        `SELECT us.*, sc.total_photos, sc.total_videos, sc.audio_enabled,
                sc.themes_enabled, sc.length_months, sc.payment_mode AS config_payment_mode,
                sc.extra_photo_packs, sc.extra_video_packs,
                sc.override_photos, sc.override_videos, sc.override_expiry
         FROM user_subscriptions us
         LEFT JOIN subscription_configs sc ON sc.id = us.config_id
         WHERE us.user_id = $1
         ORDER BY us.created_at DESC`,
        [req.userId]
      ),
      db.query('SELECT COUNT(*)::int AS count FROM albums WHERE user_id = $1', [req.userId]),
      db.query(
        `SELECT subscription_status, subscription_plan, current_period_end,
                cancel_at_period_end, razorpay_subscription_id,
                grace_period_until, lifetime_expires_at, album_quota, created_at,
                memorial_plan, wedding_plan
         FROM users WHERE id = $1`,
        [req.userId]
      ),
      db.query(
        `SELECT id, order_type, payment_status, fulfillment_status,
                tracking_number, amount_paise, created_at
         FROM physical_orders
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.userId]
      ),
    ]);

    const userData = userRes.rows[0];
    const [memorialContext, weddingContext] = await Promise.all([
      getPlanContextForType(req.userId, 'memorial'),
      getPlanContextForType(req.userId, 'wedding'),
    ]);

    const buildSubSummary = (context, type) =>
      context.planSlug ? {
        ...(context.subscription || {}),
        plan_slug:          context.planSlug,
        plan_type:          type,
        album_quota:        context.albumQuota,
        max_photos:         context.maxPhotos,
        max_videos:         context.maxVideos,
        audio_enabled:      context.audioEnabled,
        can_change_theme:   context.canChangeTheme,
        is_custom:          context.isCustom,
        subscription_count: context.subscription?.subscription_count || 1,
      } : null;

    res.json({
      ...userData,
      subscriptionStatus:    userData.subscription_status,
      subscriptionPlan:      userData.subscription_plan,
      currentPeriodEnd:      userData.current_period_end,
      cancelAtPeriodEnd:     userData.cancel_at_period_end,
      lifetimeExpiresAt:     userData.lifetime_expires_at,
      albumQuota:            userData.album_quota,
      albumCount:            albumCountRes.rows[0]?.count || 0,
      subscriptions:         subsRes.rows,
      memorialSub:           buildSubSummary(memorialContext, 'memorial'),
      weddingSub:            buildSubSummary(weddingContext, 'wedding'),
      hasMemorial:           !!memorialContext.planSlug,
      hasWedding:            !!weddingContext.planSlug,
      physicalOrders:        physicalRes.rows,
    });
  } catch (err) { next(err); }
};

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// INVOICES & REFUNDS (unchanged from original)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

exports.listInvoices = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT i.*, t.razorpay_payment_id, t.amount_paise
       FROM invoices i
       LEFT JOIN transactions t ON t.id = i.transaction_id
       WHERE i.user_id = $1 ORDER BY i.created_at DESC`,
      [req.userId]
    );
    res.json({ invoices: result.rows });
  } catch (err) { next(err); }
};

exports.downloadInvoice = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.invoiceId, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found.' });
    const pdf = await invoiceService.generateInvoicePDF(result.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${result.rows[0].invoice_number}.pdf"`);
    res.send(pdf);
  } catch (err) { next(err); }
};

exports.listRefundRequests = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.*, t.plan, t.status AS transaction_status,
              t.created_at AS transaction_created_at, i.invoice_number
       FROM refund_requests r
       LEFT JOIN transactions t ON t.id = r.transaction_id
       LEFT JOIN invoices i ON i.id = r.invoice_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.userId]
    );
    res.json({ refunds: result.rows });
  } catch (err) { next(err); }
};

exports.requestRefund = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { transactionId, invoiceId = null, reason = '', amountInr = null } = req.body || {};
    if (!transactionId) {
      client.release();
      return res.status(400).json({ error: 'transactionId is required.' });
    }

    await client.query('BEGIN');

    const txRes = await client.query(
      `SELECT t.id, t.user_id, t.amount_paise, t.amount_inr, t.status, t.plan,
              t.razorpay_payment_id, u.name AS user_name, u.email AS user_email
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = $1 AND t.user_id = $2
       FOR UPDATE`,
      [transactionId, req.userId]
    );
    if (!txRes.rows.length) {
      await client.query('ROLLBACK'); client.release();
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const transaction = txRes.rows[0];
    if (!['captured', 'paid'].includes(transaction.status)) {
      await client.query('ROLLBACK'); client.release();
      return res.status(400).json({ error: 'Only successful payments can be reviewed for refund.' });
    }

    const existing = await client.query(
      `SELECT id, status FROM refund_requests
       WHERE transaction_id = $1 AND status = ANY($2::text[])
       ORDER BY created_at DESC LIMIT 1`,
      [transactionId, REFUND_ACTIVE_STATUSES]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK'); client.release();
      return res.status(409).json({ error: `A refund request already exists with status "${existing.rows[0].status}".` });
    }

    let resolvedInvoiceId = invoiceId;
    if (!resolvedInvoiceId) {
      const invoiceRes = await client.query(
        'SELECT id FROM invoices WHERE transaction_id = $1 ORDER BY created_at DESC LIMIT 1',
        [transactionId]
      );
      resolvedInvoiceId = invoiceRes.rows[0]?.id || null;
    }

    const requestedAmountPaise = Math.min(
      transaction.amount_paise,
      amountInr != null ? (toPaiseFromInr(amountInr) || transaction.amount_paise) : transaction.amount_paise
    );

    const insertRes = await client.query(
      `INSERT INTO refund_requests
         (transaction_id, invoice_id, user_id, requested_amount_paise, requested_amount_inr,
          reason, status, requested_by_user, razorpay_payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,'requested',TRUE,$7)
       RETURNING *`,
      [
        transactionId, resolvedInvoiceId, req.userId,
        requestedAmountPaise, toINR(requestedAmountPaise),
        String(reason || '').trim() || null,
        transaction.razorpay_payment_id || null,
      ]
    );

    await client.query('COMMIT');
    client.release();

    emailService.sendRefundStatusUpdate(
      { id: req.userId, name: transaction.user_name, email: transaction.user_email },
      insertRes.rows[0]
    ).catch(() => {});

    res.status(201).json({ refund: insertRes.rows[0] });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    client.release();
    next(err);
  }
};
