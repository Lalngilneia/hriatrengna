import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --gold: #C9A84C; --gold-light: #E8C97A; --gold-dim: rgba(201,168,76,0.15);
    --dark: #0f0f16; --dark2: #17171f; --dark3: #1e1e28; --dark4: #252535;
    --text: #E8EAF0; --text2: rgba(232,234,240,0.7); --text3: rgba(232,234,240,0.38);
    --border: rgba(255,255,255,0.07); --radius: 14px;
  }
  body { background: var(--dark); color: var(--text); font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
  .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .card { background: var(--dark2); border: 1px solid var(--border); border-radius: 24px; padding: 2.5rem; width: 100%; max-width: 460px; }
  .logo { text-align: center; margin-bottom: 2rem; }
  .logo-mark { font-size: 2rem; margin-bottom: 0.5rem; }
  .logo-title { font-size: 1.5rem; font-weight: 700; color: var(--text); }
  .logo-sub { font-size: 0.82rem; color: var(--text3); margin-top: 0.3rem; }
  .tabs-row { display: flex; background: var(--dark3); border-radius: 10px; padding: 3px; margin-bottom: 2rem; }
  .tab-btn { flex: 1; padding: 0.55rem; border: none; background: transparent; color: var(--text3); border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 500; transition: all 0.15s; }
  .tab-btn.active { background: var(--dark4); color: var(--text); }
  .field { margin-bottom: 1rem; }
  label { display: block; font-size: 0.8rem; color: var(--text3); margin-bottom: 0.4rem; letter-spacing: 0.03em; }
  input, textarea { width: 100%; background: var(--dark3); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.7rem 1rem; color: var(--text); font-size: 0.92rem; outline: none; transition: border-color 0.15s; font-family: inherit; }
  input:focus, textarea:focus { border-color: rgba(201,168,76,0.4); }
  textarea { resize: vertical; min-height: 80px; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .btn { width: 100%; padding: 0.85rem; border-radius: var(--radius); border: none; cursor: pointer; font-size: 0.95rem; font-weight: 600; transition: all 0.15s; margin-top: 0.5rem; }
  .btn-gold { background: var(--gold); color: #111; }
  .btn-gold:hover { background: var(--gold-light); }
  .btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg { border-radius: 10px; padding: 0.85rem 1rem; font-size: 0.86rem; margin-bottom: 1rem; }
  .msg.success { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); color: #86efac; }
  .msg.error   { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.25);  color: #fca5a5; }
  .divider { text-align: center; color: var(--text3); font-size: 0.8rem; margin: 1.2rem 0; }
  .note { font-size: 0.79rem; color: var(--text3); text-align: center; margin-top: 1.2rem; line-height: 1.6; }
  .note a { color: var(--gold); text-decoration: none; }
`;

export default function AffiliatePage() {
  const router = useRouter();
  const [mode, setMode]       = useState("login"); // "login" | "register" | "forgot"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);

  // Login form
  const [loginEmail, setLoginEmail]   = useState("");
  const [loginPass, setLoginPass]     = useState("");
  const [forgotEmail,  setForgotEmail]  = useState("");
  const [resendEmail,  setResendEmail]  = useState("");
  const [showResend,   setShowResend]   = useState(false);

  // Register form
  const [reg, setReg] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    phone: "", businessName: "", notes: "",
  });

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const token = localStorage.getItem("affiliate_token");
    if (token) router.push("/affiliate/dashboard");
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const r = await fetch(`${API}/api/affiliates/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      localStorage.setItem("affiliate_token", d.token);
      localStorage.setItem("affiliate_user", JSON.stringify(d.affiliate));
      router.push("/affiliate/dashboard");
    } catch (err) {
      setMsg({ type: "error", text: err.message });
      // Auto-show resend form if the error is about email verification
      if (err.message && err.message.toLowerCase().includes("verify your email")) {
        setResendEmail(loginEmail);
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };


  const handleForgot = async (e) => {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const r = await fetch(`${API}/api/affiliates/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: "success", text: d.message });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };


  const handleResend = async (e) => {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const r = await fetch(`${API}/api/affiliates/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const d = await r.json();
      setMsg({ type: "success", text: d.message });
      setShowResend(false);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (reg.password !== reg.confirmPassword)
      return setMsg({ type: "error", text: "Passwords do not match." });
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/affiliates/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reg.name, email: reg.email, password: reg.password,
          phone: reg.phone, businessName: reg.businessName, notes: reg.notes,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: "success", text: d.message });
      setMode("login");
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Affiliate Portal — Hriatrengna</title></Head>
      <style>{CSS}</style>
      <div className="page">
        <div className="card">
          <div className="logo">
            <div className="logo-mark">🤝</div>
            <div className="logo-title">Affiliate Portal</div>
            <div className="logo-sub">Earn commissions by sharing Hriatrengna</div>
          </div>

          <div className="tabs-row">
            <button className={`tab-btn ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setMsg(null); }}>Sign In</button>
            <button className={`tab-btn ${mode === "register" ? "active" : ""}`} onClick={() => { setMode("register"); setMsg(null); }}>Apply Now</button>
            <button className={`tab-btn ${mode === "forgot" ? "active" : ""}`} onClick={() => { setMode("forgot"); setMsg(null); }}>Forgot Password</button>
          </div>

          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          {mode === "login" && (
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>Email Address</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••••••" required />
              </div>
              <button className="btn btn-gold" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
              <p className="note">Not an affiliate yet? <a onClick={() => setMode("register")} style={{cursor:"pointer"}}>Apply here →</a></p>
              <p className="note"><a onClick={() => { setMode("forgot"); setMsg(null); }} style={{cursor:"pointer"}}>Forgot your password?</a></p>
            </form>
          )}

          {/* Resend verification — shown automatically when login fails due to unverified email */}
          {showResend && mode === "login" && (
            <div style={{marginTop:"1rem",background:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.25)",borderRadius:12,padding:"1rem 1.25rem"}}>
              <p style={{fontSize:"0.84rem",color:"#eab308",marginBottom:"0.75rem",fontWeight:600}}>📧 Your email is not verified yet</p>
              <p style={{fontSize:"0.82rem",color:"var(--text2)",marginBottom:"0.85rem",lineHeight:1.6}}>
                Check your inbox (and spam folder) for the verification email. Or enter your email below to resend it.
              </p>
              <form onSubmit={handleResend} style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                <input
                  type="email" required
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{flex:1,background:"var(--dark3)",border:"1px solid var(--border)",borderRadius:10,padding:"0.55rem 0.85rem",color:"var(--text)",fontSize:"0.88rem",outline:"none",minWidth:180}}
                />
                <button type="submit" disabled={loading}
                  style={{background:"#eab308",color:"#111",border:"none",borderRadius:10,padding:"0.55rem 1rem",fontWeight:600,fontSize:"0.85rem",cursor:"pointer",whiteSpace:"nowrap"}}>
                  {loading ? "Sending…" : "Resend Link"}
                </button>
              </form>
            </div>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot}>
              <p style={{fontSize:"0.85rem",color:"var(--text2)",marginBottom:"1.25rem",lineHeight:1.6}}>
                Enter your affiliate email address and we will send you a link to reset your password.
              </p>
              <div className="field">
                <label>Email Address</label>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <button className="btn btn-gold" disabled={loading}>{loading ? "Sending…" : "Send Reset Link"}</button>
              <p className="note" style={{marginTop:"0.75rem"}}>
                <a onClick={() => { setMode("login"); setMsg(null); }} style={{cursor:"pointer"}}>← Back to Sign In</a>
              </p>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister}>
              <div className="row2">
                <div className="field">
                  <label>Full Name *</label>
                  <input value={reg.name} onChange={e => setReg({...reg, name: e.target.value})} placeholder="Your name" required />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input value={reg.phone} onChange={e => setReg({...reg, phone: e.target.value})} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="field">
                <label>Email Address *</label>
                <input type="email" value={reg.email} onChange={e => setReg({...reg, email: e.target.value})} placeholder="you@example.com" required />
              </div>
              <div className="field">
                <label>Business / Organisation Name</label>
                <input value={reg.businessName} onChange={e => setReg({...reg, businessName: e.target.value})} placeholder="Optional" />
              </div>
              <div className="row2">
                <div className="field">
                  <label>Password *</label>
                  <input type="password" value={reg.password} onChange={e => setReg({...reg, password: e.target.value})} placeholder="Min 8 chars" required />
                </div>
                <div className="field">
                  <label>Confirm Password *</label>
                  <input type="password" value={reg.confirmPassword} onChange={e => setReg({...reg, confirmPassword: e.target.value})} placeholder="••••••••" required />
                </div>
              </div>
              <div className="field">
                <label>Tell us about yourself</label>
                <textarea value={reg.notes} onChange={e => setReg({...reg, notes: e.target.value})} placeholder="How do you plan to promote Hriatrengna?" />
              </div>
              <button className="btn btn-gold" disabled={loading}>{loading ? "Submitting…" : "Submit Application"}</button>
              <p className="note">Already have an account? <a onClick={() => setMode("login")} style={{cursor:"pointer"}}>Sign in →</a></p>
              <p className="note" style={{marginTop:"0.6rem"}}>Applications are reviewed within 2–3 business days.</p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
