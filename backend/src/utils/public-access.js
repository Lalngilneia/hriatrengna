'use strict';

const db = require('./db');

function hasGracePeriodAccess(gracePeriodUntil) {
  return Boolean(gracePeriodUntil && new Date(gracePeriodUntil) > new Date());
}

async function getPublicAccessState({ ownerStatus, ownerGracePeriodUntil, studioId }) {
  const ownerInGrace = hasGracePeriodAccess(ownerGracePeriodUntil);
  const ownerHasAccess = ['active', 'trialing'].includes(ownerStatus) || ownerInGrace;

  let studioSubscription = null;
  let studioInGrace = false;
  let studioHasAccess = false;

  if (studioId) {
    const res = await db.query(
      `SELECT status, grace_period_until, current_period_end
       FROM studio_subscriptions
       WHERE studio_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [studioId]
    );
    studioSubscription = res.rows[0] || null;
    studioInGrace = hasGracePeriodAccess(studioSubscription?.grace_period_until);
    studioHasAccess = Boolean(
      studioSubscription &&
      (['active', 'trialing'].includes(studioSubscription.status) || studioInGrace)
    );
  }

  return {
    hasAccess: ownerHasAccess || studioHasAccess,
    ownerHasAccess,
    ownerInGrace,
    studioHasAccess,
    studioInGrace,
    studioSubscription,
  };
}

module.exports = {
  hasGracePeriodAccess,
  getPublicAccessState,
};
