/**
 * AffiliatePage
 * Auto-extracted from index.jsx during refactor.
 * Edit this file to modify AffiliatePage in isolation.
 */

import { useEffect, useState } from 'react';
import { APP_URL, apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { fmtDate } from '../../lib/constants';
import Spinner from '../../components/shared/Spinner';

function AffiliatePage({ user, setPage }) {
  const [data,    setData]    = useState(null);   // { affiliate, earnings, recentReferrals }
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const token = getToken();

  // Does this subscriber also have an affiliate account (linked by email)?
  useEffect(() => {
    // Try to find if this user is an affiliate by email match
    apiCall('/api/affiliates/me/subscriber', {}, token)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyLink = (code) => {
    const link = `${APP_URL}/?ref=${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'4rem' }}>
      <Spinner dark />
    </div>
  );

  // ── Not an affiliate yet ──
  if (!data?.affiliate) {
    return (
      <div style={{ maxWidth: 620 }}>
        {/* How it works */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8EAED', padding:'1.5rem', marginBottom:'1.25rem' }}>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontSize:'0.95rem', fontWeight:700, color:'#1a1a1a', marginBottom:'1rem' }}>
            🤝 Join the Affiliate Programme
          </div>
          <p style={{ color:'#5A636E', fontSize:'0.88rem', lineHeight:1.6, marginBottom:'1rem' }}>
            Refer photographers, funeral homes, and families. Earn <strong>10% commission</strong> on every subscription you bring in — paid monthly via bank transfer.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginBottom:'1.25rem' }}>
            {[
              { n:'1', t:'Apply at the Affiliate Portal', d:'Register with your email — separate from your subscriber account.' },
              { n:'2', t:'Get approved', d:'We review within 2–3 business days.' },
              { n:'3', t:'Share your code', d:'Your unique referral code is shown here once approved.' },
              { n:'4', t:'Earn commissions', d:'10% of every subscription from your referrals.' },
            ].map(s => (
              <div key={s.n} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start' }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'#F4F5F7', display:'flex',
                  alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700,
                  color:'#1a1a1a', flexShrink:0, marginTop:2 }}>{s.n}</div>
                <div>
                  <div style={{ fontWeight:600, color:'#1a1a1a', fontSize:'0.85rem' }}>{s.t}</div>
                  <div style={{ color:'#8A9099', fontSize:'0.78rem', marginTop:'0.1rem' }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <a href="/affiliate" target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-block', background:'#1a1a1a', color:'#fff', padding:'0.7rem 1.5rem',
              borderRadius:10, fontWeight:700, fontSize:'0.88rem', textDecoration:'none' }}>
            Apply / Sign In to Affiliate Portal →
          </a>
          <p style={{ fontSize:'0.72rem', color:'#8A9099', marginTop:'0.5rem' }}>Opens in a new tab · Your subscriber account is separate</p>
        </div>
      </div>
    );
  }

  // ── Affiliate stats dashboard ──
  const aff       = data.affiliate;
  const earnings  = data.earnings  || {};
  const referrals = data.recentReferrals || [];
  const isPending = aff.status !== 'active';

  return (
    <div style={{ maxWidth: 900 }}>
      {isPending && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10,
          padding:'0.85rem 1.1rem', marginBottom:'1.25rem', fontSize:'0.85rem', color:'#92400E' }}>
          ⏳ Your affiliate application is <strong>{aff.status}</strong>. 
          We review applications within 2–3 business days and will notify you by email.
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { label:'Total Referrals', val: aff.total_referrals || 0,     icon:'👥' },
          { label:'Total Earned',    val: fmt(aff.total_earnings),       icon:'💰' },
          { label:'Pending Payout',  val: fmt(earnings.pending_amount),  icon:'⏳' },
          { label:'Total Paid Out',  val: fmt(aff.total_paid_out),       icon:'✅' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8EAED', padding:'1.25rem' }}>
            <div style={{ fontSize:'1.25rem', marginBottom:'0.4rem' }}>{s.icon}</div>
            <div style={{ fontFamily:"'Manrope',sans-serif", fontSize:'1.4rem', fontWeight:800, color:'#1a1a1a', lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:'0.72rem', color:'#8A9099', marginTop:'0.3rem', fontWeight:500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem', marginBottom:'1.25rem' }}>
        {/* Referral code card */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8EAED', padding:'1.5rem' }}>
          <div style={{ fontFamily:"'Manrope',sans-serif", fontSize:'0.9rem', fontWeight:700, color:'#1a1a1a', marginBottom:'1rem' }}>
            🔗 Your Referral Code
          </div>
          <div style={{ background:'#F4F5F7', borderRadius:10, padding:'1rem', marginBottom:'0.75rem',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem' }}>
            <code style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:700,
              color:'#C9A84C', letterSpacing:'0.08em' }}>
              {aff.referral_code}
            </code>
            <button onClick={() => copyCode(aff.referral_code)}
              style={{ background:'#1a1a1a', color:'#fff', border:'none', borderRadius:7,
                padding:'0.35rem 0.75rem', cursor:'pointer', fontSize:'0.75rem', fontWeight:600, flexShrink:0 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ fontSize:'0.78rem', color:'#8A9099', marginBottom:'0.75rem' }}>
            Share this code or your referral link:
          </div>
          <div style={{ background:'#F4F5F7', borderRadius:8, padding:'0.5rem 0.75rem',
            fontSize:'0.72rem', color:'#5A636E', fontFamily:'monospace', wordBreak:'break-all',
            marginBottom:'0.5rem' }}>
            {APP_URL}/?ref={aff.referral_code}
          </div>
          <button onClick={() => copyLink(aff.referral_code)}
            style={{ background:'#F4F5F7', color:'#1a1a1a', border:'none', borderRadius:8,
              padding:'0.5rem 0.75rem', cursor:'pointer', fontSize:'0.78rem', fontWeight:600, width:'100%' }}>
            📋 Copy Referral Link
          </button>
        </div>

        {/* Commission rate card */}
        <div style={{ background:'linear-gradient(135deg,#0f0f13,#1a1a22)', borderRadius:14,
          border:'1px solid rgba(201,168,76,0.2)', padding:'1.5rem', display:'flex',
          flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'0.78rem', fontWeight:600, color:'rgba(232,234,240,0.4)',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>
              Your Commission Rate
            </div>
            <div style={{ fontFamily:"'Manrope',sans-serif", fontSize:'3rem', fontWeight:800,
              color:'#C9A84C', lineHeight:1 }}>
              {parseFloat(aff.commission_rate || 10).toFixed(0)}%
            </div>
            <div style={{ fontSize:'0.82rem', color:'rgba(232,234,240,0.5)', marginTop:'0.4rem' }}>
              of every subscription amount
            </div>
          </div>
          <div style={{ marginTop:'1rem', fontSize:'0.78rem', color:'rgba(232,234,240,0.4)', lineHeight:1.5 }}>
            {earnings.pending_count || 0} pending · {earnings.paid_count || 0} paid commissions
          </div>
        </div>
      </div>

      {/* Recent referrals */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8EAED', padding:0, overflow:'hidden' }}>
        <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid #E8EAED',
          fontFamily:"'Manrope',sans-serif", fontSize:'0.9rem', fontWeight:700, color:'#1a1a1a' }}>
          Recent Referrals
        </div>
        {referrals.length === 0 ? (
          <div style={{ padding:'2.5rem', textAlign:'center', color:'#8A9099', fontSize:'0.85rem' }}>
            <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>🕳</div>
            No referrals yet. Share your code to start earning!
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F9FAFB' }}>
                {['Name', 'Plan', 'Status', 'Commission', 'Date'].map(h => (
                  <th key={h} style={{ textAlign:'left', fontSize:'0.68rem', fontWeight:700,
                    color:'#8A9099', textTransform:'uppercase', letterSpacing:'0.05em',
                    padding:'0.6rem 1rem', borderBottom:'1.5px solid #E8EAED' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {referrals.map((r, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #F0F1F3' }}>
                  <td style={{ padding:'0.75rem 1rem', fontSize:'0.85rem', fontWeight:600, color:'#1a1a1a' }}>{r.name}</td>
                  <td style={{ padding:'0.75rem 1rem', fontSize:'0.82rem', color:'#5A636E' }}>{r.subscription_plan || '—'}</td>
                  <td style={{ padding:'0.75rem 1rem' }}>
                    <span style={{ background: r.subscription_status === 'active' ? '#F0FDF4' : '#F9FAFB',
                      color: r.subscription_status === 'active' ? '#16A34A' : '#8A9099',
                      padding:'0.2rem 0.5rem', borderRadius:100, fontSize:'0.7rem', fontWeight:600 }}>
                      {r.subscription_status || 'inactive'}
                    </span>
                  </td>
                  <td style={{ padding:'0.75rem 1rem', fontSize:'0.82rem', fontWeight:600, color:'#C9A84C' }}>
                    {r.commission_earned ? fmt(r.commission_earned) : '—'}
                  </td>
                  <td style={{ padding:'0.75rem 1rem', fontSize:'0.78rem', color:'#8A9099' }}>
                    {r.created_at ? fmtDate(r.created_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop:'1rem', fontSize:'0.78rem', color:'#8A9099', textAlign:'center' }}>
        <a href="/affiliate" target="_blank" rel="noopener noreferrer"
          style={{ color:'#C9A84C', textDecoration:'none', fontWeight:600 }}>
          Open full Affiliate Portal →
        </a>
        {' '}(manage bank details, view all commissions)
      </div>
    </div>
  );
}


// ── PUBLIC ALBUM VIEW ─────────────────────────────────────────
const ICON_MAP_PREVIEW = {
  star:"⭐", heart:"❤️", education:"🎓", work:"💼", wedding:"💍",
  travel:"✈️", award:"🏆", home:"🏠", music:"🎵", baby:"👶",
  flag:"🚩", gift:"🎁", camera:"📷", book:"📚", globe:"🌍",
};

// PublicView: uses the same layout as /album/[slug].jsx


export default AffiliatePage;
