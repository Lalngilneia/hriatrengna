/**
 * lib/api.js — MemorialQR centralised HTTP client
 */

import { getToken } from './auth';

// ── Env validation ────────────────────────────────────────────────────────────
// Fallbacks ensure the app still works when env vars are missing at runtime.
// In development: a console warning surfaces immediately.
// In production: the known production URLs are used as safe defaults.
const PROD_API = 'https://api.hriatrengna.in';
const PROD_CDN = 'https://cdn.hriatrengna.in';
const PROD_APP = 'https://hriatrengna.in';

function requireEnv(name, fallback) {
  const val = process.env[name];
  if (!val && typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(`[api] Missing env var: ${name} — using fallback: ${fallback}`);
  }
  return val || fallback;
}

export const API     = requireEnv('NEXT_PUBLIC_API_URL',      PROD_API);
export const CDN     = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL', PROD_CDN);
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL       || PROD_APP;

// ── Config ────────────────────────────────────────────────────────────────────
const TIMEOUT_MS     = 15_000;
const MAX_RETRIES    = 1;
const RETRY_DELAY_MS = 800;
const isRetryable    = (err) => err.name === 'AbortError' || err.name === 'TypeError';
const sleep          = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Core fetch ────────────────────────────────────────────────────────────────
/**
 * apiCall — authenticated JSON fetch with retry + timeout.
 * @param {string}  path     e.g. '/api/albums'
 * @param {object}  options  fetch options
 * @param {string}  [token]  JWT — if omitted reads from localStorage
 * @param {number}  [retries]
 */
export async function apiCall(path, options = {}, token = null, retries = MAX_RETRIES) {
  const jwt = token || getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...(options.headers || {}),
  };

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API}${path}`, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);
      let data = {};
      if (res.headers.get('content-type')?.includes('application/json')) {
        data = await res.json();
      }
      if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (isRetryable(err) && attempt < retries) { await sleep(RETRY_DELAY_MS * (attempt + 1)); continue; }
      throw err;
    }
  }
  throw lastError;
}

// ── Upload helpers ────────────────────────────────────────────────────────────
export async function uploadFile(path, formData, token = null) {
  const jwt = token || getToken();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
  return data;
}

function inferMediaType(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

export function uploadMediaFile(albumId, file, token, onProgress) {
  return new Promise((resolve, reject) => {
    const mediaType = inferMediaType(file);
    if (!mediaType) {
      reject(new Error('Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, MOV, WebM, MP3, M4A, WAV, OGG, or AAC.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', mediaType);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/media/${albumId}/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) onProgress?.(e.loaded, e.total); });
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(data?.error || 'Upload failed')); else resolve(data);
      } catch { reject(new Error('Invalid server response')); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

// ── Typed convenience wrappers ────────────────────────────────────────────────
export const api = {
  get:    (path, token)       => apiCall(path, {},                                       token),
  post:   (path, body, token) => apiCall(path, { method: 'POST',  body: JSON.stringify(body) }, token),
  put:    (path, body, token) => apiCall(path, { method: 'PUT',   body: JSON.stringify(body) }, token),
  patch:  (path, body, token) => apiCall(path, { method: 'PATCH', body: JSON.stringify(body) }, token),
  delete: (path, token)       => apiCall(path, { method: 'DELETE' },                     token),
};
