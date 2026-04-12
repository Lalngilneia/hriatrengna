import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#1A1A1A" />
        <meta name="description" content="Hriatrengna — Preserve legacies with a beautiful digital memorial album and unique QR code." />
        <meta property="og:title"       content="Hriatrengna" />
        <meta property="og:description" content="Preserve legacies with a beautiful digital memorial album and unique QR code." />
        <meta property="og:type"        content="website" />
        {/* PWA manifest — admin PWA only */}
        <link rel="manifest" href="/pwa-manifest.json" />
        {/* SweetAlert2 */}
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js" async />
        {/* Register admin PWA service worker only under /pwa */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              var isPwaRoute = window.location.pathname === '/pwa' || window.location.pathname.indexOf('/pwa/') === 0;

              if (isPwaRoute) {
                navigator.serviceWorker.register('/sw.js', { scope: '/pwa/' })
                  .then(function(reg) { console.log('[SW] Registered:', reg.scope); })
                  .catch(function(err) { console.warn('[SW] Registration failed:', err); });
                return;
              }

              navigator.serviceWorker.getRegistrations()
                .then(function(registrations) {
                  return Promise.all(registrations.map(function(reg) {
                    var scriptUrl = reg.active && reg.active.scriptURL ? reg.active.scriptURL : '';
                    var isAdminSw = scriptUrl.indexOf('/sw.js') !== -1;
                    var hasRootScope = reg.scope === window.location.origin + '/' || reg.scope === window.location.origin + '/pwa/';

                    if (!isAdminSw || !hasRootScope) return Promise.resolve(false);
                    return reg.unregister();
                  }));
                })
                .then(function() {
                  if (!window.caches) return;
                  return caches.keys().then(function(keys) {
                    return Promise.all(
                      keys
                        .filter(function(key) { return key.indexOf('hriatrengna-admin-') === 0; })
                        .map(function(key) { return caches.delete(key); })
                    );
                  });
                })
                .catch(function(err) { console.warn('[SW] Cleanup failed:', err); });
            });
          }
        `}} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
