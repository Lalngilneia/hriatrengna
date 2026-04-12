import { getToken } from './auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in';
export const STUDIO_STORAGE_KEY = 'mqr_studio_id';

export function getStudioId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STUDIO_STORAGE_KEY);
}

export function setStudioId(studioId) {
  if (typeof window === 'undefined') return;
  if (!studioId) {
    localStorage.removeItem(STUDIO_STORAGE_KEY);
    return;
  }
  localStorage.setItem(STUDIO_STORAGE_KEY, studioId);
}

export function clearStudioId() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STUDIO_STORAGE_KEY);
}

export async function studioApi(path, opts = {}) {
  const token = getToken();
  const studioId = getStudioId();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(studioId ? { 'x-studio-id': studioId } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function studioUpload(path, formData, opts = {}) {
  const token = getToken();
  const studioId = getStudioId();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(studioId ? { 'x-studio-id': studioId } : {}),
      ...(opts.headers || {}),
    },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function studioPublicApi(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
