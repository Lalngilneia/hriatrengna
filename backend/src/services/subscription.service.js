'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../utils/db');
const engine = require('../utils/pricing-engine');
const invoiceService = require('./invoice.service');
const emailService = require('./email.service');
const { recordCommission } = require('../controllers/affiliate.controller');
const { getPlanContextForType } = require('../utils/plan-access');

const SUBSCRIPTION_GRACE_DAYS = 30;

const getRazorpay = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const toINR = (paise) => (paise / 100).toFixed(2);

function normalizeRazorpayError(err) {
  if (err instanceof Error) return err;
  const msg = err?.error?.description || err?.description || JSON.stringify(err);
  const error = new Error('Razorpay: ' + msg);
  error.status = err?.statusCode || 502;
  return error;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function buildReceipt(prefix, id) {
  return `${prefix}-${String(id).slice(0, 8)}-${Date.now()}`;
}

function safeCompare(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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

  const allSubs = subsRes.rows;
  const activeSubs = allSubs.filter((sub) => ['active', 'trialing'].includes(sub.status));

  let subscriptionStatus = 'inactive';
  if (activeSubs.length) subscriptionStatus = 'active';
  else if (allSubs.some((sub) => sub.status === 'past_due')) subscriptionStatus = 'past_due';
  else if (allSubs.some((sub) => sub.status === 'halted')) subscriptionStatus = 'halted';
  else if (allSubs.some((sub) => ['canceled', 'cancelled', 'completed'].includes(sub.status))) subscriptionStatus = 'canceled';

  const primaryPlan = memorialContext.planSlug || weddingContext.planSlug || allSubs[0]?.plan_slug || null;
  const currentPeriodEnd = [
    memorialContext.subscription?.current_period_end,
    weddingContext.subscription?.current_period_end,
  ].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;

  const cancelAtPeriodEnd = activeSubs.length > 0 && activeSubs.every((sub) => Boolean(sub.cancel_at_period_end));
  const legacyAlbumQuota = memorialContext.albumQuota ?? weddingContext.albumQuota ?? null;

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
      subscriptionStatus,
      primaryPlan,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      memorialContext.planSlug,
      weddingContext.planSlug,
      legacyAlbumQuota,
      userId,
    ]
  );

  return { subscriptionStatus, memorialContext, weddingContext };
}

async function issueInvoiceAndCommission(userId, transactionId, amountPaise, planSlug) {
  try {
    const userInfo = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    const invoice = await invoiceService.createInvoiceRecord({
      userId,
      transactionId,
      amountInr: toINR(amountPaise),
      plan: planSlug,
      userName: userInfo.rows[0]?.name,
      userEmail: userInfo.rows[0]?.email,
    });

    if (invoice && userInfo.rows[0]?.email) {
      const pdf = await invoiceService.generateInvoicePDF(invoice);
      await emailService.sendInvoice(
        { id: userId, name: userInfo.rows[0]?.name || 'Customer', email: userInfo.rows[0].email },
        invoice,
        pdf
      );
    }

    await recordCommission({ userId, transactionId, amountInr: toINR(amountPaise) });
  } catch (err) {
    console.error('[SUBSCRIPTION] Invoice/commission failed:', err.message);
  }
}

function getBillingIntervalMonths(configRow, fallbackPaymentMode) {
  if ((configRow?.payment_mode || fallbackPaymentMode) === 'monthly') return 1;
  return Number(configRow?.length_months || 1);
}

function buildConsumerNotes({ userId, planType, planSlug, paymentMode, subscriptionId, configId }) {
  return {
    userId,
    planType,
    planSlug,
    paymentMode,
    subscriptionId,
    configId,
    productType: 'consumer_custom',
  };
}

async function createConsumerOrder({
  userId,
  user,
  config,
  pricing,
  paymentMode,
}) {
  const configId = await engine.insertConfigRow(engine.buildConfigRow(userId, config, pricing));
  const planSlug = engine.CUSTOM_SLUG[config.planType];
  const amount = paymentMode === 'monthly'
    ? pricing.totalMonthlyPaise
    : pricing.totalChargedPaise;

  const subscriptionRes = await db.query(
    `INSERT INTO subscriptions
       (user_id, config_id, plan_slug, plan_type, amount, status, payment_mode, billing_interval_months)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
     RETURNING id`,
    [
      userId,
      configId,
      planSlug,
      config.planType,
      amount,
      paymentMode,
      getBillingIntervalMonths({ length_months: config.lengthMonths, payment_mode: paymentMode }, paymentMode),
    ]
  );

  const subscriptionId = subscriptionRes.rows[0].id;
  const receipt = buildReceipt(paymentMode === 'monthly' ? 'sub' : 'upfront', subscriptionId);
  const razorpay = getRazorpay();

  let order;
  try {
    order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt,
      notes: buildConsumerNotes({
        userId,
        planType: config.planType,
        planSlug,
        paymentMode,
        subscriptionId,
        configId,
      }),
    });
  } catch (err) {
    throw normalizeRazorpayError(err);
  }

  await db.query(
    `INSERT INTO payments
       (subscription_id, razorpay_order_id, amount, status, receipt)
     VALUES ($1, $2, $3, 'pending', $4)`,
    [subscriptionId, order.id, amount, receipt]
  );

  return {
    subscriptionId,
    configId,
    planSlug,
    orderId: order.id,
    amount,
    currency: 'INR',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    planType: config.planType,
    lengthMonths: config.lengthMonths,
    pricing: pricing.display,
    customer: {
      name: user.name,
      email: user.email,
      contact: user.phone || '',
    },
  };
}

async function createRenewalOrder({ userId, subscriptionId }) {
  const subRes = await db.query(
    `SELECT s.id, s.user_id, s.amount, s.plan_slug, s.plan_type, s.status, s.payment_mode,
            s.config_id, sc.length_months
     FROM subscriptions s
     LEFT JOIN subscription_configs sc ON sc.id = s.config_id
     WHERE s.id = $1 AND s.user_id = $2
     LIMIT 1`,
    [subscriptionId, userId]
  );

  const subscription = subRes.rows[0];
  if (!subscription) {
    const err = new Error('Subscription not found.');
    err.status = 404;
    throw err;
  }

  if (subscription.status === 'cancelled') {
    const err = new Error('Cancelled subscriptions cannot be renewed.');
    err.status = 400;
    throw err;
  }

  const userRes = await db.query(
    'SELECT id, name, email, phone FROM users WHERE id = $1',
    [userId]
  );

  const user = userRes.rows[0];
  const receipt = buildReceipt('renew', subscription.id);
  const razorpay = getRazorpay();
  let order;

  try {
    order = await razorpay.orders.create({
      amount: subscription.amount,
      currency: 'INR',
      receipt,
      notes: buildConsumerNotes({
        userId,
        planType: subscription.plan_type,
        planSlug: subscription.plan_slug,
        paymentMode: subscription.payment_mode,
        subscriptionId: subscription.id,
        configId: subscription.config_id,
      }),
    });
  } catch (err) {
    throw normalizeRazorpayError(err);
  }

  await db.query(
    `INSERT INTO payments
       (subscription_id, razorpay_order_id, amount, status, receipt)
     VALUES ($1, $2, $3, 'pending', $4)`,
    [subscription.id, order.id, subscription.amount, receipt]
  );

  return {
    subscriptionId: subscription.id,
    orderId: order.id,
    amount: subscription.amount,
    currency: 'INR',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    customer: {
      name: user?.name || '',
      email: user?.email || '',
      contact: user?.phone || '',
    },
  };
}

function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return safeCompare(expectedSignature, signature);
}

async function syncLegacyConsumerSubscription(client, subscription, payment, nextBillingDate, status) {
  const albumQuotaValue = parseInt(subscription.album_quota, 10) || 1;

  const current = await client.query(
    `SELECT id
     FROM user_subscriptions
     WHERE billing_subscription_id = $1
        OR (razorpay_order_id IS NOT NULL AND razorpay_order_id = $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [subscription.id, payment?.razorpay_order_id || null]
  );

  // NOTE: Use explicit, separate parameter arrays for UPDATE and INSERT.
  // A shared `values` array caused a $6-onward order mismatch between the
  // two queries: nextBillingDate (a timestamp) was landing in album_quota
  // (integer), triggering "invalid input syntax for type integer".

  if (current.rows.length) {
    await client.query(
      `UPDATE user_subscriptions SET
         user_id                  = $1,
         plan_slug                = $2,
         plan_type                = $3,
         status                   = $4,
         razorpay_subscription_id = NULL,
         razorpay_order_id        = $5,
         album_quota              = $6,
         current_period_end       = $7,
         config_id                = $8,
         payment_mode             = $9,
         billing_subscription_id  = $10,
         grace_period_until       = $11,
         cancel_at_period_end     = $12,
         updated_at               = NOW()
       WHERE id = $13`,
      [
        subscription.user_id,          // $1  user_id
        subscription.plan_slug,        // $2  plan_slug
        subscription.plan_type,        // $3  plan_type
        status,                        // $4  status
        payment?.razorpay_order_id || null, // $5  razorpay_order_id
        albumQuotaValue,               // $6  album_quota  (integer)
        nextBillingDate,               // $7  current_period_end  (timestamp)
        subscription.config_id,        // $8  config_id
        subscription.payment_mode,     // $9  payment_mode
        subscription.id,               // $10 billing_subscription_id
        subscription.grace_period_until || null, // $11 grace_period_until
        subscription.cancel_at_period_end || false, // $12 cancel_at_period_end
        current.rows[0].id,            // $13 WHERE id
      ]
    );
    return current.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO user_subscriptions
       (user_id, plan_slug, plan_type, status, razorpay_order_id, album_quota,
        current_period_end, cancel_at_period_end, grace_period_until, config_id,
        payment_mode, billing_subscription_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      subscription.user_id,            // $1  user_id
      subscription.plan_slug,          // $2  plan_slug
      subscription.plan_type,          // $3  plan_type
      status,                          // $4  status
      payment?.razorpay_order_id || null, // $5  razorpay_order_id
      albumQuotaValue,                 // $6  album_quota  (integer)
      nextBillingDate,                 // $7  current_period_end  (timestamp)
      subscription.cancel_at_period_end || false, // $8  cancel_at_period_end
      subscription.grace_period_until || null,    // $9  grace_period_until
      subscription.config_id,          // $10 config_id
      subscription.payment_mode,       // $11 payment_mode
      subscription.id,                 // $12 billing_subscription_id
    ]
  );

  return inserted.rows[0].id;
}

async function confirmCapturedPayment({ razorpayOrderId, razorpayPaymentId, paymentEntity }) {
  console.log('[confirmCapturedPayment] Starting:', { razorpayOrderId, razorpayPaymentId });
  const client = await db.getClient();
  let transactionId = null;
  let subscriptionData = null;

  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT p.id, p.subscription_id, p.razorpay_order_id, p.razorpay_payment_id, p.status AS payment_status,
              p.amount, s.user_id, s.plan_slug, s.plan_type, s.status AS subscription_status,
              s.next_billing_date, s.config_id, s.payment_mode, s.billing_interval_months,
              s.cancel_at_period_end, s.grace_period_until, sc.length_months
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN subscription_configs sc ON sc.id = s.config_id
       WHERE p.razorpay_order_id = $1
          OR (p.razorpay_payment_id IS NOT NULL AND p.razorpay_payment_id = $2)
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [razorpayOrderId, razorpayPaymentId]
    );

    if (!paymentRes.rows.length) {
      console.log('[confirmCapturedPayment] payment_not_found for order:', razorpayOrderId, 'payment:', razorpayPaymentId);
      await client.query('ROLLBACK');
      return { handled: false, reason: 'payment_not_found' };
    }

    const payment = paymentRes.rows[0];
    console.log('[confirmCapturedPayment] Found payment:', JSON.stringify(payment));

    const dupRes = await client.query(
      `SELECT id
       FROM payments
       WHERE razorpay_payment_id = $1
         AND id <> $2
       LIMIT 1`,
      [razorpayPaymentId, payment.id]
    );

    if (dupRes.rows.length) {
      await client.query('ROLLBACK');
      return { handled: true, duplicate: true, subscriptionId: payment.subscription_id, userId: payment.user_id };
    }

    const intervalMonths = Number(payment.billing_interval_months || getBillingIntervalMonths(payment, payment.payment_mode));
    const baseline = payment.next_billing_date && new Date(payment.next_billing_date) > new Date()
      ? new Date(payment.next_billing_date)
      : new Date();
    const nextBillingDate = addMonths(baseline, intervalMonths);

    await client.query(
      `UPDATE payments SET
         razorpay_payment_id = COALESCE($1, razorpay_payment_id),
         status              = 'success',
         raw_payload         = $2,
         updated_at          = NOW()
       WHERE id = $3`,
      [razorpayPaymentId, paymentEntity ? JSON.stringify(paymentEntity) : null, payment.id]
    );

    await client.query(
      `UPDATE subscriptions SET
         status               = 'active',
         next_billing_date    = $1,
         cancel_at_period_end = FALSE,
         grace_period_until   = NULL,
         updated_at           = NOW()
       WHERE id = $2`,
      [nextBillingDate, payment.subscription_id]
    );

    await syncLegacyConsumerSubscription(
      client,
      {
        ...payment,
        id: payment.subscription_id,
        grace_period_until: null,
        cancel_at_period_end: false,
      },
      { razorpay_order_id: payment.razorpay_order_id },
      nextBillingDate,
      'active'
    );

    const txRes = await client.query(
      `INSERT INTO transactions
         (user_id, razorpay_payment_id, razorpay_order_id, amount_paise, amount_inr,
          status, plan, payment_method, description, raw_payload)
       VALUES ($1, $2, $3, $4, $5, 'captured', $6, $7, $8, $9)
       ON CONFLICT (razorpay_payment_id) DO NOTHING
       RETURNING id`,
      [
        payment.user_id,
        razorpayPaymentId,
        payment.razorpay_order_id,
        payment.amount,
        toINR(payment.amount),
        payment.plan_slug,
        paymentEntity?.method || null,
        `${payment.plan_type === 'wedding' ? 'Wedding' : 'Memorial'} subscription payment`,
        paymentEntity ? JSON.stringify(paymentEntity) : null,
      ]
    );

    transactionId = txRes.rows[0]?.id || null;
    subscriptionData = {
      subscriptionId: payment.subscription_id,
      userId: payment.user_id,
      planSlug: payment.plan_slug,
      amount: payment.amount,
      nextBillingDate,
    };

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await db.query(
    `UPDATE users SET
       grace_period_until = NULL,
       razorpay_subscription_id = NULL
     WHERE id = $1`,
    [subscriptionData.userId]
  );
  await refreshUserSubscriptionState(subscriptionData.userId);
  await db.query(
    'UPDATE albums SET is_published = TRUE WHERE user_id = $1 AND is_published = FALSE',
    [subscriptionData.userId]
  );

  if (transactionId) {
    issueInvoiceAndCommission(
      subscriptionData.userId,
      transactionId,
      subscriptionData.amount,
      subscriptionData.planSlug
    ).catch(() => {});
  }

  return {
    handled: true,
    transactionId,
    ...subscriptionData,
  };
}

async function markPaymentFailed({ razorpayOrderId, razorpayPaymentId = null, paymentEntity = null }) {
  const client = await db.getClient();
  let subscriptionData = null;

  try {
    await client.query('BEGIN');

    const paymentRes = await client.query(
      `SELECT p.id, p.subscription_id, p.razorpay_order_id, s.user_id, s.plan_slug, s.plan_type,
              s.config_id, s.payment_mode, s.cancel_at_period_end, s.grace_period_until
       FROM payments p
       JOIN subscriptions s ON s.id = p.subscription_id
       WHERE p.razorpay_order_id = $1
       ORDER BY p.created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [razorpayOrderId]
    );

    if (!paymentRes.rows.length) {
      await client.query('ROLLBACK');
      return { handled: false, reason: 'payment_not_found' };
    }

    const gracePeriodUntil = new Date(Date.now() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const payment = paymentRes.rows[0];

    await client.query(
      `UPDATE payments SET
         razorpay_payment_id = COALESCE($1, razorpay_payment_id),
         status              = 'failed',
         raw_payload         = $2,
         updated_at          = NOW()
       WHERE id = $3`,
      [razorpayPaymentId, paymentEntity ? JSON.stringify(paymentEntity) : null, payment.id]
    );

    await client.query(
      `UPDATE subscriptions SET
         status             = 'past_due',
         grace_period_until = $1,
         updated_at         = NOW()
       WHERE id = $2`,
      [gracePeriodUntil, payment.subscription_id]
    );

    await syncLegacyConsumerSubscription(
      client,
      {
        ...payment,
        id: payment.subscription_id,
        grace_period_until: gracePeriodUntil,
        cancel_at_period_end: payment.cancel_at_period_end,
      },
      { razorpay_order_id: payment.razorpay_order_id },
      null,
      'past_due'
    );

    subscriptionData = {
      subscriptionId: payment.subscription_id,
      userId: payment.user_id,
      planSlug: payment.plan_slug,
      gracePeriodUntil,
    };

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await db.query(
    `UPDATE users SET grace_period_until = $1 WHERE id = $2`,
    [subscriptionData.gracePeriodUntil, subscriptionData.userId]
  );
  await refreshUserSubscriptionState(subscriptionData.userId);

  return {
    handled: true,
    ...subscriptionData,
  };
}

async function expireDueSubscriptions() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const dueRes = await client.query(
      `SELECT id, user_id, plan_type, plan_slug, config_id, payment_mode,
              next_billing_date, cancel_at_period_end, grace_period_until
       FROM subscriptions
       WHERE status = 'active'
         AND next_billing_date IS NOT NULL
         AND next_billing_date <= NOW()
       FOR UPDATE`
    );

    for (const row of dueRes.rows) {
      const gracePeriodUntil = row.grace_period_until || new Date(Date.now() + SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);

      await client.query(
        `UPDATE subscriptions
         SET status = 'past_due',
             grace_period_until = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [gracePeriodUntil, row.id]
      );

      await syncLegacyConsumerSubscription(
        client,
        {
          ...row,
          grace_period_until: gracePeriodUntil,
        },
        null,
        row.next_billing_date,
        'past_due'
      );
      await client.query(
        'UPDATE users SET grace_period_until = $1 WHERE id = $2',
        [gracePeriodUntil, row.user_id]
      );
    }

    await client.query('COMMIT');

    for (const row of dueRes.rows) {
      await refreshUserSubscriptionState(row.user_id);
    }

    return dueRes.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SUBSCRIPTION_GRACE_DAYS,
  createConsumerOrder,
  createRenewalOrder,
  verifyCheckoutSignature,
  confirmCapturedPayment,
  markPaymentFailed,
  refreshUserSubscriptionState,
  expireDueSubscriptions,
  normalizeRazorpayError,
  toINR,
};
