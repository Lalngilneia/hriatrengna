import { useEffect, useRef, useState } from 'react';
import { getReferralCode, persistReferralCode } from '../lib/referral';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in';

export default function GoogleCallback() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Completing sign in, please wait...');
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const googleError = params.get('error');

    if (googleError) {
      setStatus('error');
      setMessage(`Google sign-in was declined: ${googleError}. Please try again.`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorisation code received. Please go back and try signing in again.');
      return;
    }

    const referralCode = getReferralCode(sessionStorage.getItem('mqr_pending_referral_code'));
    if (referralCode) persistReferralCode(referralCode);
    const authEntry = sessionStorage.getItem('mqr_auth_entry') || 'public:login';

    fetch(`${API}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, referralCode: referralCode || undefined }),
    })
      .then((res) => res.json().then((data) => {
        if (!res.ok) throw new Error(data.error || 'Authentication failed. Please try again.');
        return data;
      }))
      .then((data) => {
        localStorage.setItem('mqr_token', data.token);
        sessionStorage.removeItem('mqr_pending_referral_code');

        const [audience, entryMode] = authEntry.split(':');
        const postLoginPage = audience === 'photographer'
          ? (entryMode === 'signup' ? 'studio-billing' : 'studio')
          : (['active', 'trialing', 'lifetime'].includes(data.user?.subscriptionStatus)
            ? 'dashboard'
            : 'payment');

        sessionStorage.setItem('mqr_post_login_page', postLoginPage);
        sessionStorage.removeItem('mqr_auth_entry');

        setStatus('success');
        setMessage('Signed in successfully. Taking you to your account...');

        setTimeout(() => {
          if (postLoginPage === 'studio') {
            window.location.replace('/studio');
            return;
          }
          if (postLoginPage === 'studio-billing') {
            window.location.replace('/studio/billing');
            return;
          }
          window.location.replace('/');
        }, 600);
      })
      .catch((err) => {
        sessionStorage.removeItem('mqr_pending_referral_code');
        sessionStorage.removeItem('mqr_auth_entry');
        setStatus('error');
        setMessage(err.message || 'An error occurred during sign-in. Please try again.');
      });
  }, []);

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #F8F7F5; font-family: 'Inter', system-ui, sans-serif; }
    .page { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
    .card { background: white; border-radius: 28px; box-shadow: 0 16px 60px rgba(44,42,40,0.1); max-width: 440px; width: 100%; padding: 3rem 2.5rem; text-align: center; }
    .icon { font-size: 2.2rem; margin-bottom: 1.2rem; }
    h2 { font-size: 1.75rem; font-weight: 700; color: #2C2A28; margin-bottom: 0.4rem; font-family: 'Manrope', system-ui, sans-serif; }
    p { color: #78716C; font-size: 0.95rem; line-height: 1.6; min-height: 44px; }
    .spinner { width: 36px; height: 36px; border: 3px solid rgba(44,42,40,0.12); border-top-color: #C9A84C; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 1.5rem auto 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-ring { width: 52px; height: 52px; border: 3px solid #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 1rem auto 0; color: #22c55e; font-size: 1.4rem; }
    .btn { display: inline-block; background: #2C2A28; color: white; padding: 0.85rem 1.75rem; border-radius: 100px; text-decoration: none; font-size: 0.95rem; font-weight: 500; margin-top: 1.5rem; }
    .btn:hover { background: #1a1a1a; }
    .error-icon { width: 52px; height: 52px; border: 3px solid #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 1rem auto 0; color: #ef4444; font-size: 1.3rem; }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <div className="card">
          <div className="icon">+</div>
          <h2>
            {status === 'loading' && 'Signing You In'}
            {status === 'success' && 'Welcome Back'}
            {status === 'error' && 'Sign-In Failed'}
          </h2>
          <p>{message}</p>

          {status === 'loading' && <div className="spinner" />}
          {status === 'success' && <div className="success-ring">OK</div>}

          {status === 'error' && (
            <>
              <div className="error-icon">X</div>
              <a href="/" className="btn">Back to Home</a>
            </>
          )}
        </div>
      </div>
    </>
  );
}
