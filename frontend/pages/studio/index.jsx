/**
 * pages/studio/index.jsx — Photographer Studio Dashboard
 *
 * Refactored for the new entitlement model:
 *  - All plan limits come from GET /api/studio/billing/status (not studio.plan hardcodes)
 *  - Team tab uses invite flow (POST /api/studio/invites) with pending invites list
 *  - Billing tab shows active subscription, upgrade/cancel, links to /studio/billing
 *  - Multi-studio switcher in nav (x-studio-id header support)
 *  - No subscription → locked state with CTA to /studio/billing
 */

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getPublicAlbumPath } from '../../lib/routes';
import { getToken, clearToken } from '../../lib/auth';
import {
  clearStudioId as resetStudioId,
} from '../../lib/studio-client';
import { studioBaseCss } from '../../styles/studio-template';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in';
const STUDIO_KEY = 'mqr_studio_id';

// ── API helpers ───────────────────────────────────────────────
const getStudioId  = () => typeof window !== 'undefined' ? localStorage.getItem(STUDIO_KEY) : null;
const setStudioId  = (id) => localStorage.setItem(STUDIO_KEY, id);

async function api(path, opts = {}) {
  const token    = getToken();
  const studioId = getStudioId();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token    ? { Authorization: `Bearer ${token}` }    : {}),
      ...(studioId ? { 'x-studio-id': studioId }             : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiUpload(path, formData) {
  const token    = getToken();
  const studioId = getStudioId();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      ...(token    ? { Authorization: `Bearer ${token}` } : {}),
      ...(studioId ? { 'x-studio-id': studioId }          : {}),
    },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPlan(slug) {
  if (!slug) return 'No plan';
  return slug.replace('studio-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
  ${studioBaseCss}
  .nav-left { display: flex; align-items: center; gap: 1rem; }
  .studio-switcher {
    padding: 0.45rem 0.75rem;
    font-size: 0.8rem;
    cursor: pointer;
    appearance: auto;
  }
  .nav-tabs { display: flex; gap: 0.25rem; }
  .nav-tab {
    background: transparent;
    border: none;
    color: var(--text3);
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.82rem;
    transition: all 0.15s;
  }
  .nav-tab:hover { background: rgba(255,255,255,0.5); color: var(--text2); }
  .nav-tab.active { background: rgba(255,255,255,0.68); color: var(--text); }
  .nav-right { display: flex; align-items: center; gap: 0.75rem; }
  .btn-gold { padding: 0.55rem 1.2rem; font-size: 0.85rem; font-weight: 600; white-space: nowrap; }
  .btn-outline { padding: 0.5rem 1rem; font-size: 0.82rem; }
  .btn-red { padding: 0.38rem 0.78rem; cursor: pointer; font-size: 0.78rem; }

  /* LOCK BANNER */
  .lock-banner { background: linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03));
    border: 1px solid rgba(201,168,76,0.25); border-radius: var(--radius);
    padding: 1.5rem 2rem; margin-bottom: 2rem;
    display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .lock-banner-text h3 { font-size: 1rem; font-weight: 600; color: var(--gold); margin-bottom: 0.25rem; }
  .lock-banner-text p { font-size: 0.82rem; color: var(--text2); }

  /* STATS */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr));
    gap: 1rem; margin-bottom: 2rem; }
  .stat { background: var(--dark2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.25rem 1.4rem; }
  .stat-label { font-size: 0.7rem; color: var(--text3);
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem; }
  .stat-value { font-size: 1.85rem; font-weight: 700; line-height: 1; }
  .stat-sub { font-size: 0.7rem; color: var(--text3); margin-top: 0.25rem; }
  .gold { color: var(--gold); } .green { color: var(--green); }
  .red  { color: var(--red);  } .blue  { color: var(--blue);  }
  .purple { color: var(--purple); }

  /* QUOTA BAR */
  .quota-bar-wrap { background: var(--dark2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.1rem 1.4rem; margin-bottom: 2rem; }
  .quota-bar-label { font-size: 0.78rem; color: var(--text3); margin-bottom: 0.55rem;
    display: flex; justify-content: space-between; align-items: center; }
  .quota-bar-track { height: 7px; background: var(--dark4); border-radius: 100px; overflow: hidden; }
  .quota-bar-fill { height: 100%; border-radius: 100px;
    background: linear-gradient(90deg, var(--gold), var(--gold-light));
    transition: width 0.5s ease; }

  /* SECTION */
  .section-header { display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 1.1rem; gap: 1rem; flex-wrap: wrap; }
  .section-title { font-size: 1rem; font-weight: 600; }
  .search-input { background: var(--dark3); border: 1px solid var(--border);
    border-radius: 10px; padding: 0.5rem 0.85rem; color: var(--text);
    font-size: 0.85rem; outline: none; width: 200px; }
  .search-input:focus { border-color: rgba(201,168,76,0.35); }
  .filter-tabs { display: flex; gap: 0.3rem; }
  .filter-tab { background: transparent; border: 1px solid var(--border);
    color: var(--text3); padding: 0.3rem 0.75rem; border-radius: 8px;
    cursor: pointer; font-size: 0.78rem; }
  .filter-tab.active { background: var(--dark3); border-color: rgba(255,255,255,0.15); color: var(--text); }

  /* ALBUM TABLE */
  .album-table { width: 100%; border-collapse: collapse; }
  .album-table th { font-size: 0.7rem; color: var(--text3); text-transform: uppercase;
    letter-spacing: 0.07em; padding: 0.6rem 1rem; border-bottom: 1px solid var(--border);
    text-align: left; font-weight: 500; }
  .album-table td { padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03);
    font-size: 0.84rem; color: var(--text2); vertical-align: middle; }
  .album-table tr:last-child td { border-bottom: none; }
  .album-table tr:hover td { background: rgba(255,255,255,0.01); }
  .album-name { font-weight: 600; color: var(--text); }
  .album-type { font-size: 0.72rem; color: var(--text3); margin-top: 0.1rem; }

  /* BADGE */
  .badge { display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.68rem; padding: 0.15rem 0.55rem; border-radius: 100px;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .badge.claimed   { background: var(--green-dim);  color: var(--green);  border: 1px solid rgba(34,197,94,0.2); }
  .badge.unclaimed { background: var(--yellow-dim); color: var(--yellow); border: 1px solid rgba(234,179,8,0.2); }
  .badge.wedding   { background: var(--gold-dim);   color: var(--gold);   border: 1px solid rgba(201,168,76,0.25); }
  .badge.memorial  { background: rgba(148,163,184,0.1); color: #94a3b8;   border: 1px solid rgba(148,163,184,0.2); }
  .badge.active    { background: var(--green-dim);  color: var(--green);  border: 1px solid rgba(34,197,94,0.2); }
  .badge.pending   { background: var(--yellow-dim); color: var(--yellow); border: 1px solid rgba(234,179,8,0.2); }
  .badge.expired   { background: var(--red-dim);    color: var(--red);    border: 1px solid rgba(239,68,68,0.2); }

  /* ACTIONS */
  .action-btn { background: transparent; border: 1px solid var(--border);
    color: var(--text3); padding: 0.3rem 0.65rem; border-radius: 7px;
    cursor: pointer; font-size: 0.75rem; white-space: nowrap;
    text-decoration: none; display: inline-block; transition: all 0.15s; }
  .action-btn:hover { border-color: rgba(201,168,76,0.35); color: var(--gold); }
  .actions { display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; }

  /* MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1rem; }
  .modal { background: var(--dark2); border: 1px solid var(--border);
    border-radius: 18px; padding: 2rem; width: 100%; max-width: 500px;
    max-height: 90vh; overflow-y: auto; }
  .modal h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1.5rem; }
  .form-row { margin-bottom: 1rem; }
  .form-label { display: block; font-size: 0.78rem; color: var(--text3); margin-bottom: 0.35rem; }
  .form-input { width: 100%; background: var(--dark3); border: 1px solid var(--border);
    border-radius: 10px; padding: 0.6rem 0.85rem; color: var(--text);
    font-size: 0.88rem; outline: none; font-family: inherit; }
  .form-input:focus { border-color: rgba(201,168,76,0.4); }
  .form-select { appearance: auto; }
  .modal-actions { display: flex; gap: 0.5rem; margin-top: 1.5rem; }
  .error-msg   { color: var(--red);   font-size: 0.8rem; margin-top: 0.5rem; }
  .success-msg { color: var(--green); font-size: 0.8rem; margin-top: 0.5rem; }

  /* QR SHEET */
  .qr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px,1fr)); gap: 1rem; margin-top: 1.25rem; }
  .qr-card { background: var(--dark3); border: 1px solid var(--border);
    border-radius: 12px; padding: 1rem; text-align: center; position: relative; }
  .qr-card input[type=checkbox] { position: absolute; top: 0.75rem; left: 0.75rem; cursor: pointer; }
  .qr-img { width: 130px; height: 130px; border-radius: 8px; margin: 0 auto 0.5rem; }
  .qr-name { font-size: 0.82rem; font-weight: 600; color: var(--text); margin-bottom: 0.15rem; }
  .qr-slug { font-size: 0.68rem; color: var(--text3); word-break: break-all; }

  /* TEAM / INVITE */
  .member-row { display: flex; align-items: center; gap: 1rem;
    padding: 0.85rem 0; border-bottom: 1px solid var(--border); }
  .member-row:last-child { border-bottom: none; }
  .member-avatar { width: 36px; height: 36px; border-radius: 50%;
    background: var(--dark3); display: flex; align-items: center;
    justify-content: center; font-weight: 700; font-size: 0.9rem;
    color: var(--gold); flex-shrink: 0; }
  .member-info { flex: 1; min-width: 0; }
  .member-name  { font-size: 0.88rem; font-weight: 600; color: var(--text); }
  .member-email { font-size: 0.75rem; color: var(--text3); }
  .invite-row { display: flex; align-items: center; gap: 1rem;
    padding: 0.75rem 1rem; border-radius: 10px; background: var(--dark3);
    margin-bottom: 0.5rem; }

  /* BILLING */
  .billing-card { background: var(--dark2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.5rem; margin-bottom: 1rem; }
  .billing-plan-name { font-size: 1.4rem; font-weight: 700; color: var(--gold); margin-bottom: 0.25rem; }
  .billing-meta { font-size: 0.82rem; color: var(--text3); }
  .feature-list { list-style: none; margin: 1rem 0; }
  .feature-list li { font-size: 0.82rem; color: var(--text2); padding: 0.2rem 0; }
  .feature-list li::before { content: '✓ '; color: var(--green); font-weight: 700; }

  /* UPSELL */
  .upsell-item { background: var(--yellow-dim); border: 1px solid rgba(234,179,8,0.25);
    border-radius: 12px; padding: 1rem; margin-bottom: 0.6rem;
    display: flex; align-items: center; gap: 1rem; justify-content: space-between; }
  .upsell-text { font-size: 0.85rem; color: var(--yellow); flex: 1; }

  /* EMPTY + SETUP */
  .empty { text-align: center; padding: 3rem 2rem; color: var(--text3); }
  .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
  .setup-card { background: var(--dark2); border: 1px solid rgba(201,168,76,0.2);
    border-radius: 20px; padding: 2.5rem; max-width: 480px; margin: 4rem auto; text-align: center; }
  .setup-card h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .setup-card p  { color: var(--text2); font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.6; }

  @media (max-width: 700px) {
    .main { padding: 1rem; }
    .stats { grid-template-columns: 1fr 1fr; }
    .album-table th:nth-child(n+5), .album-table td:nth-child(n+5) { display: none; }
    .search-input { width: 130px; }
    .nav-tabs { display: none; }
  }
`;

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════
export default function StudioDashboard() {
  const router = useRouter();

  const [tab,          setTab]          = useState('albums');
  const [studio,       setStudio]       = useState(null);
  const [stats,        setStats]        = useState(null);
  const [entitlement,  setEntitlement]  = useState(null);
  const [studios,      setStudios]      = useState([]);   // for switcher
  const [albums,       setAlbums]       = useState([]);
  const [members,      setMembers]      = useState([]);
  const [invites,      setInvites]      = useState([]);
  const [upsells,      setUpsells]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [noStudio,     setNoStudio]     = useState(false);
  const [toast,        setToast]        = useState(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate,   setShowCreate]   = useState(false);
  const [showQrSheet,  setShowQrSheet]  = useState(false);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [qrItems,      setQrItems]      = useState([]);

  // Studio setup form
  const [setupName,  setSetupName]  = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupBusy,  setSetupBusy]  = useState(false);
  const [setupErr,   setSetupErr]   = useState('');

  const showMsg = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load core data ───────────────────────────────────────────
  const loadAll = async () => {
    try {
      const [studioData, statsData, billingData, albumsData] = await Promise.all([
        api('/api/studio/me'),
        api('/api/studio/me/stats'),
        api('/api/studio/billing/status'),
        api('/api/studio/albums?limit=100'),
      ]);
      setStudio(studioData.studio);
      setStats(statsData);
      setEntitlement(billingData);
      setStudios(billingData.studios || []);
      setAlbums(albumsData.albums || []);
    } catch (err) {
      if (err.message.includes('NO_STUDIO') || err.message.includes('No studio')) {
        setNoStudio(true);
      } else if (err.message.includes('NO_SUBSCRIPTION') || err.message.includes('STUDIO_NO_SUBSCRIPTION')) {
        // Studio exists but no subscription — load studio info only
        try {
          const [studioData, switchData] = await Promise.all([
            api('/api/studio/me'),
            api('/api/studio/switch'),
          ]);
          setStudio(studioData.studio);
          setStudios(switchData.studios || []);
          setEntitlement({ hasActiveSub: false });
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTeam = async () => {
    try {
      const [membersData, invitesData] = await Promise.all([
        api('/api/studio/members'),
        api('/api/studio/invites'),
      ]);
      setMembers(membersData.members || []);
      setInvites(invitesData.invites || []);
    } catch {}
  };

  const loadUpsells = async () => {
    try {
      const d = await api('/api/studio/upsells');
      setUpsells(d.upsells || []);
    } catch {}
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (tab === 'team')    loadTeam();
    if (tab === 'upsells') loadUpsells();
  }, [tab]);

  // ── Studio switcher ──────────────────────────────────────────
  const switchStudio = (id) => {
    setStudioId(id);
    window.location.reload();
  };

  // ── Create studio setup ──────────────────────────────────────
  const createStudio = async (e) => {
    e.preventDefault();
    if (!setupName.trim()) return setSetupErr('Studio name is required.');
    setSetupBusy(true); setSetupErr('');
    try {
      const d = await api('/api/studio', {
        method: 'POST',
        body: JSON.stringify({ name: setupName, email: setupEmail, phone: setupPhone }),
      });
      setStudio(d.studio);
      setNoStudio(false);
      // New studio — needs subscription. Redirect to billing.
      router.push('/studio/billing');
    } catch (err) { setSetupErr(err.message); }
    finally { setSetupBusy(false); }
  };

  // ── Filtered albums ──────────────────────────────────────────
  const filtered = albums.filter(a => {
    const matchStatus = statusFilter === 'all' ? true
      : statusFilter === 'claimed' ? !!a.claimedAt : !a.claimedAt;
    const matchSearch = !search || [a.clientName, a.name, a.clientEmail]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  // ── QR sheet ─────────────────────────────────────────────────
  const openQrSheet = async () => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : albums.slice(0, 20).map(a => a.id);
    try {
      const d = await api(`/api/studio/albums/qr-sheet?ids=${ids.join(',')}`);
      setQrItems(d.items || []);
      setShowQrSheet(true);
    } catch (err) { showMsg(err.message, 'error'); }
  };

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0f16', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: '#C9A84C',
      fontFamily: 'system-ui', fontSize: '0.9rem' }}>
      Loading studio…
    </div>
  );

  // ── No studio yet ────────────────────────────────────────────
  if (noStudio) return (
    <>
      <Head><title>Setup Studio</title></Head>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: '#0f0f16', padding: '2rem' }}>
        <div className="setup-card">
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📷</div>
          <h1>Set Up Your Studio</h1>
          <p>Create your photographer studio account to manage client albums, send claim links, and download QR delivery cards.</p>
          <form onSubmit={createStudio}>
            {[
              { label: 'Studio Name *', key: 'name', val: setupName, set: setSetupName, required: true },
              { label: 'Studio Email',  key: 'email', val: setupEmail, set: setSetupEmail, type: 'email' },
              { label: 'Phone',         key: 'phone', val: setupPhone, set: setSetupPhone },
            ].map(f => (
              <div className="form-row" key={f.key} style={{ textAlign: 'left' }}>
                <label className="form-label">{f.label}</label>
                <input className="form-input" type={f.type || 'text'}
                  value={f.val} onChange={e => f.set(e.target.value)}
                  required={f.required} />
              </div>
            ))}
            {setupErr && <p className="error-msg">{setupErr}</p>}
            <button type="submit" className="btn-gold" disabled={setupBusy}
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }}>
              {setupBusy ? 'Setting up…' : 'Create Studio →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );

  const hasActiveSub = entitlement?.hasActiveSub;
  const pct = stats ? Math.min(100, Math.round(
    (stats.albumsUsed / (entitlement?.albumQuota || stats.albumQuota || 1)) * 100
  )) : 0;

  const NAV_TABS = [
    { id: 'albums',   label: '📷 Albums' },
    { id: 'team',     label: '👥 Team' },
    { id: 'billing',  label: '💳 Billing' },
    { id: 'upsells',  label: `🔔 Alerts${upsells.length ? ` (${upsells.length})` : ''}` },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <>
      <Head><title>{studio?.name || 'Studio'} — Studio Dashboard</title></Head>
      <style>{CSS}</style>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#DC2626' : '#1a1a1a',
          color: '#fff', padding: '0.75rem 1.5rem', borderRadius: 8,
          fontSize: '0.88rem', zIndex: 999, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>{toast.msg}</div>
      )}

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="nav">
        <div className="nav-left">
          <div className="nav-logo">✦ <span>Studio</span></div>
          {studios.length > 1 ? (
            <select className="studio-switcher"
              value={getStudioId() || studio?.id}
              onChange={e => switchStudio(e.target.value)}>
              {studios.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{studio?.name}</span>
          )}
        </div>
        <div className="nav-tabs">
          {NAV_TABS.map(t => (
            <button key={t.id} className={`nav-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="nav-right">
          <button className="btn-outline"
            onClick={() => {
              clearToken();
              resetStudioId();
              window.location.href = '/';
            }}>
            Sign Out
          </button>
        </div>
      </nav>

      <main className="main">

        {/* ── Subscription lock banner ─────────────────────── */}
        {!hasActiveSub && tab !== 'billing' && tab !== 'settings' && (
          <div className="lock-banner">
            <div className="lock-banner-text">
              <h3>🔒 Subscribe to unlock studio features</h3>
              <p>Choose a photographer plan to create client albums, manage your team, and export QR sheets.</p>
            </div>
            <button className="btn-gold" onClick={() => router.push('/studio/billing')}>
              View Plans →
            </button>
          </div>
        )}

        {/* ══ ALBUMS TAB ══════════════════════════════════════ */}
        {tab === 'albums' && (
          <>
            <div className="stats">
              {[
                { label: 'Total Albums',    value: stats?.totalAlbums ?? 0,   cls: 'gold'   },
                { label: 'Claimed',         value: stats?.claimed     ?? 0,   cls: 'green'  },
                { label: 'Awaiting Claim',  value: stats?.unclaimed   ?? 0,   cls: ''       },
                { label: 'Slots Left',      value: stats?.albumsLeft  ?? '—', cls: (stats?.albumsLeft ?? 99) < 3 ? 'red' : 'blue',
                  sub: `of ${entitlement?.albumQuota || stats?.albumQuota || '—'} total` },
                { label: 'Team Seats',      value: entitlement?.seatQuota ? `${entitlement.seatsUsed ?? '?'}/${entitlement.seatQuota}` : '—', cls: 'purple' },
              ].map((s, i) => (
                <div key={i} className="stat">
                  <div className="stat-label">{s.label}</div>
                  <div className={`stat-value ${s.cls}`}>{s.value}</div>
                  {s.sub && <div className="stat-sub">{s.sub}</div>}
                </div>
              ))}
            </div>

            {stats && (
              <div className="quota-bar-wrap">
                <div className="quota-bar-label">
                  <span>Album Slot Usage</span>
                  <span style={{ color: pct > 80 ? 'var(--red)' : 'var(--text3)' }}>
                    {stats.albumsUsed} / {entitlement?.albumQuota || stats.albumQuota}
                    {pct > 80 && ' — '}
                    {pct > 80 && (
                      <button onClick={() => setTab('billing')}
                        style={{ background: 'none', border: 'none', color: 'var(--gold)',
                          cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>
                        Upgrade plan ↗
                      </button>
                    )}
                  </span>
                </div>
                <div className="quota-bar-track">
                  <div className="quota-bar-fill" style={{
                    width: `${pct}%`,
                    background: pct > 80
                      ? 'linear-gradient(90deg,#ef4444,#f87171)'
                      : 'linear-gradient(90deg,var(--gold),var(--gold-light))',
                  }} />
                </div>
              </div>
            )}

            <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div className="section-header" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input className="search-input" placeholder="Search client…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                  <div className="filter-tabs">
                    {['all', 'claimed', 'unclaimed'].map(f => (
                      <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`}
                        onClick={() => setStatusFilter(f)}>
                        {f[0].toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {albums.length > 0 && (
                    <button className="btn-outline" onClick={openQrSheet}>
                      ⬇ QR Sheet {selectedIds.size > 0 ? `(${selectedIds.size})` : '(all)'}
                    </button>
                  )}
                  <button className="btn-gold" onClick={() => setShowCreate(true)}
                    disabled={!hasActiveSub}>
                    + New Client Album
                  </button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📷</div>
                  <div>{hasActiveSub ? 'No albums yet. Create your first client album.' : 'Subscribe to start creating client albums.'}</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="album-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>
                          <input type="checkbox"
                            onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(a => a.id)) : new Set())}
                            checked={selectedIds.size === filtered.length && filtered.length > 0} />
                        </th>
                        <th>Client</th><th>Status</th><th>Type</th><th>Photos</th><th>Created</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(a => (
                        <tr key={a.id}>
                          <td>
                            <input type="checkbox" checked={selectedIds.has(a.id)}
                              onChange={e => {
                                const s = new Set(selectedIds);
                                e.target.checked ? s.add(a.id) : s.delete(a.id);
                                setSelectedIds(s);
                              }} />
                          </td>
                          <td>
                            <div className="album-name">{a.clientName || a.name}</div>
                            <div className="album-type">{a.clientEmail || '—'}</div>
                          </td>
                          <td>
                            <span className={`badge ${a.claimedAt ? 'claimed' : 'unclaimed'}`}>
                              {a.claimedAt ? '✓ Claimed' : '⏳ Pending'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${a.type}`}>
                              {a.type === 'wedding' ? '💍' : '🕯'} {a.type}
                            </span>
                          </td>
                          <td><span style={{ color: 'var(--text)' }}>{a.photoCount}</span><span style={{ color: 'var(--text3)', fontSize: '0.72rem' }}> photos</span></td>
                          <td>{fmtDate(a.createdAt)}</td>
                          <td>
                            <AlbumActions album={a} onRefresh={loadAll} showMsg={showMsg} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ TEAM TAB ════════════════════════════════════════ */}
        {tab === 'team' && (
          <TeamTab
            members={members}
            invites={invites}
            entitlement={entitlement}
            onRefresh={loadTeam}
            showMsg={showMsg}
          />
        )}

        {/* ══ BILLING TAB ═════════════════════════════════════ */}
        {tab === 'billing' && (
          <BillingTab entitlement={entitlement} onRefresh={loadAll} showMsg={showMsg} />
        )}

        {/* ══ UPSELL ALERTS TAB ═══════════════════════════════ */}
        {tab === 'upsells' && (
          <UpsellTab upsells={upsells} onRefresh={loadUpsells} showMsg={showMsg} />
        )}

        {/* ══ SETTINGS TAB ════════════════════════════════════ */}
        {tab === 'settings' && studio && (
          <SettingsTab studio={studio} onRefresh={loadAll} showMsg={showMsg} />
        )}
      </main>

      {showCreate && (
        <CreateAlbumModal
          onClose={() => setShowCreate(false)}
          onCreated={(album) => { loadAll(); setShowCreate(false); showMsg(`✓ Album created for ${album.clientName}`); }}
          showMsg={showMsg}
        />
      )}

      {showQrSheet && (
        <QrSheetModal items={qrItems} studio={studio}
          onClose={() => setShowQrSheet(false)} onPrint={() => window.print()} />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// Album Actions
// ══════════════════════════════════════════════════════════════
function AlbumActions({ album, onRefresh, showMsg }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [showQr,  setShowQr]  = useState(false);
  const [qrData,  setQrData]  = useState(null);

  const sendLink = async () => {
    if (!album.clientEmail) return alert('No client email on this album.');
    setSending(true);
    try {
      await api(`/api/studio/albums/${album.id}/send`, { method: 'POST' });
      showMsg(`✓ Claim link sent to ${album.clientEmail}`);
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setSending(false); }
  };

  const viewQr = async () => {
    try {
      const d = await api(`/api/studio/albums/${album.id}`);
      setQrData(d); setShowQr(true);
    } catch (err) { showMsg(err.message, 'error'); }
  };

  const deleteAlbum = async () => {
    if (!confirm(`Delete album for ${album.clientName || album.name}? This cannot be undone.`)) return;
    try {
      await api(`/api/studio/albums/${album.id}`, { method: 'DELETE' });
      onRefresh(); showMsg('Album deleted.');
    } catch (err) { showMsg(err.message, 'error'); }
  };

  return (
    <>
      <div className="actions">
        <a href={album.publicUrl || '#'} target="_blank" rel="noopener noreferrer" className="action-btn">View</a>
        <button className="action-btn" onClick={() => router.push(`/studio/customize/${album.id}`)}>🎨 Style</button>
        {!album.claimedAt && (
          <button className="action-btn" onClick={sendLink} disabled={sending}>
            {sending ? '…' : 'Send Link'}
          </button>
        )}
        <button className="action-btn" onClick={viewQr}>QR</button>
        <button className="btn-red" onClick={deleteAlbum}>✕</button>
      </div>

      {showQr && qrData && (
        <div className="modal-overlay" onClick={() => setShowQr(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 360 }}>
            <h2>{qrData.album?.clientName || qrData.album?.name}</h2>
            <img src={qrData.qrDataUrl} alt="QR"
              style={{ width: 200, height: 200, borderRadius: 12, background: 'white',
                padding: 8, margin: '1rem auto', display: 'block' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '1rem', wordBreak: 'break-all' }}>
              {qrData.albumUrl}
            </div>
            {qrData.claimUrl && (
              <div style={{ background: 'var(--dark3)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '0.75rem', marginBottom: '1rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '0.3rem',
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>Client Claim Link</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gold)', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
                  {qrData.claimUrl}
                </div>
                <button className="action-btn" onClick={() => {
                  navigator.clipboard.writeText(qrData.claimUrl);
                  showMsg('Claim link copied!');
                }}>Copy</button>
              </div>
            )}
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn-outline" onClick={() => setShowQr(false)}>Close</button>
              <button className="btn-gold" onClick={() => {
                const a = document.createElement('a');
                a.download = `qr-${album.slug || album.id}.png`;
                a.href = qrData.qrDataUrl; a.click();
              }}>⬇ Download QR</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// Create Album Modal
// ══════════════════════════════════════════════════════════════
function CreateAlbumModal({ onClose, onCreated, showMsg }) {
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', albumType: 'wedding',
    weddingDate: '', partner1Name: '', partner2Name: '', venueName: '',
  });
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');
  const [sendLink, setSendLink] = useState(true);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim()) return setErr('Client name is required.');
    setBusy(true); setErr('');
    try {
      const d = await api('/api/studio/albums', { method: 'POST', body: JSON.stringify(form) });
      if (sendLink && form.clientEmail) {
        api(`/api/studio/albums/${d.album.id}/send`, { method: 'POST' }).catch(() => {});
      }
      onCreated(d.album);
    } catch (err) { setErr(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>📷 New Client Album</h2>
        <form onSubmit={submit}>
          {[
            { label: 'Client / Couple Name *', key: 'clientName', placeholder: 'e.g. Liana & James' },
            { label: 'Client Email', key: 'clientEmail', placeholder: 'client@email.com', type: 'email' },
          ].map(f => (
            <div className="form-row" key={f.key}>
              <label className="form-label">{f.label}</label>
              <input className="form-input" type={f.type || 'text'}
                placeholder={f.placeholder} value={form[f.key]}
                onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
          <div className="form-row">
            <label className="form-label">Album Type</label>
            <select className="form-input form-select" value={form.albumType}
              onChange={e => set('albumType', e.target.value)}>
              <option value="wedding">💍 Wedding Album</option>
              <option value="memorial">🕯 Memorial Album</option>
            </select>
          </div>
          {form.albumType === 'wedding' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[['partner1Name','Partner 1','e.g. Liana'],['partner2Name','Partner 2','e.g. James']].map(([k,l,p]) => (
                  <div className="form-row" key={k}>
                    <label className="form-label">{l}</label>
                    <input className="form-input" placeholder={p} value={form[k]}
                      onChange={e => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-row">
                  <label className="form-label">Wedding Date</label>
                  <input className="form-input" type="date" value={form.weddingDate}
                    onChange={e => set('weddingDate', e.target.value)} />
                </div>
                <div className="form-row">
                  <label className="form-label">Venue</label>
                  <input className="form-input" placeholder="e.g. Grand Hall"
                    value={form.venueName} onChange={e => set('venueName', e.target.value)} />
                </div>
              </div>
            </>
          )}
          {form.clientEmail && (
            <div className="form-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                fontSize: '0.82rem', color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendLink}
                  onChange={e => setSendLink(e.target.checked)} />
                Send claim link to client after creating
              </label>
            </div>
          )}
          {err && <p className="error-msg">{err}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-gold" disabled={busy}>
              {busy ? 'Creating…' : 'Create Album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// QR Sheet Modal
// ══════════════════════════════════════════════════════════════
function QrSheetModal({ items, studio, onClose, onPrint }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)',
        borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 800,
        maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>📋 QR Delivery Sheet — {studio?.name}</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-gold" onClick={onPrint}>🖨 Print</button>
            <button className="btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: '1rem' }}>
          Print and include one QR card with each delivery. Clients scan to view their album.
        </p>
        <div className="qr-grid">
          {items.map(item => (
            <div key={item.id} className="qr-card">
              <img src={item.qrDataUrl} alt="QR" className="qr-img" />
              <div className="qr-name">{item.client_name || item.name}</div>
              <div className="qr-slug">{item.publicPath || getPublicAlbumPath(item.type, item.slug)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Team Tab — uses invite flow, shows pending invites
// ══════════════════════════════════════════════════════════════
function TeamTab({ members, invites, entitlement, onRefresh, showMsg }) {
  const [showForm, setShowForm] = useState(false);
  const [email,    setEmail]    = useState('');
  const [role,     setRole]     = useState('photographer');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');
  const [copied,   setCopied]   = useState(null);

  const seatQuota  = entitlement?.seatQuota  ?? 5;
  const seatsUsed  = entitlement?.seatsUsed  ?? members.length;
  const hasActiveSub = entitlement?.hasActiveSub;
  const planSlug   = entitlement?.planSlug;

  const sendInvite = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const d = await api('/api/studio/invites', {
        method: 'POST', body: JSON.stringify({ email, role }),
      });
      setEmail(''); setRole('photographer'); setShowForm(false);
      showMsg(d.message);
      onRefresh();
    } catch (err) { setErr(err.message); }
    finally { setBusy(false); }
  };

  const revokeInvite = async (id, email) => {
    if (!confirm(`Revoke invite for ${email}?`)) return;
    try {
      await api(`/api/studio/invites/${id}`, { method: 'DELETE' });
      showMsg('Invite revoked.');
      onRefresh();
    } catch (err) { showMsg(err.message, 'error'); }
  };

  const removeMember = async (userId, name) => {
    if (!confirm(`Remove ${name} from studio?`)) return;
    try {
      await api(`/api/studio/members/${userId}`, { method: 'DELETE' });
      showMsg(`${name} removed.`); onRefresh();
    } catch (err) { showMsg(err.message, 'error'); }
  };

  const copyInviteUrl = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const pendingInvites = invites.filter(i => i.is_pending);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Members card */}
      <div className="billing-card">
        <div className="section-header" style={{ marginBottom: '1.25rem' }}>
          <div>
            <div className="section-title">👥 Team Members</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '0.2rem' }}>
              {seatsUsed} / {seatQuota === 9999 ? '∞' : seatQuota} seats used
              {planSlug && ` · ${fmtPlan(planSlug)} plan`}
            </div>
          </div>
          <button className="btn-gold" onClick={() => setShowForm(f => !f)}
            disabled={!hasActiveSub || seatsUsed >= seatQuota}>
            + Invite Member
          </button>
        </div>

        {showForm && (
          <form onSubmit={sendInvite} style={{ background: 'var(--dark3)', borderRadius: 12,
            padding: '1.25rem', marginBottom: '1.25rem',
            display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label className="form-label">Email address</label>
              <input className="form-input" type="email" placeholder="photographer@studio.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Role</label>
              <select className="form-input form-select" value={role}
                onChange={e => setRole(e.target.value)}>
                <option value="photographer">Photographer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="submit" className="btn-gold" disabled={busy}>{busy ? '…' : 'Send Invite'}</button>
              <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
            {err && <p className="error-msg" style={{ gridColumn: '1/-1' }}>{err}</p>}
          </form>
        )}

        {members.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div>
            <div>No team members yet.</div></div>
        ) : (
          members.map(m => (
            <div key={m.id} className="member-row">
              <div className="member-avatar">{m.name?.[0]?.toUpperCase() || '?'}</div>
              <div className="member-info">
                <div className="member-name">{m.name}</div>
                <div className="member-email">{m.email}</div>
              </div>
              <span className="badge" style={{
                background: m.role === 'owner' ? 'var(--gold-dim)' : 'var(--dark3)',
                color: m.role === 'owner' ? 'var(--gold)' : 'var(--text3)',
                border: '1px solid transparent',
              }}>{m.role}</span>
              {m.role !== 'owner' && (
                <button className="btn-red" onClick={() => removeMember(m.user_id, m.name)}>Remove</button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pending invites card */}
      {pendingInvites.length > 0 && (
        <div className="billing-card">
          <div className="section-title" style={{ marginBottom: '1rem' }}>
            📨 Pending Invites ({pendingInvites.length})
          </div>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="invite-row">
              <div className="member-avatar" style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>
                {inv.email[0].toUpperCase()}
              </div>
              <div className="member-info">
                <div className="member-name">{inv.email}</div>
                <div className="member-email">
                  Role: {inv.role} · Expires {fmtDate(inv.expires_at)}
                </div>
              </div>
              <span className="badge pending">Pending</span>
              <button className="action-btn" onClick={() => {
                const url = inv.inviteUrl || (inv.token ? `${window.location.origin}/studio/join/${inv.token}` : '');
                if (!url) {
                  showMsg('Invite link is unavailable. Please resend the invite.', 'error');
                  return;
                }
                copyInviteUrl(url, inv.id);
              }}>
                {copied === inv.id ? '✓ Copied' : 'Copy Link'}
              </button>
              <button className="btn-red" onClick={() => revokeInvite(inv.id, inv.email)}>Revoke</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Billing Tab
// ══════════════════════════════════════════════════════════════
function BillingTab({ entitlement, onRefresh, showMsg }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  const cancelSub = async () => {
    if (!confirm('Cancel subscription at end of billing period?')) return;
    setCancelling(true);
    try {
      await api('/api/studio/billing/cancel', { method: 'POST' });
      showMsg('Subscription will cancel at period end.');
      onRefresh();
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setCancelling(false); }
  };

  if (!entitlement?.hasActiveSub) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', paddingTop: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          No active studio subscription
        </h2>
        <p style={{ color: 'var(--text2)', marginBottom: '2rem', lineHeight: 1.6 }}>
          Subscribe to a Photographer plan to unlock client albums, team seats, QR exports, and more.
        </p>
        <button className="btn-gold" style={{ padding: '0.8rem 2rem', fontSize: '0.95rem' }}
          onClick={() => router.push('/studio/billing')}>
          View Photographer Plans →
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="billing-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text3)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Active Plan</div>
            <div className="billing-plan-name">{fmtPlan(entitlement.planSlug)}</div>
            <div className="billing-meta">
              Status: <span style={{ color: entitlement.cancelAtPeriodEnd ? 'var(--yellow)' : 'var(--green)' }}>
                {entitlement.cancelAtPeriodEnd ? 'Cancels at period end' : 'Active'}
              </span>
              {entitlement.currentPeriodEnd && (
                <> · Renews {fmtDate(entitlement.currentPeriodEnd)}</>
              )}
            </div>
          </div>
          <span className={`badge ${entitlement.status}`}>{entitlement.status}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Album Slots',     value: entitlement.albumQuota  === 9999 ? 'Unlimited' : entitlement.albumQuota },
            { label: 'Team Seats',      value: entitlement.seatQuota   === 9999 ? 'Unlimited' : entitlement.seatQuota },
            { label: 'Studio Branding', value: entitlement.brandingEnabled      ? '✓ Enabled' : '✗ Not included' },
            { label: 'White-label',     value: entitlement.whitelabelEnabled    ? '✓ Enabled' : '✗ Not included' },
            { label: 'Custom Domain',   value: entitlement.customDomainEnabled  ? '✓ Enabled' : '✗ Not included' },
            { label: 'Album Customizer',value: entitlement.customizerEnabled    ? '✓ Enabled' : '✗ Not included' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'var(--dark3)', borderRadius: 10, padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: '0.07em', marginBottom: '0.25rem' }}>{item.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600,
                color: String(item.value).startsWith('✗') ? 'var(--text3)' : 'var(--text)' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-gold" onClick={() => router.push('/studio/billing')}>
            Upgrade Plan
          </button>
          {!entitlement.cancelAtPeriodEnd && (
            <button className="btn-outline" onClick={cancelSub} disabled={cancelling}
              style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}>
              {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '0.5rem' }}>
        Billing support: <a href="mailto:support@hriatrengna.in" style={{ color: 'var(--gold)' }}>support@hriatrengna.in</a>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Upsell Alerts Tab
// ══════════════════════════════════════════════════════════════
function UpsellTab({ upsells, onRefresh, showMsg }) {
  const resolve = async (id) => {
    try {
      await api(`/api/studio/upsells/${id}/resolve`, { method: 'PUT' });
      onRefresh(); showMsg('Marked resolved.');
    } catch (err) { showMsg(err.message, 'error'); }
  };

  return (
    <div className="billing-card">
      <div className="section-title" style={{ marginBottom: '1.25rem' }}>🔔 Client Upsell Alerts</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: '1.25rem' }}>
        When a client album hits its limit, an alert appears here.
      </p>
      {upsells.length === 0 ? (
        <div className="empty"><div className="empty-icon">✅</div>
          <div>No pending alerts. All albums are within limits.</div></div>
      ) : (
        upsells.map(u => (
          <div key={u.id} className="upsell-item">
            <div className="upsell-text">
              <strong>{u.client_name || u.album_name}</strong> has hit their limit.
              <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '0.5rem' }}>
                {fmtDate(u.sent_at)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a href={u.publicUrl || '#'} target="_blank" rel="noopener noreferrer" className="action-btn">View</a>
              <button className="btn-outline" onClick={() => resolve(u.id)}>Resolve</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Settings Tab
// ══════════════════════════════════════════════════════════════
function SettingsTab({ studio, onRefresh, showMsg }) {
  const [form, setForm] = useState({
    name: studio.name || '', email: studio.email || '',
    phone: studio.phone || '', website: studio.website || '',
    bio: studio.bio || '', brandingEnabled: studio.brandingEnabled ?? true,
  });
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/studio/me', { method: 'PUT', body: JSON.stringify(form) });
      onRefresh(); showMsg('✓ Studio settings saved');
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      await apiUpload('/api/studio/me/logo', fd);
      onRefresh(); showMsg('✓ Logo updated');
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
      <div className="billing-card">
        <div className="section-title" style={{ marginBottom: '1.25rem' }}>Studio Profile</div>
        {[
          { label: 'Studio Name *', key: 'name' },
          { label: 'Studio Email',  key: 'email',   type: 'email' },
          { label: 'Phone',         key: 'phone' },
          { label: 'Website',       key: 'website', type: 'url' },
        ].map(f => (
          <div className="form-row" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input className="form-input" type={f.type || 'text'}
              value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
        <div className="form-row">
          <label className="form-label">About the Studio</label>
          <textarea className="form-input" rows={3} value={form.bio}
            onChange={e => set('bio', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.82rem', color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.brandingEnabled}
              onChange={e => set('brandingEnabled', e.target.checked)} />
            Show studio name on client albums
          </label>
        </div>
        <button className="btn-gold" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="billing-card">
        <div className="section-title" style={{ marginBottom: '1.25rem' }}>Studio Logo</div>
        {studio.logoUrl && (
          <img src={studio.logoUrl} alt="Studio logo"
            style={{ width: 120, height: 80, objectFit: 'contain', borderRadius: 8,
              background: 'var(--dark3)', padding: '0.5rem', marginBottom: '1rem', display: 'block' }} />
        )}
        <input ref={inputRef} type="file" accept="image/*"
          onChange={uploadLogo} style={{ display: 'none' }} />
        <button className="btn-outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? '⏳ Uploading…' : '📤 Upload Logo'}
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '0.6rem' }}>
          Shown on client albums when branding is enabled. Recommended: 300×200px, transparent PNG.
        </p>
      </div>
    </div>
  );
}
