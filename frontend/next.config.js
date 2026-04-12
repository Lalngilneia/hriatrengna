/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Scope Next.js lint runs to source directories only.
  // This prevents it scanning .next/, node_modules/, or public/, which
  // avoids ESLint wasting time (and avoids spurious errors) on generated files.
  eslint: {
    dirs: ['pages', 'components', 'lib'],
  },
  env: {
    NEXT_PUBLIC_API_URL:          process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_RAZORPAY_KEY_ID:  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_APP_URL:          process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
  images: {
    remotePatterns: [
    { protocol: 'https', hostname: 'cdn.hriatrengna.in' }
  ],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://accounts.google.com https://www.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' https://cdn.hriatrengna.in blob:",
      "connect-src 'self' https://api.hriatrengna.in https://api.razorpay.com https://lumberjack.razorpay.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://www.googleapis.com wss:",
      "frame-src https://api.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
