/**
 * pages/claim/[token].jsx
 * Client claim page — one-time URL sent by photographer.
 * Client visits, sets password, album becomes theirs.
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { saveToken } from '../../lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in';

export default function ClaimPage() {
  const router = useRouter();
  const { token } = router.query;

  const [info,     setInfo]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [name,     setName]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [claiming, setClaiming] = useState(false);
  const [done,     setDone]     = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/studio/claim/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); if (d.albumUrl) setDone({ albumUrl: d.albumUrl }); }
        else setInfo(d);
      })
      .catch(() => setError('Could not load claim info. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  const claim = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setClaiming(true); setError('');
    try {
      const res  = await fetch(`${API}/api/studio/claim/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.token) saveToken(data.token);
      setDone(data);
    } catch (err) { setError(err.message); }
    finally { setClaiming(false); }
  };

  const S = {
    page:   { minHeight: '100vh', background: '#0f0f16',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'system-ui, sans-serif', padding: '1.5rem' },
    card:   { background: '#17171f', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '2.5rem', width: '100%', maxWidth: 440, textAlign: 'center' },
    title:  { fontSize: '1.4rem', fontWeight: 700, color: '#E8EAF0', marginBottom: '0.4rem' },
    sub:    { fontSize: '0.88rem', color: 'rgba(232,234,240,0.6)', marginBottom: '2rem', lineHeight: 1.5 },
    input:  { width: '100%', background: '#1e1e28', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '0.7rem 0.9rem', color: '#E8EAF0',
              fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', marginBottom: '0.8rem' },
    btn:    { width: '100%', background: '#C9A84C', color: '#111', border: 'none',
              borderRadius: 100, padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem',
              cursor: 'pointer', marginTop: '0.5rem' },
    label:  { display: 'block', fontSize: '0.75rem', color: 'rgba(232,234,240,0.5)',
              textAlign: 'left', marginBottom: '0.3rem', marginTop: '0.25rem' },
    err:    { color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.75rem' },
  };

  if (loading) return (
    <div style={S.page}>
      <div style={{ color: '#C9A84C', fontSize: '0.9rem' }}>Loading…</div>
    </div>
  );

  if (done) return (
    <div style={S.page}>
      <Head><title>Album Claimed! — Hriatrengna</title></Head>
      <div style={S.card}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <div style={S.title}>Album Claimed!</div>
        <div style={S.sub}>
          Your photos are ready. You can view and share your album anytime using the link below.
        </div>
        <a href={done.albumUrl}
          style={{ ...S.btn, display: 'block', textDecoration: 'none', textAlign: 'center' }}>
          View My Album →
        </a>
      </div>
    </div>
  );

  if (error && !info) return (
    <div style={S.page}>
      <Head><title>Invalid Link — Hriatrengna</title></Head>
      <div style={S.card}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔗</div>
        <div style={S.title}>Link Unavailable</div>
        <div style={S.sub}>{error}</div>
        <a href="/" style={{ color: '#C9A84C', fontSize: '0.85rem' }}>Go to Hriatrengna →</a>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <Head>
        <title>Claim Your Album — {info?.studioName}</title>
        <meta name="description" content="Claim your wedding album" />
      </Head>
      <div style={S.card}>
        {info?.studioLogoUrl && (
          <img src={info.studioLogoUrl} alt={info.studioName}
            style={{ height: 40, objectFit: 'contain', margin: '0 auto 1.25rem',
              display: 'block', opacity: 0.85 }} />
        )}
        <div style={{ fontSize: '0.72rem', letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#C9A84C', marginBottom: '0.5rem', opacity: 0.85 }}>
          {info?.studioName || 'Your photographer'}
        </div>
        <div style={S.title}>💍 Your Album is Ready</div>
        <div style={S.sub}>
          {info?.albumName} is ready for you to claim.
          Set a password to access your photos anytime.
        </div>
        <form onSubmit={claim}>
          <label style={S.label}>Your Name</label>
          <input style={S.input} placeholder={info?.clientName || 'Your name'}
            value={name} onChange={e => setName(e.target.value)} />
          <label style={S.label}>Create Password *</label>
          <input style={S.input} type="password" placeholder="At least 8 characters"
            value={password} onChange={e => setPassword(e.target.value)} required />
          <label style={S.label}>Confirm Password *</label>
          <input style={S.input} type="password" placeholder="Repeat password"
            value={confirm} onChange={e => setConfirm(e.target.value)} required />
          {error && <div style={S.err}>{error}</div>}
          <button type="submit" style={S.btn} disabled={claiming}>
            {claiming ? 'Claiming…' : 'Claim My Album →'}
          </button>
        </form>
        <p style={{ fontSize: '0.7rem', color: 'rgba(232,234,240,0.35)',
          marginTop: '1.25rem', lineHeight: 1.5 }}>
          By claiming this album you agree to Hriatrengna's terms of service.
          Your photos are stored securely and privately.
        </p>
      </div>
    </div>
  );
}
