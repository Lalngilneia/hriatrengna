import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AffiliateVerifyEmail() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState("loading");
  const [msg, setMsg]       = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/affiliates/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setStatus("error"); setMsg(d.error); }
        else { setStatus("success"); setMsg(d.message); }
      })
      .catch(() => { setStatus("error"); setMsg("Verification failed. Please try again."); });
  }, [token]);

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f16; color: #E8EAF0; font-family: system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #17171f; border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 3rem; text-align: center; max-width: 420px; width: 100%; margin: 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h2 { font-size: 1.4rem; margin-bottom: 0.6rem; }
    p { color: rgba(232,234,240,0.6); font-size: 0.9rem; line-height: 1.6; }
    a { display: inline-block; margin-top: 1.5rem; background: #C9A84C; color: #111; text-decoration: none; padding: 0.7rem 1.8rem; border-radius: 12px; font-weight: 600; font-size: 0.9rem; }
    .spinner { width: 40px; height: 40px; border-radius: 50%; border: 3px solid rgba(201,168,76,0.2); border-top-color: #C9A84C; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  return (
    <>
      <Head><title>Verify Email — Affiliate Portal</title></Head>
      <style>{css}</style>
      <div className="card">
        {status === "loading" && <><div className="spinner" /><p>Verifying your email…</p></>}
        {status === "success" && <>
          <div className="icon">✅</div>
          <h2>Email Verified!</h2>
          <p>{msg}</p>
          <a href="/affiliate">Sign In to Affiliate Portal →</a>
        </>}
        {status === "error" && <>
          <div className="icon">❌</div>
          <h2>Verification Failed</h2>
          <p>{msg}</p>
          <a href="/affiliate">Back to Affiliate Portal</a>
        </>}
      </div>
    </>
  );
}
