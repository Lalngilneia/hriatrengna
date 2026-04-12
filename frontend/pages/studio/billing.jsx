/**
 * pages/studio/billing.jsx — Studio Photographer Subscription Page
 *
 * - Fetches studio-specific plans from GET /api/studio/billing/plans
 * - Creates studio checkout orders via POST /api/studio/billing/subscribe
 * - Verifies payment via POST /api/studio/billing/verify
 * - Shows current plan if already subscribed (with upgrade/cancel)
 * - Razorpay checkout embedded inline
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getToken } from '../../lib/auth';
import { studioApi } from '../../lib/studio-client';
import { studioBaseCss } from '../../styles/studio-template';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in';

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPlan(slug) {
  if (!slug) return '';
  return slug.replace('studio-','').replace(/-/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}
function loadRazorpay() {
  return new Promise(res => {
    if (window.Razorpay) return res(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });
}

const CSS = `
  ${studioBaseCss}
  .page { max-width: 1000px; margin: 0 auto; padding: 3rem 1.5rem; }
  .page-header { text-align: center; margin-bottom: 3rem; }
  .page-title { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
  .page-sub { color: var(--text2); font-size: 1rem; }

  /* PLANS GRID */
  .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap: 1.25rem; }
  .plan-card { border: 1.5px solid var(--border);
    border-radius: var(--radius); padding: 2rem; position: relative;
    transition: border-color 0.2s, transform 0.2s; }
  .plan-card:hover { border-color: rgba(201,168,76,0.3); transform: translateY(-2px); }
  .plan-card.featured { border-color: var(--gold);
    background: linear-gradient(145deg, rgba(139,105,68,0.1), rgba(255,255,255,0.88)); }
  .plan-card.featured::before { content: 'Most Popular';
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--gold); color: #111; font-size: 0.7rem; font-weight: 700;
    padding: 0.2rem 0.75rem; border-radius: 100px; letter-spacing: 0.05em; }
  .plan-card.current { border-color: var(--green); }
  .plan-name { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; }
  .plan-price { font-size: 2.2rem; font-weight: 800; color: var(--gold); margin-bottom: 0.25rem; line-height: 1; }
  .plan-period { font-size: 0.78rem; color: var(--text3); margin-bottom: 1.5rem; }
  .plan-features { list-style: none; margin-bottom: 1.75rem; }
  .plan-features li { font-size: 0.85rem; color: var(--text2); padding: 0.3rem 0;
    display: flex; align-items: center; gap: 0.5rem; }
  .plan-features li::before { content: '✓'; color: var(--green); font-weight: 700; flex-shrink: 0; }
  .btn-plan { width: 100%; padding: 0.85rem; cursor: pointer;
    font-size: 0.9rem; font-weight: 600; border: none; transition: all 0.15s; }
  .btn-plan:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-plan.current-btn { background: var(--green-dim); border: 1.5px solid rgba(34,197,94,0.3);
    color: var(--green); cursor: default; }

  /* CURRENT PLAN BANNER */
  .current-banner { border: 1px solid rgba(34,197,94,0.25);
    border-radius: var(--radius); padding: 1.5rem 2rem; margin-bottom: 2.5rem;
    display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
    flex-wrap: wrap; }
  .current-banner-info h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem;
    color: var(--green); }
  .current-banner-info p { font-size: 0.82rem; color: var(--text3); }

  /* TOAST */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 0.88rem; color: #fff;
    z-index: 999; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: fadeUp 0.25s ease; }
  @keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(8px); } }
  .toast.success { background: #2d271f; }
  .toast.error   { background: #DC2626; }

  /* CANCEL / BACK LINK */
  .back-link { color: var(--text3); font-size: 0.82rem; cursor: pointer;
    text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem; }
  .back-link:hover { color: var(--gold); }

  /* FAQ */
  .faq { max-width: 620px; margin: 3rem auto 0; }
  .faq h3 { font-size: 1rem; font-weight: 600; margin-bottom: 1.25rem;
    text-align: center; color: var(--text2); }
  .faq-item { border-bottom: 1px solid var(--border); padding: 1rem 0; }
  .faq-q { font-size: 0.88rem; font-weight: 600; color: var(--text);
    cursor: pointer; display: flex; justify-content: space-between; }
  .faq-a { font-size: 0.82rem; color: var(--text2); margin-top: 0.5rem; line-height: 1.6; }

  @media (max-width: 640px) {
    .page-title { font-size: 1.5rem; }
    .plan-price { font-size: 1.8rem; }
    .plans-grid { grid-template-columns: 1fr; }
  }
`;

const FAQS = [
  { q: 'What is a client album slot?', a: 'Each album you create for a client uses one slot. You can delete albums to free up slots, or upgrade your plan for more.' },
  { q: 'Can I cancel any time?', a: 'Yes. Cancellation takes effect at the end of your current billing period. Your studio and client albums remain accessible until then.' },
  { q: 'What happens to my client albums if I cancel?', a: 'Albums are retained for a 90-day grace period after cancellation. During that window, clients can still view their albums. After the grace period, albums are unpublished.' },
  { q: 'Can I upgrade or downgrade mid-cycle?', a: 'Yes. Upgrading is immediate and prorated. Downgrading takes effect at the next billing cycle.' },
  { q: 'What payment methods are supported?', a: 'All Razorpay methods: UPI, credit/debit cards, net banking, and wallets. All transactions are in INR.' },
];

export default function StudioBillingPage() {
  const router = useRouter();

  const [plans,       setPlans]       = useState([]);
  const [billing,     setBilling]     = useState(null);  // current entitlement
  const [loading,     setLoading]     = useState(true);
  const [subscribing, setSubscribing] = useState(null);  // plan slug being processed
  const [cancelling,  setCancelling]  = useState(false);
  const [toast,       setToast]       = useState(null);
  const [openFaq,     setOpenFaq]     = useState(null);
  const [noAuth,      setNoAuth]      = useState(false);

  const showMsg = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!getToken()) { setNoAuth(true); setLoading(false); return; }
    Promise.all([
      fetch(`${API}/api/studio/billing/plans`).then(r => r.json()),
      studioApi('/api/studio/billing/status').catch(() => ({ hasActiveSub: false })),
    ]).then(([plansData, billingData]) => {
      setPlans(plansData.plans || []);
      setBilling(billingData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const subscribe = async (planSlug) => {
    const loaded = await loadRazorpay();
    if (!loaded) return showMsg('Could not load payment library. Please refresh.', 'error');

    setSubscribing(planSlug);
    try {
      const d = await studioApi('/api/studio/billing/subscribe', {
        method: 'POST', body: JSON.stringify({ plan: planSlug }),
      });

      const options = {
        key:         d.razorpayKeyId,
        order_id:    d.orderId,
        amount:      d.amount,
        currency:    d.currency || 'INR',
        name:        'MemorialQR Studio',
        description: `${fmtPlan(planSlug)} Plan`,
        image:       '/icons/icon-192.png',
        prefill:     d.customer,
        theme:       { color: '#C9A84C' },
        handler: async (response) => {
          try {
            await studioApi('/api/studio/billing/verify', {
              method: 'POST', body: JSON.stringify({
                razorpay_payment_id:      response.razorpay_payment_id,
                razorpay_order_id:        response.razorpay_order_id,
                razorpay_signature:       response.razorpay_signature,
              }),
            });
            showMsg('Studio subscription activated! Redirecting…');
            setTimeout(() => router.push('/studio'), 1800);
          } catch (err) {
            showMsg('Payment captured but verification failed. Contact support.', 'error');
          }
        },
        modal: { ondismiss: () => setSubscribing(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      showMsg(err.message, 'error');
      setSubscribing(null);
    }
  };

  const cancelSub = async () => {
    if (!confirm('Cancel your subscription at the end of the billing period?')) return;
    setCancelling(true);
    try {
      await studioApi('/api/studio/billing/cancel', { method: 'POST' });
      showMsg('Subscription will cancel at period end.');
      // Re-fetch billing status
      const updated = await studioApi('/api/studio/billing/status').catch(() => null);
      if (updated) setBilling(updated);
    } catch (err) { showMsg(err.message, 'error'); }
    finally { setCancelling(false); }
  };

  if (loading) return (
    <>
      <Head><title>Studio Billing</title></Head>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: '#f5f1ea', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#8b6944',
        fontFamily: 'system-ui', fontSize: '0.9rem' }}>
        Loading studio plans...
      </div>
    </>
  );

  if (noAuth) return (
    <>
      <Head><title>Studio Billing</title></Head>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        gap: '1rem', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Please sign in to manage your studio subscription.</div>
        <button onClick={() => router.push('/photographers/login')}
          style={{ background: 'var(--gold)', color: '#fffaf3', border: 'none', borderRadius: 999,
            padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: 600 }}>
          Sign In
        </button>
      </div>
    </>
  );

  const currentPlan = billing?.planSlug;
  const hasActive   = billing?.hasActiveSub;

  return (
    <>
      <Head><title>Studio Plans — MemorialQR</title></Head>
      <style>{CSS}</style>

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}

      <nav className="nav">
        <div className="nav-logo" onClick={() => router.push('/studio')}>✦ Studio</div>
        <button onClick={() => router.push('/studio')}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(232,234,240,0.6)', borderRadius: 8, padding: '0.4rem 0.85rem',
            cursor: 'pointer', fontSize: '0.82rem' }}>
          ← Back to Dashboard
        </button>
      </nav>

      <div className="page">
        <div className="page-header">
          <div style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>
            Photographer Plans
          </div>
          <h1 className="page-title">Run a Professional Studio</h1>
          <p className="page-sub">
            Manage client albums, team members, QR delivery cards, and white-label branding —
            all in one place.
          </p>
        </div>

        {/* Current subscription banner */}
        {hasActive && (
          <div className="current-banner">
            <div className="current-banner-info">
              <h3>✓ Active Plan: {fmtPlan(currentPlan)}</h3>
              <p>
                {billing.cancelAtPeriodEnd
                  ? `Cancels on ${fmtDate(billing.currentPeriodEnd)}`
                  : `Renews on ${fmtDate(billing.currentPeriodEnd)}`}
                {' · '}
                {billing.albumQuota === 9999 ? 'Unlimited' : billing.albumQuota} album slots
                {' · '}
                {billing.seatQuota  === 9999 ? 'Unlimited' : billing.seatQuota} team seats
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!billing.cancelAtPeriodEnd && (
                <button onClick={cancelSub} disabled={cancelling}
                  style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)',
                    color: 'var(--red)', borderRadius: 10, padding: '0.5rem 1rem',
                    cursor: 'pointer', fontSize: '0.82rem' }}>
                  {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
                </button>
              )}
              {billing.cancelAtPeriodEnd && (
                <span style={{ fontSize: '0.8rem', color: 'var(--yellow)',
                  alignSelf: 'center' }}>
                  ⚠ Cancellation scheduled
                </span>
              )}
            </div>
          </div>
        )}

        {/* Plans grid */}
        {plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)',
            fontSize: '0.9rem' }}>
            Studio plans are not yet configured. Contact support.
          </div>
        ) : (
          <div className="plans-grid">
            {plans.map(plan => {
              const isCurrent  = currentPlan === plan.slug;
              const isUpgrade  = hasActive && !isCurrent;
              const busy       = subscribing === plan.slug;
              const features   = (() => {
                try { return JSON.parse(plan.features); } catch { return []; }
              })();

              return (
                <div key={plan.id}
                  className={`plan-card ${plan.is_featured ? 'featured' : ''} ${isCurrent ? 'current' : ''}`}>

                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-price">₹{Math.floor(plan.price_inr / 100).toLocaleString('en-IN')}</div>
                  <div className="plan-period">
                    per {plan.interval === 'monthly' ? 'month' : plan.interval} + GST
                  </div>

                  <ul className="plan-features">
                    {features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>

                  {isCurrent ? (
                    <button className="btn-plan current-btn" disabled>
                      ✓ Current Plan
                    </button>
                  ) : (
                    <button
                      className={`btn-plan ${plan.is_featured ? 'btn-plan-gold' : 'btn-plan-outline'}`}
                      onClick={() => subscribe(plan.slug)}
                      disabled={!!subscribing || (hasActive && billing.cancelAtPeriodEnd)}>
                      {busy ? 'Opening payment…'
                        : isUpgrade ? `Upgrade to ${plan.name}`
                        : `Get ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem',
          margin: '2.5rem 0', flexWrap: 'wrap' }}>
          {[
            { icon: '🔒', text: 'Secured by Razorpay' },
            { icon: '💳', text: 'UPI, Cards, Net Banking' },
            { icon: '↩', text: 'Cancel any time' },
            { icon: '🇮🇳', text: 'INR pricing + GST' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.78rem', color: 'var(--text3)' }}>
              <span>{b.icon}</span><span>{b.text}</span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="faq">
          <h3>Frequently Asked Questions</h3>
          {FAQS.map((f, i) => (
            <div key={i} className="faq-item">
              <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{f.q}</span>
                <span>{openFaq === i ? '−' : '+'}</span>
              </div>
              {openFaq === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.78rem',
          color: 'var(--text3)' }}>
          Questions? <a href="mailto:support@hriatrengna.in"
            style={{ color: 'var(--gold)', textDecoration: 'none' }}>
            support@hriatrengna.in
          </a>
        </div>
      </div>
    </>
  );
}
