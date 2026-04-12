/**
 * lib/auth.js
 * Token storage helpers, user payload normalisation, and silent refresh.
 * All localStorage access is guarded so this is SSR-safe.
 */

const TOKEN_KEY = 'mqr_token';

// ── Token expiry helpers ──────────────────────────────────────

/**
 * Decode the JWT payload without verifying the signature.
 * Used client-side only to read the `exp` claim.
 */
function decodeTokenPayload(token) {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Returns seconds until the token expires (negative if already expired).
 */
export function tokenSecondsRemaining(token) {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return -1;
  return payload.exp - Math.floor(Date.now() / 1000);
}

/**
 * Silently refresh the JWT.
 * Calls POST /api/auth/refresh with the current token.
 * On success saves the new token and returns it.
 * On failure clears the token and returns null.
 *
 * @param {string} apiBase  e.g. 'https://api.hriatrengna.in'
 * @returns {Promise<string|null>}
 */
export async function silentRefresh(apiBase) {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${apiBase}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { clearToken(); return null; }
    const data = await res.json();
    if (data.token) { saveToken(data.token); return data.token; }
    clearToken();
    return null;
  } catch {
    return null; // Network failure — don't clear; user may be offline
  }
}

function normalizeSubscription(sub) {
  if (!sub) return null;
  return {
    ...sub,
    planType: sub.planType ?? sub.plan_type ?? null,
    planSlug: sub.planSlug ?? sub.plan_slug ?? null,
    albumQuota: sub.albumQuota ?? sub.album_quota ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? sub.current_period_end ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? sub.cancel_at_period_end ?? false,
  };
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * normalizeUserPayload
 *
 * The /api/auth/me and /api/payments/status endpoints use snake_case;
 * the frontend uses camelCase. This function handles both and supplies
 * safe defaults so callers never need to null-check every field.
 */
export function normalizeUserPayload(user) {
  if (!user) return null;

  const memorialSub = normalizeSubscription(user.memorialSub ?? user.memorial_sub ?? null);
  const weddingSub = normalizeSubscription(user.weddingSub ?? user.wedding_sub ?? null);

  return {
    ...user,
    // Identity
    isEmailVerified: user.isEmailVerified ?? user.is_email_verified ?? false,
    // Subscription - legacy single-plan fields
    subscriptionStatus: user.subscriptionStatus ?? user.subscription_status ?? 'inactive',
    subscriptionPlan: user.subscriptionPlan ?? user.subscription_plan ?? null,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? user.cancel_at_period_end ?? false,
    currentPeriodEnd: user.currentPeriodEnd ?? user.current_period_end ?? null,
    // Dual-subscription flags - populated by /api/auth/me and /api/payments/status
    hasMemorial: user.hasMemorial ?? Boolean(memorialSub),
    hasWedding: user.hasWedding ?? Boolean(weddingSub),
    memorialSub,
    weddingSub,
    // Per-type plan slugs
    memorialPlan: user.memorialPlan ?? user.memorial_plan ?? memorialSub?.planSlug ?? memorialSub?.plan_slug ?? null,
    weddingPlan: user.weddingPlan ?? user.wedding_plan ?? weddingSub?.planSlug ?? weddingSub?.plan_slug ?? null,
    // Quotas & demos
    albumQuota: user.albumQuota ?? user.album_quota ?? 1,
    isDemo: user.isDemo ?? user.is_demo ?? false,
    demoExpiresAt: user.demoExpiresAt ?? user.demo_expires_at ?? null,
    // Timestamps
    createdAt: user.createdAt ?? user.created_at ?? null,
  };
}

export const ALLOWED_SUBSCRIPTION_STATUSES = [
  'active', 'trialing', 'lifetime',
  'past_due', 'halted', 'canceled',
];

export function isSessionActive(user) {
  if (!user) return false;
  return ALLOWED_SUBSCRIPTION_STATUSES.includes(user.subscriptionStatus) || user.isDemo;
}
