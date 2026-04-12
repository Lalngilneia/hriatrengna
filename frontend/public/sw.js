// Service Worker for Hriatrengna Admin PWA
// Handles push notifications and offline caching

const CACHE_NAME = 'hriatrengna-admin-v3';
const OFFLINE_URL = '/pwa';
const PWA_SCOPE = '/pwa';
const PWA_ASSETS = new Set([
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/pwa-manifest.json',
]);

// ── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — network first, cache fallback ────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isPwaNavigation = event.request.mode === 'navigate' &&
    (url.pathname === PWA_SCOPE || url.pathname.startsWith(`${PWA_SCOPE}/`));
  const isPwaAsset = PWA_ASSETS.has(url.pathname) || url.pathname.startsWith('/icons/');

  if (!isPwaNavigation && !isPwaAsset) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful same-origin HTML/assets for the admin PWA only.
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match(OFFLINE_URL)))
  );
});

// ── PUSH NOTIFICATION RECEIVED ────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Hriatrengna Admin', body: event.data.text() };
  }

  const options = {
    body:    payload.body   || '',
    icon:    payload.icon   || '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     payload.tag    || 'admin',
    data:    payload.data   || { url: '/pwa' },
    vibrate: [200, 100, 200],
    actions: payload.actions || [],
    requireInteraction: ['affiliate-application', 'payment-failed', 'support'].includes(payload.tag),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Hriatrengna Admin', options)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const url = event.notification.data?.url || '/pwa';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('/pwa') && 'focus' in client) {
          return client.focus().then(c => c.navigate(url));
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
