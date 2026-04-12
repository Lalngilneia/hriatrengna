import { useEffect, useState } from 'react';
import { API, apiCall } from '../../lib/api';
import { clearToken, getToken, normalizeUserPayload } from '../../lib/auth';
import { isOneTimePlan, isWeddingPlan } from '../../lib/constants';
import Spinner from '../../components/shared/Spinner';

function formatDateValue(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(paise, fallback = 0) {
  const amount = paise ? paise / 100 : Number(fallback || 0);
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

function formatSubscriptionStatus(value) {
  if (!value) return 'Inactive';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sumQuota(subscriptions = []) {
  return subscriptions.reduce((sum, sub) => sum + (parseInt(sub.album_quota, 10) || 0), 0);
}

const softCardStyle = {
  border: '1px solid #ECE7E1',
  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.035)',
};

const neutralBadgeStyle = {
  background: '#F7F5F2',
  color: '#5F5A54',
  border: '1px solid #E7E1DA',
};

const warmBadgeStyle = {
  background: '#F5F0E8',
  color: '#6E6151',
  border: '1px solid #E7DCCD',
};

const warningBadgeStyle = {
  background: '#F6EFE3',
  color: '#8A6A3F',
  border: '1px solid #E8D8BC',
};

function PhoneEditField({ user, setUser, token, showToast }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhone(user?.phone || '');
  }, [user?.phone]);

  const savePhone = async () => {
    setSaving(true);
    try {
      const result = await apiCall('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ phone }),
      }, token);
      setUser((prev) => ({ ...prev, phone: result.user?.phone || phone }));
      showToast?.('Phone number updated.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div className="acc-field-label">Phone</div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          className="form-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
          style={{ flex: '1 1 220px' }}
        />
        <button
          type="button"
          className="subdash-btn ghost"
          onClick={savePhone}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function AccountPage({ user, setUser, setPage, showToast }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [activeTab, setActiveTab] = useState('subscription');
  const [albums, setAlbums] = useState([]);
  const token = getToken();

  const loadAccountData = async () => {
    const [paymentStatus, invoicesRes, albumsRes] = await Promise.all([
      apiCall('/api/payments/status', {}, token),
      apiCall('/api/payments/invoices', {}, token),
      apiCall('/api/albums', {}, token),
    ]);
    setStatus({ ...paymentStatus, invoices: invoicesRes.invoices || [] });
    setAlbums(albumsRes.albums || []);
    setUser((prev) => normalizeUserPayload({ ...prev, ...paymentStatus }));
  };

  useEffect(() => {
    loadAccountData()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const cancelSub = async ({ subscriptionId = null, planType = null, planLabel = 'subscription' }) => {
    if (!confirm(`Cancel ${planLabel}? Your albums stay active until the billing period ends.`)) return;
    setCancellingId(subscriptionId || planType || 'all');
    try {
      await apiCall('/api/payments/cancel', {
        method: 'POST',
        body: JSON.stringify(subscriptionId ? { subscriptionId } : { planType }),
      }, token);
      await loadAccountData();
      showToast?.(`${planLabel} cancelled. Active until period end.`);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  const downloadPdf = async (id, num) => {
    try {
      const res = await fetch(`${API}/api/payments/invoices/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${num}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const planMap = {
    'memorial-basic': { name: 'Memorial Basic', color: '#F6F3EE', accent: '#6E6258', price: 'Rs 499/mo', maxAlbums: 1 },
    'memorial-standard': { name: 'Memorial Standard', color: '#F3F4F0', accent: '#5E675D', price: 'Rs 3,499/yr', maxAlbums: 1 },
    'memorial-premium': { name: 'Memorial Premium', color: '#F7F1E9', accent: '#7A6650', price: 'Rs 14,999 one-time', maxAlbums: 3 },
    'wedding-basic': { name: 'Wedding Basic', color: '#F6F2F4', accent: '#6B5D67', price: 'Rs 999/6mo', maxAlbums: 1 },
    'wedding-classic': { name: 'Wedding Classic', color: '#F5F1F3', accent: '#695B65', price: 'Rs 4,599/yr', maxAlbums: 3 },
    'wedding-premium': { name: 'Wedding Premium', color: '#F8F2EA', accent: '#766250', price: 'Rs 24,999 one-time', maxAlbums: 10 },
    monthly: { name: 'Monthly', color: '#F3F5F6', accent: '#5F6A70', price: 'Rs 749/mo', maxAlbums: 1 },
    yearly: { name: 'Yearly', color: '#F3F4F0', accent: '#5E675D', price: 'Rs 6,999/yr', maxAlbums: 1 },
    lifetime: { name: 'Lifetime', color: '#F7F1E9', accent: '#7A6650', price: 'Rs 14,999', maxAlbums: 3 },
  };

  const currentPlan = planMap[user?.subscriptionPlan] || {
    name: user?.subscriptionPlan || 'No plan',
    color: '#E5E7EB',
    accent: '#475569',
    price: '-',
    maxAlbums: 1,
  };
  const isOneTime = isOneTimePlan(user?.subscriptionPlan);
  const tabs = [
    { id: 'subscription', label: 'Plans' },
    { id: 'invoices', label: 'Receipts' },
    { id: 'profile', label: 'Profile' },
  ];
  const totalAlbums = albums.length;
  const weddingAlbums = albums.filter((album) => album.type === 'wedding').length;
  const memorialAlbums = albums.filter((album) => album.type !== 'wedding').length;
  const activeSubscriptions = (status?.subscriptions || []).filter((sub) => sub.status === 'active');
  const memorialSubscriptions = activeSubscriptions.filter((sub) => sub.plan_type === 'memorial');
  const weddingSubscriptions = activeSubscriptions.filter((sub) => sub.plan_type === 'wedding');
  const memorialQuotaTotal = sumQuota(memorialSubscriptions);
  const weddingQuotaTotal = sumQuota(weddingSubscriptions);

  const renderSubscriptionGroup = ({
    title,
    description,
    subscriptions,
    albumType,
    usedAlbums,
    quotaTotal,
    accent,
    tint,
  }) => {
    const slotsLeft = Math.max(0, quotaTotal - usedAlbums);
    const scheduledToCancel = subscriptions.filter((sub) => sub.cancel_at_period_end);
    const recurringCount = subscriptions.filter((sub) => !isOneTimePlan(sub.plan_slug)).length;
    const oneTimeCount = subscriptions.length - recurringCount;
    return (
      <section className="subpage" style={{ gap: '1.15rem' }}>
        <div className="subpage-card pad" style={{ ...softCardStyle, background: `linear-gradient(135deg, ${tint}, #FFFFFF)`, padding: '1.35rem' }}>
          <div className="subpage-section-title">{title}</div>
          <p className="subpage-section-sub">{description}</p>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {recurringCount > 0 && <span className="subdash-check todo" style={neutralBadgeStyle}>{recurringCount} Recurring</span>}
            {oneTimeCount > 0 && <span className="subdash-check done" style={warmBadgeStyle}>{oneTimeCount} One-time</span>}
            {scheduledToCancel.length > 0 && (
              <span className="subdash-check" style={warningBadgeStyle}>
                {scheduledToCancel.length} ending soon
              </span>
            )}
          </div>
          <div className="subpage-grid">
            <div>
              <div className="subpage-stat-label">Active plans</div>
              <div className="subpage-stat-value" style={{ fontSize: '1.25rem' }}>{subscriptions.length}</div>
              <div className="subpage-stat-sub">Separate billing lines</div>
            </div>
            <div>
              <div className="subpage-stat-label">Album space</div>
              <div className="subpage-stat-value" style={{ fontSize: '1.25rem' }}>{quotaTotal}</div>
              <div className="subpage-stat-sub">Total {albumType} album room</div>
            </div>
            <div>
              <div className="subpage-stat-label">In use</div>
              <div className="subpage-stat-value" style={{ fontSize: '1.25rem' }}>{usedAlbums}</div>
              <div className="subpage-stat-sub">Albums already created</div>
            </div>
            <div>
              <div className="subpage-stat-label">Available</div>
              <div className="subpage-stat-value" style={{ fontSize: '1.25rem', color: accent }}>{slotsLeft}</div>
              <div className="subpage-stat-sub">Ready for new albums</div>
            </div>
          </div>
          {scheduledToCancel.length > 0 && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>
              {scheduledToCancel.length === 1
                ? `One ${title.toLowerCase()} plan will end at the close of its billing period.`
                : `${scheduledToCancel.length} ${title.toLowerCase()} plans will end at the close of their billing periods.`}
            </div>
          )}
        </div>
        {subscriptions.map((sub) => renderSubscriptionCard(sub, albumType))}
      </section>
    );
  };

  const renderSubscriptionCard = (sub, albumType) => {
    const plan = planMap[sub.plan_slug] || {
      name: sub.plan_slug || 'Plan',
      color: albumType === 'wedding' ? '#F6F2F4' : '#F6F3EE',
      accent: albumType === 'wedding' ? '#6B5D67' : '#6E6258',
      price: '-',
    };
    const isOneTimeSub = isOneTimePlan(sub.plan_slug);
    const usedAlbums = albumType === 'wedding' ? weddingAlbums : memorialAlbums;
    return (
      <div key={sub.id} className="subpage-card pad" style={{ ...softCardStyle, background: `linear-gradient(135deg, ${plan.color}, #FFFFFF)`, padding: '1.3rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div className="subpage-section-title">{plan.name}</div>
            <p className="subpage-section-sub">
              Supports {albumType === 'wedding' ? 'wedding' : 'memorial'} albums in this account.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span className={`subdash-check ${isOneTimeSub ? 'done' : 'todo'}`} style={isOneTimeSub ? warmBadgeStyle : neutralBadgeStyle}>
              {isOneTimeSub ? 'One-time' : 'Recurring'}
            </span>
            {sub.cancel_at_period_end && (
              <span className="subdash-check" style={warningBadgeStyle}>
                Ending
              </span>
            )}
          </div>
        </div>
        <div className="subpage-grid">
          <div>
            <div className="subpage-stat-label">Reference</div>
            <div className="subpage-stat-sub" style={{ color: '#0F172A', fontFamily: 'monospace' }}>
              {sub.id?.slice(0, 8)}...
            </div>
          </div>
          <div>
            <div className="subpage-stat-label">Included</div>
            <div className="subpage-stat-sub" style={{ color: '#0F172A' }}>{sub.album_quota || 1}</div>
          </div>
          <div>
            <div className="subpage-stat-label">{isOneTimeSub ? 'Access' : 'Renews'}</div>
            <div className="subpage-stat-sub" style={{ color: '#0F172A' }}>
              {isOneTimeSub ? 'Lifetime / one-time' : formatDateValue(sub.current_period_end)}
            </div>
          </div>
          <div>
            <div className="subpage-stat-label">State</div>
            <div className="subpage-stat-sub" style={{ color: plan.accent }}>
              {sub.cancel_at_period_end ? 'Ends at period close' : 'Active'}
            </div>
          </div>
        </div>
        <div className="subpage-actions" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
          {!isOneTimeSub && !sub.cancel_at_period_end && (
            <button
              type="button"
              className="subdash-btn danger"
              onClick={() => cancelSub({
                subscriptionId: sub.id,
                planLabel: `${plan.name} subscription`,
              })}
              disabled={cancellingId === sub.id}
            >
              {cancellingId === sub.id ? 'Cancelling...' : 'Cancel Plan'}
            </button>
          )}
          {sub.cancel_at_period_end && (
            <span className="subdash-check todo" style={neutralBadgeStyle}>
              Active until {formatDateValue(sub.current_period_end)}
            </span>
          )}
          <span className="subpage-stat-sub" style={{ color: '#475569' }}>
            {usedAlbums} {albumType} album{usedAlbums === 1 ? '' : 's'} in this workspace
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <Spinner dark />
      </div>
    );
  }

  return (
    <div className="subpage" style={{ gap: '1.25rem' }}>
      <div className="subpage-header" style={{ ...softCardStyle, padding: '1.35rem 1.4rem', background: 'linear-gradient(180deg, #FFFFFF 0%, #FCFBF9 100%)' }}>
        <div className="subpage-header-copy">
          <div className="subpage-eyebrow">Account</div>
          <h1 className="subpage-title" style={{ margin: 0 }}>Billing</h1>
          <p className="subpage-sub">
            Plans, receipts, and profile details in one calm place.
          </p>
        </div>
        <div className="subpage-actions">
          <button type="button" className="subdash-btn ghost" onClick={() => setPage('dashboard')}>
            Dashboard
          </button>
          <button type="button" className="subdash-btn primary" onClick={() => setPage('payment')}>
            Explore Plans
          </button>
        </div>
      </div>

      <div className="subpage-grid" style={{ gap: '1.1rem' }}>
        <div className="subpage-card pad" style={softCardStyle}>
          <div className="subpage-stat-label">Plan</div>
          <div className="subpage-stat-value">{currentPlan.name}</div>
          <div className="subpage-stat-sub">{currentPlan.price}</div>
        </div>
        <div className="subpage-card pad" style={softCardStyle}>
          <div className="subpage-stat-label">Status</div>
          <div className="subpage-stat-value" style={{ fontSize: '1.2rem' }}>
            {formatSubscriptionStatus(status?.subscriptionStatus || user?.subscriptionStatus || 'inactive')}
          </div>
          <div className="subpage-stat-sub">
            {status?.cancel_at_period_end ? `Ends on ${formatDateValue(status.currentPeriodEnd)}` : 'In good standing'}
          </div>
        </div>
        <div className="subpage-card pad" style={softCardStyle}>
          <div className="subpage-stat-label">Albums</div>
          <div className="subpage-stat-value">{totalAlbums}</div>
          <div className="subpage-stat-sub">{memorialAlbums} memorial / {weddingAlbums} wedding</div>
        </div>
        <div className="subpage-card pad" style={softCardStyle}>
          <div className="subpage-stat-label">{isOneTime ? 'Access' : 'Renews'}</div>
          <div className="subpage-stat-value" style={{ fontSize: '1.2rem' }}>
            {isOneTime ? 'Lifetime' : formatDateValue(status?.currentPeriodEnd)}
          </div>
          <div className="subpage-stat-sub">{isOneTime ? 'One-time access' : 'Next billing date'}</div>
        </div>
      </div>

      <div className="subsettings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`subsettings-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'subscription' && (
        <div className="subpage" style={{ gap: '1.15rem' }}>
          <div className="subpage-card pad" style={{ ...softCardStyle, background: `linear-gradient(135deg, ${currentPlan.color}, #FFFFFF)`, padding: '1.35rem' }}>
            <div className="subpage-section-title">At a glance</div>
            <p className="subpage-section-sub">
              You are currently on <strong>{currentPlan.name}</strong> with space for{' '}
              <strong>{user?.albumQuota || currentPlan.maxAlbums || 1}</strong> album
              {(user?.albumQuota || currentPlan.maxAlbums || 1) === 1 ? '' : 's'}
              {isOneTime ? ', with room to grow over time.' : '.'}
            </p>
            <div className="subpage-grid">
              <div>
                <div className="subpage-stat-label">Since</div>
                <div className="subpage-stat-sub" style={{ color: '#0F172A' }}>{formatDateValue(status?.subscriptionCreatedAt || user?.createdAt)}</div>
              </div>
              <div>
                <div className="subpage-stat-label">{isOneTime ? 'Access' : 'Renews'}</div>
                <div className="subpage-stat-sub" style={{ color: '#0F172A' }}>
                  {isOneTime ? '10-year access' : formatDateValue(status?.currentPeriodEnd)}
                </div>
              </div>
              <div>
                <div className="subpage-stat-label">Collection</div>
                <div className="subpage-stat-sub" style={{ color: '#0F172A' }}>
                  {[
                    memorialSubscriptions.length ? 'Memorial' : null,
                    weddingSubscriptions.length ? 'Wedding' : null,
                  ].filter(Boolean).join(' + ') || (isWeddingPlan(user?.subscriptionPlan) ? 'Wedding' : 'Memorial')}
                </div>
              </div>
              <div>
                <div className="subpage-stat-label">Billing</div>
                <div className="subpage-stat-sub" style={{ color: currentPlan.accent, fontWeight: 700 }}>
                  {isOneTime ? 'One-time access' : 'Recurring plan'}
                </div>
              </div>
            </div>
            <div className="subpage-actions" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
              <button type="button" className="subdash-btn primary" onClick={() => setPage('payment')}>
                {isOneTime ? 'Add Album Space' : 'Change Plan'}
              </button>
            </div>
          </div>

          {memorialSubscriptions.length > 0 && (
            renderSubscriptionGroup({
              title: 'Memorial',
              description: 'All memorial plans, quota, and renewal details in one place.',
              subscriptions: memorialSubscriptions,
              albumType: 'memorial',
              usedAlbums: memorialAlbums,
              quotaTotal: memorialQuotaTotal,
              accent: '#6E6258',
              tint: '#FAF7F3',
            })
          )}

          {weddingSubscriptions.length > 0 && (
            renderSubscriptionGroup({
              title: 'Wedding',
              description: 'All wedding plans, quota, and renewal details in one place.',
              subscriptions: weddingSubscriptions,
              albumType: 'wedding',
              usedAlbums: weddingAlbums,
              quotaTotal: weddingQuotaTotal,
              accent: '#6B5D67',
              tint: '#FAF7F8',
            })
          )}

          <div className="subpage-grid">
            <div className="subpage-card pad" style={softCardStyle}>
              <div className="subpage-section-title">Need more room?</div>
              <p className="subpage-section-sub">
                Add another plan when you want more space without moving to a new account.
              </p>
              <div className="subpage-list">
                <div className="subpage-row">
                  <span>Memorial albums</span>
                  <strong>{memorialAlbums}</strong>
                </div>
                <div className="subpage-row">
                  <span>Wedding albums</span>
                  <strong>{weddingAlbums}</strong>
                </div>
                <div className="subpage-row">
                  <span>Receipts</span>
                  <strong>{status?.invoices?.length || 0}</strong>
                </div>
              </div>
              <div className="subpage-actions" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
                <button type="button" className="subdash-btn ghost" onClick={() => setPage('payment')}>
                  See Plans
                </button>
              </div>
            </div>

            <div className="subpage-card pad" style={softCardStyle}>
              <div className="subpage-section-title">How space works</div>
              <p className="subpage-section-sub">
                Memorial and wedding plans keep their album space separate inside the same account.
              </p>
              <div className="subpage-list">
                <div className="subpage-row">
                  <span>Basic / Standard</span>
                  <strong>Focused single-album setup</strong>
                </div>
                <div className="subpage-row">
                  <span>Premium / Lifetime</span>
                  <strong>Expandable multi-album room</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="subpage-card pad" style={softCardStyle}>
          <div className="subpage-section-title">Receipts</div>
          <p className="subpage-section-sub">
            Download paid invoices whenever you need them.
          </p>
          {!status?.invoices?.length ? (
            <div className="subpage-empty">
              <div className="subpage-empty-title">No receipts yet</div>
              <div className="subpage-section-sub" style={{ marginBottom: 0 }}>
                Your first successful payment will appear here.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="sub-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {status.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td style={{ fontFamily: 'monospace', color: '#0F172A', fontWeight: 700 }}>
                        {invoice.invoice_number}
                      </td>
                      <td>{formatDateValue(invoice.created_at)}</td>
                      <td>{invoice.plan || '-'}</td>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>
                        {formatMoney(invoice.amount_paise, invoice.amount_inr)}
                      </td>
                      <td>
                        <span className="subdash-check done" style={warmBadgeStyle}>Paid</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="subdash-btn ghost"
                          style={{ padding: '0.45rem 0.75rem' }}
                          onClick={() => downloadPdf(invoice.id, invoice.invoice_number)}
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="subpage-grid">
          <div className="subpage-card pad" style={softCardStyle}>
            <div className="subpage-section-title">Profile</div>
            <p className="subpage-section-sub">
              Keep your contact details current for sign-in and billing updates.
            </p>
            <PhoneEditField user={user} setUser={setUser} showToast={showToast} token={token} />
            {[
              { label: 'Full Name', value: user?.name || '-' },
              { label: 'Email', value: user?.email || '-' },
              { label: 'Member Since', value: formatDateValue(user?.createdAt) },
              {
                label: 'Email Verified',
                value: (user?.isEmailVerified || user?.is_email_verified) ? 'Verified' : 'Check inbox',
              },
            ].map((item) => (
              <div key={item.label} className="acc-field">
                <div className="acc-field-label">{item.label}</div>
                <div className="acc-field-val">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="subpage-card pad" style={softCardStyle}>
            <div className="subpage-section-title">Password & Access</div>
            <p className="subpage-section-sub">
              Password resets stay in the sign-in flow to keep this page simple.
            </p>
            <div className="subpage-list">
              <div className="subpage-row">
                <span>Sign-in email</span>
                <strong>{user?.email || '-'}</strong>
              </div>
              <div className="subpage-row">
                <span>Account state</span>
                <strong>{formatSubscriptionStatus(user?.subscriptionStatus || 'active')}</strong>
              </div>
            </div>
            <div className="subpage-actions" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="subdash-btn ghost"
                onClick={() => {
                  clearToken();
                  setUser(null);
                  setPage('forgot-password');
                }}
              >
                Open Password Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
