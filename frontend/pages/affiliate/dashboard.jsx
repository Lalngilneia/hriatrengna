import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --gold: #C9A84C; --gold-light: #E8C97A; --gold-dim: rgba(201,168,76,0.12);
    --dark: #0f0f16; --dark2: #17171f; --dark3: #1e1e28; --dark4: #252535;
    --text: #E8EAF0; --text2: rgba(232,234,240,0.7); --text3: rgba(232,234,240,0.38);
    --border: rgba(255,255,255,0.07); --radius: 14px;
    --green: #22c55e; --green-dim: rgba(34,197,94,0.12);
    --yellow-dim: rgba(234,179,8,0.12); --yellow: #eab308;
  }
  body { background: var(--dark); color: var(--text); font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }

  /* NAV */
  .navbar { background: var(--dark2); border-bottom: 1px solid var(--border); padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 60px; position: sticky; top: 0; z-index: 100; }
  .nav-logo { font-size: 1rem; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 0.5rem; }
  .nav-logo span { color: var(--gold); }
  .nav-right { display: flex; align-items: center; gap: 1rem; }
  .nav-name { font-size: 0.85rem; color: var(--text2); }
  .nav-status { font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 100px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .nav-status.active   { background: var(--green-dim);  color: var(--green); border: 1px solid rgba(34,197,94,0.25); }
  .nav-status.pending  { background: var(--yellow-dim); color: var(--yellow); border: 1px solid rgba(234,179,8,0.25); }
  .nav-status.other    { background: var(--dark3); color: var(--text3); border: 1px solid var(--border); }
  .logout-btn { background: transparent; border: 1px solid var(--border); color: var(--text3); padding: 0.35rem 0.8rem; border-radius: 8px; cursor: pointer; font-size: 0.82rem; }
  .logout-btn:hover { border-color: rgba(239,68,68,0.4); color: #fca5a5; }

  /* LAYOUT */
  .main { max-width: 1100px; margin: 0 auto; padding: 2rem; }

  /* PENDING BANNER */
  .pending-banner { background: var(--yellow-dim); border: 1px solid rgba(234,179,8,0.25); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1.5rem; font-size: 0.88rem; color: var(--yellow); }

  /* STATS GRID */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat-card { background: var(--dark2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.4rem 1.6rem; }
  .stat-label { font-size: 0.75rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; }
  .stat-value { font-size: 1.9rem; font-weight: 700; color: var(--text); line-height: 1; }
  .stat-value.gold { color: var(--gold); }
  .stat-value.green { color: var(--green); }
  .stat-sub { font-size: 0.75rem; color: var(--text3); margin-top: 0.3rem; }

  /* REFERRAL CODE BOX */
  .code-box { background: var(--dark2); border: 1px solid rgba(201,168,76,0.2); border-radius: var(--radius); padding: 1.4rem 1.6rem; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .code-label { font-size: 0.75rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem; }
  .code-value { font-size: 1.5rem; font-weight: 700; color: var(--gold); letter-spacing: 0.12em; font-family: monospace; }
  .code-link  { font-size: 0.78rem; color: var(--text3); margin-top: 0.2rem; word-break: break-all; }
  .copy-btn { background: var(--gold-dim); border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 0.55rem 1.2rem; border-radius: 10px; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
  .copy-btn:hover { background: rgba(201,168,76,0.2); }

  /* GRID 2 COL */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
  @media (max-width: 700px) { .grid2 { grid-template-columns: 1fr; } }
  .panel { background: var(--dark2); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.4rem 1.6rem; }
  .panel-title { font-size: 0.85rem; font-weight: 600; color: var(--text2); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }

  /* COMMISSION TABLE */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 0.72rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.07em; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); }
  td { font-size: 0.84rem; color: var(--text2); padding: 0.7rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; font-size: 0.7rem; padding: 0.15rem 0.55rem; border-radius: 100px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge.paid    { background: var(--green-dim);  color: var(--green); border: 1px solid rgba(34,197,94,0.2); }
  .badge.pending { background: var(--yellow-dim); color: var(--yellow); border: 1px solid rgba(234,179,8,0.2); }

  /* PROFILE FORM */
  .form-field { margin-bottom: 0.9rem; }
  .form-label { font-size: 0.78rem; color: var(--text3); margin-bottom: 0.35rem; display: block; }
  .form-input { width: 100%; background: var(--dark3); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.85rem; color: var(--text); font-size: 0.88rem; outline: none; font-family: inherit; }
  .form-input:focus { border-color: rgba(201,168,76,0.4); }
  .save-btn { background: var(--gold); color: #111; border: none; border-radius: 10px; padding: 0.6rem 1.4rem; cursor: pointer; font-size: 0.88rem; font-weight: 600; }
  .save-btn:hover { background: var(--gold-light); }
  .save-msg { font-size: 0.82rem; color: var(--green); margin-top: 0.5rem; }

  .empty-row { text-align: center; color: var(--text3); font-size: 0.84rem; padding: 1.5rem 0; }
  .spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid rgba(201,168,76,0.2); border-top-color: var(--gold); animation: spin 0.8s linear infinite; margin: 3rem auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default function AffiliateDashboard() {
  const router = useRouter();

  const [data, setData]       = useState(null);
  const [comms, setComms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [profile, setProfile] = useState({ phone: "", businessName: "", bankDetails: { accountName: "", accountNumber: "", ifsc: "", bankName: "" } });

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("affiliate_token") : null);

  const authFetch = (url, opts = {}) =>
    fetch(`${API}${url}`, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(opts.headers || {}) } });

  useEffect(() => {
    if (!token()) { router.push("/affiliate"); return; }
    Promise.all([
      authFetch("/api/affiliates/me").then(r => {
        if (r.status === 401) { router.push("/affiliate"); return null; }
        if (!r.ok) throw new Error("Failed to load profile.");
        return r.json();
      }),
      authFetch("/api/affiliates/me/commissions?limit=10").then(r => {
        if (!r.ok) return { commissions: [] };
        return r.json();
      }).catch(() => ({ commissions: [] })),
    ])
    .then(([d, c]) => {
      if (!d) return;
      setData(d);
      setComms(c.commissions || []);
      const aff = d.affiliate;
      setProfile({
        phone: aff.phone || "",
        businessName: aff.business_name || "",
        bankDetails: aff.bank_details || { accountName: "", accountNumber: "", ifsc: "", bankName: "" },
      });
    })
    .catch(() => router.push("/affiliate"))
    .finally(() => setLoading(false));
  }, []);

  const copyCode = () => {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${data?.affiliate?.referral_code}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const saveProfile = async () => {
    setSaveMsg("");
    const r = await authFetch("/api/affiliates/me", {
      method: "PUT",
      body: JSON.stringify({ phone: profile.phone, businessName: profile.businessName, bankDetails: profile.bankDetails }),
    });
    if (r.ok) setSaveMsg("Saved!");
    else setSaveMsg("Save failed.");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const logout = () => {
    localStorage.removeItem("affiliate_token");
    localStorage.removeItem("affiliate_user");
    router.push("/affiliate");
  };

  if (loading) return <><style>{CSS}</style><div className="spinner" /></>;
  if (!data) return null;

  const { affiliate, earnings, recentReferrals } = data;
  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${affiliate.referral_code}`;
  const isPending    = affiliate.status === "pending";

  return (
    <>
      <Head><title>Affiliate Dashboard — Hriatrengna</title></Head>
      <style>{CSS}</style>

      <nav className="navbar">
        <div className="nav-logo">🤝 Affiliate Portal <span>/ Dashboard</span></div>
        <div className="nav-right">
          <span className="nav-name">{affiliate.name}</span>
          <span className={`nav-status ${affiliate.status === "active" ? "active" : affiliate.status === "pending" ? "pending" : "other"}`}>
            {affiliate.status}
          </span>
          <button className="logout-btn" onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <div className="main">

        {isPending && (
          <div className="pending-banner">
            ⏳ Your application is under review. You'll receive an email once approved. Commission earnings begin after approval.
          </div>
        )}

        {/* STATS */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">Total Referrals</div>
            <div className="stat-value">{affiliate.total_referrals}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Earnings</div>
            <div className="stat-value gold">₹{parseFloat(affiliate.total_earnings || 0).toLocaleString("en-IN")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Payout</div>
            <div className="stat-value gold">₹{parseFloat(earnings?.pending_amount || 0).toLocaleString("en-IN")}</div>
            <div className="stat-sub">{earnings?.pending_count || 0} commission{earnings?.pending_count !== 1 ? "s" : ""}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Paid Out</div>
            <div className="stat-value green">₹{parseFloat(affiliate.total_paid_out || 0).toLocaleString("en-IN")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Commission Rate</div>
            <div className="stat-value">{affiliate.commission_rate}%</div>
            <div className="stat-sub">of each subscription</div>
          </div>
        </div>

        {/* REFERRAL CODE BOX */}
        <div className="code-box">
          <div>
            <div className="code-label">Your Referral Code</div>
            <div className="code-value">{affiliate.referral_code}</div>
            <div className="code-link">{referralLink}</div>
          </div>
          <button className="copy-btn" onClick={copyCode}>{copied ? "✓ Copied!" : "Copy Link"}</button>
        </div>

        {/* RECENT REFERRALS + COMMISSIONS */}
        <div className="grid2">
          <div className="panel">
            <div className="panel-title">👥 Recent Referrals</div>
            {recentReferrals.length === 0
              ? <div className="empty-row">No referrals yet. Share your link!</div>
              : <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Plan</th><th>Joined</th></tr></thead>
                    <tbody>
                      {recentReferrals.map((u, i) => (
                        <tr key={i}>
                          <td>{u.name}</td>
                          <td style={{textTransform:"capitalize"}}>{u.subscription_plan || "—"}</td>
                          <td>{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>

          <div className="panel">
            <div className="panel-title">💰 Recent Commissions</div>
            {comms.length === 0
              ? <div className="empty-row">No commissions yet.</div>
              : <div className="table-wrap">
                  <table>
                    <thead><tr><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {comms.map(c => (
                        <tr key={c.id}>
                          <td style={{color:"var(--gold)"}}>₹{parseFloat(c.amount_inr).toFixed(2)}</td>
                          <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                          <td>{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>

        {/* PROFILE & BANK DETAILS */}
        <div className="panel" style={{marginBottom:"2rem"}}>
          <div className="panel-title">⚙️ Profile &amp; Payout Details</div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem"}}>
            <div className="form-field">
              <label className="form-label">Phone</label>
              <input className="form-input" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} placeholder="+91 98765 43210" />
            </div>
            <div className="form-field">
              <label className="form-label">Business Name</label>
              <input className="form-input" value={profile.businessName} onChange={e => setProfile({...profile, businessName: e.target.value})} />
            </div>
            <div className="form-field">
              <label className="form-label">Account Holder Name</label>
              <input className="form-input" value={profile.bankDetails?.accountName || ""} onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails, accountName: e.target.value}})} />
            </div>
            <div className="form-field">
              <label className="form-label">Account Number</label>
              <input className="form-input" value={profile.bankDetails?.accountNumber || ""} onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails, accountNumber: e.target.value}})} />
            </div>
            <div className="form-field">
              <label className="form-label">IFSC Code</label>
              <input className="form-input" value={profile.bankDetails?.ifsc || ""} onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails, ifsc: e.target.value}})} />
            </div>
            <div className="form-field">
              <label className="form-label">Bank Name</label>
              <input className="form-input" value={profile.bankDetails?.bankName || ""} onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails, bankName: e.target.value}})} />
            </div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:"1rem", marginTop:"0.5rem"}}>
            <button className="save-btn" onClick={saveProfile}>Save Changes</button>
            {saveMsg && <span className="save-msg">{saveMsg}</span>}
          </div>
        </div>

      </div>
    </>
  );
}
