import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AffiliateResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [loading,  setLoading]    = useState(false);
  const [msg,      setMsg]        = useState(null);
  const [done,     setDone]       = useState(false);

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --gold: #C9A84C; --gold-light: #E8C97A;
      --dark: #0f0f16; --dark2: #17171f; --dark3: #1e1e28;
      --text: #E8EAF0; --text2: rgba(232,234,240,0.7); --text3: rgba(232,234,240,0.38);
      --border: rgba(255,255,255,0.07); --radius: 14px;
    }
    body { background: var(--dark); color: var(--text); font-family: system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: var(--dark2); border: 1px solid var(--border); border-radius: 24px; padding: 2.5rem; width: 100%; max-width: 420px; margin: 2rem; }
    .logo { text-align: center; margin-bottom: 2rem; }
    .logo-mark { font-size: 2rem; margin-bottom: 0.5rem; }
    .logo-title { font-size: 1.4rem; font-weight: 700; }
    .logo-sub { font-size: 0.82rem; color: var(--text3); margin-top: 0.3rem; }
    .field { margin-bottom: 1rem; }
    label { display: block; font-size: 0.8rem; color: var(--text3); margin-bottom: 0.4rem; }
    input { width: 100%; background: var(--dark3); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.7rem 1rem; color: var(--text); font-size: 0.92rem; outline: none; }
    input:focus { border-color: rgba(201,168,76,0.4); }
    .btn { width: 100%; padding: 0.85rem; border-radius: var(--radius); border: none; cursor: pointer; font-size: 0.95rem; font-weight: 600; background: var(--gold); color: #111; margin-top: 0.5rem; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .msg { border-radius: 10px; padding: 0.85rem 1rem; font-size: 0.86rem; margin-bottom: 1rem; }
    .msg.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #86efac; }
    .msg.error   { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.25);  color: #fca5a5; }
    .back { text-align: center; margin-top: 1rem; font-size: 0.82rem; }
    .back a { color: var(--gold); text-decoration: none; cursor: pointer; }
  `;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setMsg({ type: "error", text: "Passwords do not match." });
    if (password.length < 8)  return setMsg({ type: "error", text: "Password must be at least 8 characters." });
    setLoading(true); setMsg(null);
    try {
      const r = await fetch(`${API}/api/affiliates/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDone(true);
      setMsg({ type: "success", text: d.message });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Reset Password — Affiliate Portal</title></Head>
      <style>{css}</style>
      <div className="card">
        <div className="logo">
          <div className="logo-mark">🔑</div>
          <div className="logo-title">Reset Password</div>
          <div className="logo-sub">Affiliate Portal — Hriatrengna</div>
        </div>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
        {done ? (
          <div className="back">
            <a href="/affiliate">← Sign in with your new password</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
            </div>
            <button className="btn" disabled={loading || !token}>
              {loading ? "Resetting…" : "Set New Password"}
            </button>
            <div className="back" style={{marginTop:"1rem"}}>
              <a href="/affiliate">← Back to Sign In</a>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
