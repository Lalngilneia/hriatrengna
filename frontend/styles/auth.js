/**
 * Shared styles for auth/token pages:
 *   - reset-password.jsx
 *   - verify-email.jsx
 *
 * Usage:
 *   import { AUTH_FONTS, AUTH_CSS, Logo } from '../styles/auth';
 *   ...
 *   <style>{AUTH_FONTS + AUTH_CSS}</style>
 *   <Logo />
 */

export const AUTH_FONTS = `@import url(https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Lora:wght@400;500&display=swap);`;

export const AUTH_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    min-height: 100vh;
    background: #111118;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Lora', Georgia, serif;
    background-image: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,100,0.06), transparent);
  }

  /* ── CARD ── */
  .auth-card {
    background: rgba(255,248,235,0.04);
    border: 1px solid rgba(212,175,100,0.2);
    border-radius: 16px;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 420px;
    backdrop-filter: blur(8px);
  }

  /* ── LOGO ── */
  .auth-logo {
    font-family: 'Playfair Display', serif;
    font-size: 1.4rem;
    color: #f5e6c8;
    text-align: center;
    margin-bottom: 0.3rem;
    font-weight: 600;
  }
  .auth-logo span { color: #d4af64; }
  .auth-logo-sub {
    text-align: center;
    font-size: 0.78rem;
    color: #6b5a3a;
    margin-bottom: 2rem;
    letter-spacing: 0.04em;
  }

  /* ── HEADINGS ── */
  .auth-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: #f5e6c8;
    margin-bottom: 0.25rem;
  }
  .auth-desc {
    font-size: 0.82rem;
    color: #9c7c4a;
    margin-bottom: 1.75rem;
    line-height: 1.55;
  }

  /* ── FORM ── */
  .auth-label {
    display: block;
    font-size: 0.8rem;
    color: #c4a882;
    margin-bottom: 0.4rem;
    letter-spacing: 0.02em;
  }
  .auth-input {
    width: 100%;
    padding: 0.7rem 0.9rem;
    background: rgba(255,248,235,0.06);
    border: 1px solid rgba(212,175,100,0.2);
    border-radius: 8px;
    color: #f5e6c8;
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
  }
  .auth-input:focus { border-color: rgba(212,175,100,0.5); background: rgba(255,248,235,0.08); }

  /* ── BUTTON ── */
  .auth-btn {
    width: 100%;
    padding: 0.8rem;
    background: linear-gradient(135deg, #c9922a, #d4af64);
    border: none;
    border-radius: 8px;
    color: #111;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 0.5rem;
    transition: opacity 0.2s, transform 0.15s;
  }
  .auth-btn:hover { opacity: 0.92; transform: translateY(-1px); }
  .auth-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
  .auth-btn-inline {
    display: inline-block;
    padding: 0.75rem 1.8rem;
    width: auto;
    text-decoration: none;
  }

  /* ── ALERTS ── */
  .auth-alert {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.82rem;
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }
  .auth-alert-error {
    background: rgba(220,38,38,0.12);
    border: 1px solid rgba(220,38,38,0.3);
    color: #fca5a5;
  }
  .auth-alert-success {
    background: rgba(16,185,129,0.12);
    border: 1px solid rgba(16,185,129,0.3);
    color: #6ee7b7;
  }

  /* ── STATUS ICONS (verify-email) ── */
  .auth-status-icon { font-size: 3.5rem; text-align: center; margin-bottom: 1rem; }
  .auth-status-title { font-size: 1.3rem; font-weight: 600; color: #f5e6c8; text-align: center; margin-bottom: 0.75rem; }
  .auth-status-desc { font-size: 0.88rem; color: #9c7c4a; text-align: center; line-height: 1.65; margin-bottom: 1.5rem; }

  /* ── SPINNER ── */
  .auth-spinner {
    width: 40px; height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(212,175,100,0.15);
    border-top-color: #d4af64;
    animation: auth-spin 0.8s linear infinite;
    margin: 1rem auto 1.5rem;
  }
  @keyframes auth-spin { to { transform: rotate(360deg); } }

  /* ── BACK LINK ── */
  .auth-back { text-align: center; margin-top: 1.25rem; font-size: 0.8rem; color: #6b5a3a; }
  .auth-back a { color: #d4af64; text-decoration: none; }
  .auth-back a:hover { text-decoration: underline; }
`;

/** Shared logo component — renders ✦ MemorialQR header */
export function Logo({ subtitle = 'MemorialQR' }) {
  return (
    <>
      <div className="auth-logo">✦ Memorial<span>QR</span></div>
      {subtitle && <div className="auth-logo-sub">{subtitle}</div>}
    </>
  );
}
