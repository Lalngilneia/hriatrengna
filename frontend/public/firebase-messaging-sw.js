// firebase-messaging-sw.js
// Firebase requires this exact filename at the domain root for background FCM messages.
// Config values are hardcoded because service workers cannot access Next.js env vars.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBcbMom7cRxIHFSU5iw32DvcRf5h1E2LTk",
  authDomain:        "hriatrengna.firebaseapp.com",
  projectId:         "hriatrengna",
  storageBucket:     "hriatrengna.firebasestorage.app",
  messagingSenderId: "739740579978",
  appId:             "1:739740579978:web:7213288e5ae45653ad1573",
});

const messaging = firebase.messaging();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── BACKGROUND MESSAGE HANDLER ────────────────────────────────
// Fires when app is in background / closed.
// Foreground messages are handled in pwa/index.jsx via onMessage().
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload);

  const title   = payload.notification?.title || 'MemorialQR';
  const body    = payload.notification?.body  || '';
  const icon    = payload.notification?.icon  || '/icons/icon-192.png';
  const tag     = payload.data?.tag           || 'default';
  const clickUrl = payload.data?.url          || '/pwa';

  self.registration.showNotification(title, {
    body,
    icon,
    badge:   '/icons/icon-192.png',
    tag,
    data:    { url: clickUrl, ...payload.data },
    vibrate: [200, 100, 200],
    requireInteraction: ['affiliate-application', 'payment-failed', 'support'].includes(tag),
  });
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/pwa';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/pwa') && 'focus' in client) {
          return client.focus().then((c) => c.navigate(url));
        }
      }
      return clients.openWindow(url);
    })
  );
});
