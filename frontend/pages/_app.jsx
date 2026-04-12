/**
 * pages/_app.jsx
 *
 * Global stylesheet is now imported here as a real CSS file,
 * not a JS template literal that re-creates a string on every render.
 *
 * Benefits:
 *  - CSS is parsed once by the browser; never re-evaluated as JS
 *  - Next.js can extract it into a separate .css chunk (better caching)
 *  - HMR works: edit app.css → browser hot-reloads styles only
 */

import '../styles/app.css';
import Head from 'next/head';
import ErrorBoundary from '../components/ErrorBoundary';

const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Hriatrengna</title>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1"
        />
        <meta name="application-name" content="Hriatrengna" />
        <meta property="og:site_name" content="Hriatrengna" />
        <meta name="apple-mobile-web-app-title" content="Hriatrengna" />
        {/* Preconnect speeds up font load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS} rel="stylesheet" />
        {/* Razorpay checkout — required globally for payment modal */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" />
      </Head>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  );
}
