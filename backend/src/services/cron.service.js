'use strict';
const cron         = require('node-cron');
const db           = require('../utils/db');
const emailService = require('./email.service');
const subscriptionService = require('./subscription.service');

// ─────────────────────────────────────────────────────────────
// EXISTING JOBS
// ─────────────────────────────────────────────────────────────

async function runAnniversaryReminders() {
  console.log('[CRON] Running anniversary reminders...');
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day   = today.getDate();
    const result = await db.query(`
      SELECT a.id, a.name, a.birth_date, a.death_date, a.birth_year, a.death_year, a.slug,
             u.id AS user_id, u.name AS user_name, u.email AS user_email
      FROM albums a
      JOIN users u ON u.id = a.user_id
      WHERE u.subscription_status = 'active'
        AND (
          (EXTRACT(MONTH FROM a.birth_date) = $1 AND EXTRACT(DAY FROM a.birth_date) = $2)
          OR
          (EXTRACT(MONTH FROM a.death_date) = $1 AND EXTRACT(DAY FROM a.death_date) = $2)
        )
    `, [month, day]);
    for (const row of result.rows) {
      const isBirthday = row.birth_date &&
        new Date(row.birth_date).getMonth() + 1 === month &&
        new Date(row.birth_date).getDate() === day;
      const type = isBirthday ? 'birthday' : 'anniversary';
      const year = isBirthday ? row.birth_year : row.death_year;
      const age  = year ? today.getFullYear() - year : null;
      await emailService.sendAnniversaryReminder(
        { id: row.user_id, name: row.user_name, email: row.user_email },
        { albumName: row.name, albumSlug: row.slug, type, age }
      ).catch(err => console.error(`[CRON] Anniversary email failed for ${row.user_email}:`, err.message));
    }
    console.log(`[CRON] Anniversary reminders: ${result.rows.length} sent.`);
  } catch (err) { console.error('[CRON] Anniversary reminders failed:', err.message); }
}

async function runExpiryWarnings() {
  console.log('[CRON] Running expiry warnings...');
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.subscription_plan, u.current_period_end
      FROM users u
      WHERE u.subscription_status = 'active'
        AND u.cancel_at_period_end = TRUE
        AND u.current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    `);
    for (const user of result.rows) {
      await emailService.sendExpiryWarning(user)
        .catch(err => console.error(`[CRON] Expiry warning failed for ${user.email}:`, err.message));
    }
    console.log(`[CRON] Expiry warnings: ${result.rows.length} sent.`);
  } catch (err) { console.error('[CRON] Expiry warnings failed:', err.message); }
}

async function runLifetimeExpiryCheck() {
  console.log('[CRON] Checking lifetime plan expirations...');
  try {
    const result = await db.query(`
      UPDATE users SET subscription_status = 'expired'
      WHERE subscription_plan = 'lifetime'
        AND lifetime_expires_at IS NOT NULL
        AND lifetime_expires_at < NOW()
        AND subscription_status != 'expired'
      RETURNING id, email, name
    `);
    if (result.rows.length > 0)
      console.log(`[CRON] Lifetime expired: ${result.rows.length} accounts marked.`);
  } catch (err) { console.error('[CRON] Lifetime expiry check failed:', err.message); }
}

async function runGracePeriodEnforcement() {
  try {
    const result = await db.query(`
      UPDATE users SET subscription_status = 'inactive'
      WHERE subscription_status IN ('past_due', 'canceled', 'halted')
        AND grace_period_until IS NOT NULL
        AND grace_period_until < NOW()
      RETURNING id, email, name
    `);
    if (result.rows.length > 0) {
      console.log(`[CRON] Grace period expired: ${result.rows.length} accounts moved to inactive.`);
      // Disable all published albums for these users
      const ids = result.rows.map(u => u.id);
      await db.query(
        `UPDATE albums SET is_published = FALSE WHERE user_id = ANY($1::uuid[])`,
        [ids]
      );
      console.log(`[CRON] Albums unpublished for ${ids.length} expired accounts.`);
    }
  } catch (err) { console.error('[CRON] Grace period enforcement failed:', err.message); }
}

// ─────────────────────────────────────────────────────────────
// NEW AUTOMATION JOBS
// ─────────────────────────────────────────────────────────────

// Every 30 min — admin email when new verified affiliate applies
async function runAffiliateApplicationAlerts() {
  try {
    const result = await db.query(`
      SELECT id, name, email, phone, business_name, notes, created_at
      FROM affiliates
      WHERE status = 'pending'
        AND is_email_verified = TRUE
        AND created_at > NOW() - INTERVAL '31 minutes'
      ORDER BY created_at ASC
    `);
    if (!result.rows.length) return;
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmail) return;
    for (const aff of result.rows) {
      await emailService.sendAdminNotification({
        to: adminEmail,
        subject: `New Affiliate Application — ${aff.name}`,
        html: `<h2>New Affiliate Application</h2>
               <p><b>Name:</b> ${aff.name}</p>
               <p><b>Email:</b> ${aff.email}</p>
               <p><b>Phone:</b> ${aff.phone || 'Not provided'}</p>
               <p><b>Business:</b> ${aff.business_name || 'Not provided'}</p>
               <p><b>Message:</b> ${aff.notes || 'None'}</p>
               <p><a href="${process.env.APP_URL}/admin">Review in Admin →</a></p>`,
      }).catch(() => {});
    }
    console.log(`[CRON] Affiliate alerts: ${result.rows.length} sent.`);
  } catch (err) { console.error('[CRON] Affiliate application alerts failed:', err.message); }
}

// Daily — admin digest: signups, revenue, pending affiliates
async function runDailySignupDigest() {
  try {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmail) return;
    const [statsRes, revenueRes, pendingAffRes] = await Promise.all([
      db.query(`
        SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE subscription_status='active') AS active
        FROM users WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      db.query(`
        SELECT COALESCE(SUM(amount_inr),0) AS revenue
        FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours' AND status='captured'
      `),
      db.query(`SELECT COUNT(*) AS count FROM affiliates WHERE status='pending' AND is_email_verified=TRUE`),
    ]);
    const stats   = statsRes.rows[0];
    const revenue = parseFloat(revenueRes.rows[0].revenue || 0);
    const pending = parseInt(pendingAffRes.rows[0].count);
    if (parseInt(stats.total) === 0 && revenue === 0) return; // skip empty days
    await emailService.sendAdminNotification({
      to: adminEmail,
      subject: `📊 Daily Digest — ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`,
      html: `<h2>Daily Summary</h2>
             <table style="border-collapse:collapse;width:100%">
               <tr><td style="padding:8px;font-weight:600">New Registrations</td><td style="padding:8px">${stats.total}</td></tr>
               <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:600">New Subscribers</td><td style="padding:8px">${stats.active}</td></tr>
               <tr><td style="padding:8px;font-weight:600">Revenue (24h)</td><td style="padding:8px;color:green;font-weight:700">₹${revenue.toLocaleString('en-IN')}</td></tr>
               <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:600">Pending Affiliate Apps</td><td style="padding:8px;color:${pending > 0 ? 'orange' : 'inherit'}">${pending}</td></tr>
             </table>
             <p><a href="${process.env.APP_URL}/admin">Open Admin →</a></p>`,
    }).catch(() => {});
    console.log('[CRON] Daily digest sent.');
  } catch (err) { console.error('[CRON] Daily digest failed:', err.message); }
}

// Weekly Monday — remind admin to pay out pending commissions
async function runCommissionPayoutReminder() {
  try {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmail) return;
    const result = await db.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(amount_inr),0) AS total,
             COUNT(DISTINCT affiliate_id) AS affiliates
      FROM commissions WHERE status='pending'
    `);
    const r = result.rows[0];
    if (parseInt(r.count) === 0) return;
    await emailService.sendAdminNotification({
      to: adminEmail,
      subject: `💰 Commission Payout Due — ₹${parseFloat(r.total).toLocaleString('en-IN')} pending`,
      html: `<h2>Commission Payout Reminder</h2>
             <p><b>${r.count}</b> pending commissions across <b>${r.affiliates}</b> affiliates.</p>
             <p>Total due: <b style="color:green">₹${parseFloat(r.total).toLocaleString('en-IN')}</b></p>
             <p><a href="${process.env.APP_URL}/admin">Process in Admin →</a></p>`,
    }).catch(() => {});
    console.log('[CRON] Commission payout reminder sent.');
  } catch (err) { console.error('[CRON] Commission payout reminder failed:', err.message); }
}

// Daily — warn subscribers nearing 85% of photo/video quota
async function runMediaQuotaWarnings() {
  try {
    const result = await db.query(`
      SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email,
             u.subscription_plan, a.id AS album_id, a.name AS album_name, a.slug,
             COUNT(m.id) FILTER (WHERE m.type='photo') AS photo_count,
             COUNT(m.id) FILTER (WHERE m.type='video') AS video_count,
             pp.max_photos, pp.max_videos
      FROM users u
      JOIN albums a ON a.user_id = u.id
      LEFT JOIN media m ON m.album_id = a.id
      JOIN pricing_plans pp ON pp.slug = u.subscription_plan
      WHERE u.subscription_status = 'active' AND pp.max_photos IS NOT NULL
      GROUP BY u.id, u.name, u.email, u.subscription_plan,
               a.id, a.name, a.slug, pp.max_photos, pp.max_videos
      HAVING COUNT(m.id) FILTER (WHERE m.type='photo') >= (pp.max_photos * 0.85)
          OR COUNT(m.id) FILTER (WHERE m.type='video') >= (COALESCE(pp.max_videos,10) * 0.85)
    `);
    for (const row of result.rows) {
      const recent = await db.query(`
        SELECT id FROM email_log WHERE user_id=$1 AND type='mediaQuotaWarning'
          AND sent_at > NOW() - INTERVAL '7 days' LIMIT 1
      `, [row.user_id]);
      if (recent.rows.length) continue;
      await emailService.sendMediaQuotaWarning(
        { id: row.user_id, name: row.user_name, email: row.user_email },
        { albumName: row.album_name, albumSlug: row.slug,
          photoCount: parseInt(row.photo_count), videoCount: parseInt(row.video_count),
          maxPhotos: row.max_photos, maxVideos: row.max_videos, plan: row.subscription_plan }
      ).catch(err => console.error(`[CRON] Quota warning failed for ${row.user_email}:`, err.message));
    }
    console.log(`[CRON] Media quota warnings: checked ${result.rows.length} albums.`);
  } catch (err) { console.error('[CRON] Media quota warnings failed:', err.message); }
}

// Daily — 7-day-ahead renewal reminder (active, not cancelling)
async function runRenewalReminders() {
  try {
    const result = await db.query(`
      SELECT u.id, u.name, u.email, u.subscription_plan, u.current_period_end
      FROM users u
      WHERE u.subscription_status = 'active'
        AND u.cancel_at_period_end = FALSE
        AND u.subscription_plan != 'lifetime'
        AND u.current_period_end BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '7 days'
    `);
    for (const user of result.rows) {
      const recent = await db.query(`
        SELECT id FROM email_log WHERE user_id=$1 AND type='renewalReminder'
          AND sent_at > NOW() - INTERVAL '30 days' LIMIT 1
      `, [user.id]);
      if (recent.rows.length) continue;
      await emailService.sendRenewalReminder(user)
        .catch(err => console.error(`[CRON] Renewal reminder failed for ${user.email}:`, err.message));
    }
    console.log(`[CRON] Renewal reminders: ${result.rows.length} checked.`);
  } catch (err) { console.error('[CRON] Renewal reminders failed:', err.message); }
}

// Monthly — warn + delete accounts past 90-day grace period
async function runExpiredDataCleanup() {
  console.log('[CRON] Running expired data cleanup...');
  try {
    // 7-day-before-deletion warning
    const toWarn = await db.query(`
      SELECT u.id, u.name, u.email,
             (u.current_period_end + INTERVAL '90 days') AS deletion_date
      FROM users u
      WHERE u.subscription_status IN ('inactive','expired','canceled')
        AND u.current_period_end IS NOT NULL
        AND (u.current_period_end + INTERVAL '83 days') < NOW()
        AND (u.current_period_end + INTERVAL '90 days') > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM email_log WHERE user_id=u.id AND type='dataDeletionWarning'
            AND sent_at > NOW() - INTERVAL '90 days'
        )
    `);
    for (const user of toWarn.rows) {
      await emailService.sendDataDeletionWarning(user)
        .catch(err => console.error(`[CRON] Deletion warning failed for ${user.email}:`, err.message));
    }
    // Hard delete past 90 days
    const toDelete = await db.query(`
      SELECT id, email FROM users
      WHERE subscription_status IN ('inactive','expired','canceled')
        AND current_period_end IS NOT NULL
        AND (current_period_end + INTERVAL '90 days') < NOW()
    `);
    for (const user of toDelete.rows) {
      await db.query('DELETE FROM users WHERE id=$1', [user.id])
        .then(() => console.log(`[CRON] Deleted expired account: ${user.email}`))
        .catch(err => console.error(`[CRON] Delete failed ${user.email}:`, err.message));
    }
    console.log(`[CRON] Cleanup: ${toWarn.rows.length} warned, ${toDelete.rows.length} deleted.`);
  } catch (err) { console.error('[CRON] Expired data cleanup failed:', err.message); }
}


// ── DEMO ACCOUNT CLEANUP ──────────────────────────────────────
// Runs every hour. For expired demos:
//   - Deletes all albums + media (via CASCADE)
//   - Sets subscription_status = 'inactive'
//   - Keeps the user row but clears demo data (trial expired message)
async function runDemoAccountCleanup() {
  console.log('[CRON] Running demo account cleanup...');
  try {
    // Find expired demo accounts
    const expired = await db.query(
      `SELECT id, email FROM users
       WHERE is_demo = TRUE AND demo_expires_at < NOW()
         AND subscription_status = 'active'`
    );

    for (const user of expired.rows) {
      // Delete albums + all linked media (CASCADE handles media, wishes, events)
      await db.query('DELETE FROM albums WHERE user_id = $1', [user.id]);

      // Full delete — account + all data (cascades albums/media)
      await db.query('DELETE FROM users WHERE id = $1', [user.id]);
      console.log(`[CRON] Demo expired + deleted: ${user.email}`);
    }

    console.log(`[CRON] Demo cleanup: ${expired.rows.length} accounts deleted.`);
  } catch (err) {
    console.error('[CRON] Demo cleanup error:', err.message);
  }
}

// Studio grace period and invite cleanup
async function runStudioGracePeriodEnforcement() {
  try {
    const expired = await db.query(`
      SELECT ss.id, ss.studio_id
      FROM studio_subscriptions ss
      WHERE ss.status = 'canceled'
        AND ss.grace_period_until IS NOT NULL
        AND ss.grace_period_until < NOW()
    `);
    for (const row of expired.rows) {
      await db.query(
        `UPDATE studio_subscriptions SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      await db.query(
        `UPDATE albums SET is_published = FALSE WHERE studio_id = $1 AND is_published = TRUE`,
        [row.studio_id]
      );
    }
    if (expired.rows.length)
      console.log(`[CRON] Studio grace: ${expired.rows.length} studios expired, albums unpublished.`);
  } catch (err) { console.error('[CRON] Studio grace enforcement failed:', err.message); }
}

async function runStudioInviteCleanup() {
  try {
    const result = await db.query(`
      DELETE FROM studio_invites
      WHERE accepted_at IS NULL
        AND expires_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `);
    if (result.rows.length)
      console.log(`[CRON] Studio invites: ${result.rows.length} expired invites purged.`);
  } catch (err) { console.error('[CRON] Studio invite cleanup failed:', err.message); }
}

async function runSubscriptionPastDueSweep() {
  try {
    const rows = await subscriptionService.expireDueSubscriptions();
    if (rows.length) {
      console.log(`[CRON] Subscription sweep: ${rows.length} subscriptions moved to past_due.`);
    }
  } catch (err) {
    console.error('[CRON] Subscription past-due sweep failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
function startCronJobs() {
  // Daily 8:00 AM IST (02:30 UTC)
  cron.schedule('30 2 * * *', async () => {
    await runAnniversaryReminders();
    await runExpiryWarnings();
    await runSubscriptionPastDueSweep();
    await runGracePeriodEnforcement();
    await runStudioGracePeriodEnforcement();
    await runMediaQuotaWarnings();
    await runRenewalReminders();
  });
  // Daily 9:00 AM IST (03:30 UTC) — admin digest
  cron.schedule('30 3 * * *', async () => {
    await runDailySignupDigest();
  });
  // Every hour — demo account cleanup
  cron.schedule('0 * * * *', async () => {
    await runDemoAccountCleanup();
  });

  // Every 30 minutes — affiliate alert
  cron.schedule('*/30 * * * *', async () => {
    await runAffiliateApplicationAlerts();
  });
  // Every Monday 9:00 AM IST — commission payout reminder + studio invite cleanup
  cron.schedule('30 3 * * 1', async () => {
    await runCommissionPayoutReminder();
    await runStudioInviteCleanup();
  });
  // Monthly 1st 3:00 AM UTC
  cron.schedule('0 3 1 * *', async () => {
    await runLifetimeExpiryCheck();
    await runExpiredDataCleanup();
  });
  console.log('[CRON] All cron jobs scheduled (11 jobs active).');
}

module.exports = {
  startCronJobs,
  runDemoAccountCleanup,
  runAnniversaryReminders, runExpiryWarnings, runGracePeriodEnforcement,
  runLifetimeExpiryCheck, runAffiliateApplicationAlerts, runDailySignupDigest,
  runCommissionPayoutReminder, runMediaQuotaWarnings, runRenewalReminders,
  runExpiredDataCleanup,
  runSubscriptionPastDueSweep,
  runStudioGracePeriodEnforcement, runStudioInviteCleanup,
};
