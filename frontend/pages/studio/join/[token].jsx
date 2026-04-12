/**
 * pages/studio/join/[token].jsx — Studio Invite Acceptance
 *
 * Public page. Validates an invite token, shows the studio name + role,
 * and lets the invitee create their account (or sign in if they already have one).
 *
 * Flow:
 *   GET  /api/studio/studio-invite/:token  — validate token, get studio info
 *   POST /api/studio/studio-invite/:token  — accept invite (creates account if needed)
 *   → On success: store JWT + redirect to /studio
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { saveToken } from '../../../lib/auth';
import { studioPublicApi } from '../../../lib/studio-client';
import { studioBaseCss } from '../../../styles/studio-template';

const CSS = `
  ${studioBaseCss}
  body { color: var(--text);
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
  .card { border-radius: var(--radius); padding: 2.5rem; width: 100%; max-width: 460px;
    text-align: center; }
  .logo { font-size: 1rem; font-weight: 700; color: var(--gold);
    margin-bottom: 2rem; }
  .studio-icon { font-size: 2.4rem; margin-bottom: 1rem; }
  .studio-name { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; }
  .invite-detail { font-size: 0.85rem; color: var(--text2); margin-bottom: 0.25rem; }
  .role-badge { display: inline-block;
    font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.7rem;
    border-radius: 100px; text-transform: uppercase; letter-spacing: 0.06em;
    margin: 0.75rem 0 1.5rem; }
  .form { text-align: left; }
  .form-row { margin-bottom: 1rem; }
  .form-label { display: block; font-size: 0.78rem; color: var(--text3);
    margin-bottom: 0.3rem; }
  .form-input { width: 100%; background: var(--dark3);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 0.65rem 0.9rem; color: var(--text); font-size: 0.88rem;
    outline: none; font-family: inherit; }
  .form-input:focus { border-color: rgba(201,168,76,0.4); }
  .btn-gold { width: 100%; padding: 0.85rem; font-size: 0.92rem;
    font-weight: 700; margin-top: 0.5rem; }
  .btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
  .divider { display: flex; align-items: center; gap: 0.75rem;
    margin: 1.25rem 0; color: var(--text3); font-size: 0.78rem; }
  .divider::before, .divider::after { content: ''; flex: 1;
    border-top: 1px solid var(--border); }
  .already-link { font-size: 0.82rem; color: var(--text3); text-align: center;
    margin-top: 1rem; cursor: pointer; }
  .already-link a { color: var(--gold); text-decoration: none; }
  .error-msg { font-size: 0.8rem; margin-top: 0.75rem; }
  .success-box { border-radius: 12px; padding: 1.5rem; margin-top: 1rem; }
  .success-box h3 { color: var(--green); font-size: 1rem; margin-bottom: 0.5rem; }
  .success-box p { color: var(--text2); font-size: 0.85rem; }
  .loading-ring { display: inline-block; width: 36px; height: 36px;
    border: 3px solid rgba(201,168,76,0.2); border-top-color: var(--gold);
    border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .expired-box { border-radius: 12px; margin-top: 1rem; }
  .expired-box h3 { color: var(--red); font-size: 1rem; margin-bottom: 0.5rem; }
  .expired-box p { color: var(--text2); font-size: 0.85rem; }
`;

export default function StudioJoinPage() {
  const router = useRouter();
  const { token } = router.query;

  const [invite, setInvite]   = useState(null);  // validated invite info
  const [state,  setState]    = useState('loading');
  // states: loading | invalid | expired | accepted | form | success

  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    if (!token) return;
    studioPublicApi(`/api/studio/studio-invite/${token}`)
      .then(data => { setInvite(data); setState('form'); })
      .catch(err => {
        if (err.message.toLowerCase().includes('expired'))
          setState('expired');
        else if (err.message.toLowerCase().includes('already been accepted'))
          setState('accepted');
        else
          setState('invalid');
      });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim())        return setErr('Your name is required.');
    if (password.length < 8) return setErr('Password must be at least 8 characters.');
    if (password !== confirm) return setErr('Passwords do not match.');

    setBusy(true);
    try {
      const d = await studioPublicApi(`/api/studio/studio-invite/${token}`, {
        method: 'POST', body: JSON.stringify({ name: name.trim(), password }),
      });
      // Store JWT and redirect to studio dashboard
      if (d.token) {
        saveToken(d.token);
      }
      setState('success');
      setInvite(prev => ({ ...prev, studioName: d.studioName, role: d.role }));
      setTimeout(() => router.push('/studio'), 2000);
    } catch (err) {
      setErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const renderContent = () => {
    if (state === 'loading') return (
      <div style={{ padding: '2rem 0' }}>
        <div className="loading-ring" />
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Validating invite…</div>
      </div>
    );

    if (state === 'invalid') return (
      <div className="expired-box">
        <h3>Invalid Link</h3>
        <p>This invite link is invalid or has already been used. Ask your studio owner to resend.</p>
      </div>
    );

    if (state === 'expired') return (
      <div className="expired-box">
        <h3>Invite Expired</h3>
        <p>This invite link has expired (links are valid for 7 days). Ask your studio owner to send a new one.</p>
      </div>
    );

    if (state === 'accepted') return (
      <div className="success-box">
        <h3>Already Accepted</h3>
        <p>This invite has already been accepted. Sign in to access your studio.</p>
        <button className="btn-gold" style={{ marginTop: '1rem' }}
          onClick={() => router.push('/')}>Sign In →</button>
      </div>
    );

    if (state === 'success') return (
      <div className="success-box" style={{ marginTop: 0 }}>
        <h3>🎉 Welcome to {invite?.studioName}!</h3>
        <p>Your account is ready. Redirecting to your studio dashboard…</p>
      </div>
    );

    // form state
    return (
      <>
        <div className="studio-icon">📷</div>
        <div className="studio-name">{invite?.studioName}</div>
        <div className="invite-detail">You've been invited to join as</div>
        <div className="role-badge">{invite?.role || 'Photographer'}</div>

        {invite?.email && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text3)',
            marginBottom: '1.5rem', background: 'rgba(255,255,255,0.55)',
            padding: '0.6rem 1rem', borderRadius: 8 }}>
            Invite sent to <strong style={{ color: 'var(--text2)' }}>{invite.email}</strong>
          </div>
        )}

        <form className="form" onSubmit={submit}>
          <div className="form-row">
            <label className="form-label">Your Name</label>
            <input className="form-input" type="text" placeholder="e.g. Rohan Sharma"
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label className="form-label">Create Password</label>
            <input className="form-input" type="password" placeholder="Min 8 characters"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="form-row">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" placeholder="Re-enter password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          {err && <p className="error-msg">{err}</p>}
          <button type="submit" className="btn-gold" disabled={busy}>
            {busy ? 'Joining studio…' : 'Accept Invite & Join Studio'}
          </button>
        </form>

        <div className="already-link">
          Already have an account?{' '}
          <a onClick={() => router.push('/')}>Sign in instead →</a>
        </div>

        {invite?.expiresAt && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text3)',
            marginTop: '1.25rem' }}>
            Invite expires {new Date(invite.expiresAt).toLocaleDateString('en-IN',
              { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <Head>
        <title>
          {invite?.studioName
            ? `Join ${invite.studioName} - MemorialQR Studio`
            : 'Studio Invite - MemorialQR'}
        </title>
      </Head>
      <style>{CSS}</style>
      <div className="card">
        <div className="logo">MemorialQR Studio</div>
        {renderContent()}
      </div>
    </>
  );
}
