const REFERRAL_KEY = 'mqr_referral_code';
const REFERRAL_COOKIE = 'mqr_referral_code';
const REFERRAL_MAX_AGE_DAYS = 30;

export function normalizeReferralCode(code) {
  return String(code || '').trim().toUpperCase();
}

function setReferralCookie(code) {
  if (typeof document === 'undefined') return;
  const maxAge = REFERRAL_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function getReferralCookie() {
  if (typeof document === 'undefined') return '';
  const prefix = `${REFERRAL_COOKIE}=`;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : '';
}

export function persistReferralCode(code, { overwrite = false } = {}) {
  if (typeof window === 'undefined') return '';
  const normalized = normalizeReferralCode(code);
  if (!normalized) return '';

  const existing = getStoredReferralCode();
  if (existing && !overwrite) return existing;

  localStorage.setItem(REFERRAL_KEY, normalized);
  sessionStorage.setItem('mqr_pending_referral_code', normalized);
  setReferralCookie(normalized);
  return normalized;
}

export function getStoredReferralCode() {
  if (typeof window === 'undefined') return '';
  return normalizeReferralCode(
    localStorage.getItem(REFERRAL_KEY) ||
    sessionStorage.getItem('mqr_pending_referral_code') ||
    getReferralCookie()
  );
}

export function clearStoredReferralCode() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFERRAL_KEY);
  sessionStorage.removeItem('mqr_pending_referral_code');
  document.cookie = `${REFERRAL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function captureReferralFromLocation(search = '') {
  if (typeof window === 'undefined') return '';
  const query = search || window.location.search || '';
  const params = new URLSearchParams(query);
  const raw = params.get('ref') || params.get('referral') || '';
  const normalized = normalizeReferralCode(raw);
  if (!normalized) return getStoredReferralCode();
  return persistReferralCode(normalized);
}

export function getReferralCode(raw) {
  return normalizeReferralCode(raw) || getStoredReferralCode();
}

export function withReferral(path, explicitCode = '') {
  if (typeof window === 'undefined') return path;
  const code = getReferralCode(explicitCode);
  if (!code) return path;

  try {
    const url = new URL(path, window.location.origin);
    if (!url.searchParams.get('ref')) {
      url.searchParams.set('ref', code);
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}
