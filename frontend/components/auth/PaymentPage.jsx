/**
 * PaymentPage.jsx
 *
 * Replaces the old fixed-tier pricing page with a fully custom configurator.
 * Handles:
 *   - Memorial / Wedding tab selection
 *   - Subscription length picker (7 options)
 *   - Photo pack + video pack steppers
 *   - Audio and themes toggles
 *   - Monthly vs Upfront payment mode
 *   - Live price summary (client-side calc, confirmed server-side at checkout)
 *   - Physical QR / NFC order modal
 *   - Referral code validation
 *
 * API endpoints used:
 *   GET  /api/payments/pricing-options?type=memorial  → base + addon prices
 *   POST /api/payments/calculate                       → server-side preview
 *   POST /api/payments/create-subscription             → monthly order-based checkout
 *   POST /api/payments/create-order                   → upfront order-based checkout
 *   POST /api/payments/verify                          → server-side signature verify
 *   POST /api/payments/physical-order                  → create physical order
 *   POST /api/payments/verify-physical                → confirm physical payment
 */

import { useEffect, useState, useCallback } from 'react';
import { apiCall } from '../../lib/api';
import { getToken, normalizeUserPayload } from '../../lib/auth';
import {
  SUBSCRIPTION_LENGTHS,
  UPFRONT_DISCOUNT_PCT,
  BASE_PHOTOS, BASE_VIDEOS, PHOTOS_PER_PACK, VIDEOS_PER_PACK,
  DEFAULT_ADDON_PRICES_INR,
  calculateConfigPrice,
  fmtPaise,
} from '../../lib/constants';
import { captureReferralFromLocation, persistReferralCode, getReferralCode } from '../../lib/referral';

// ── Indian states for shipping address ───────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// ── Stepper component ─────────────────────────────────────────
function Stepper({ value, onDecrement, onIncrement, min = 0, max = 99, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <button
        onClick={onDecrement}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
        style={stepperBtn(value <= min)}
      >−</button>
      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, color: '#E8EAF0', fontSize: '1rem' }}>
        {value}
      </span>
      <button
        onClick={onIncrement}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
        style={stepperBtn(value >= max)}
      >+</button>
    </div>
  );
}

// ── Physical Order Modal ──────────────────────────────────────
function PhysicalOrderModal({ orderType, user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: user?.name || '', phone: '', address1: '', address2: '',
    city: '', state: '', pincode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePay = async () => {
    setError(''); setLoading(true);
    const token = getToken();
    try {
      if (!window.Razorpay) throw new Error('Razorpay not loaded. Please refresh.');

      const data = await apiCall('/api/payments/physical-order', {
        method: 'POST',
        body: JSON.stringify({
          orderType,
          shippingAddress: {
            name:     form.name.trim(),
            phone:    form.phone.trim(),
            address1: form.address1.trim(),
            address2: form.address2.trim() || undefined,
            city:     form.city.trim(),
            state:    form.state,
            pincode:  form.pincode.trim(),
          },
        }),
      }, token);

      const rzp = new window.Razorpay({
        key:      data.razorpayKeyId,
        order_id: data.orderId,
        amount:   data.amount,
        currency: 'INR',
        name:     'Hriatrengna',
        description: orderType === 'nfc_tag' ? 'Physical NFC Tag' : 'Physical QR Code Print',
        prefill: { name: data.customer.name, email: data.customer.email, contact: data.customer.contact },
        theme: { color: '#C9A84C' },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (response) => {
          try {
            await apiCall('/api/payments/verify-physical', {
              method: 'POST',
              body: JSON.stringify(response),
            }, token);
            onSuccess?.();
          } catch {
            setError('Payment received but confirmation failed. Contact support with Payment ID: ' + response.razorpay_payment_id);
            setLoading(false);
          }
        },
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
        <h2 style={modalTitle}>
          {orderType === 'nfc_tag' ? '🔖 Physical NFC Tag' : '🖨️ Physical QR Print'} — ₹299
        </h2>
        <p style={{ color: 'rgba(232,234,240,0.5)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Includes printing & shipping across India · 5–7 business days
        </p>

        {[
          ['name',     'Full Name *',         'text',  false],
          ['phone',    'Phone Number *',       'tel',   false],
          ['address1', 'Address Line 1 *',    'text',  false],
          ['address2', 'Address Line 2',      'text',  false],
          ['city',     'City *',              'text',  false],
          ['pincode',  'Pincode *',           'text',  false],
        ].map(([key, label, type]) => (
          <div key={key} style={{ marginBottom: '0.65rem' }}>
            <label style={fieldLabel}>{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={set(key)}
              placeholder={label.replace(' *', '')}
              style={fieldInput}
            />
          </div>
        ))}

        <div style={{ marginBottom: '1rem' }}>
          <label style={fieldLabel}>State *</label>
          <select value={form.state} onChange={set('state')} style={fieldInput}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {error && <div style={errBox}>{error}</div>}

        <button
          onClick={handlePay}
          disabled={loading || !form.name || !form.phone || !form.address1 || !form.city || !form.state || !form.pincode}
          style={payBtn(loading)}
        >
          {loading ? 'Opening Payment…' : 'Pay ₹299 →'}
        </button>
      </div>
    </div>
  );
}

// ── Main PaymentPage ──────────────────────────────────────────
export default function PaymentPage({ user, setUser, setPage }) {
  // Default to the plan type the user doesn't already have.
  // A user coming from "Add Subscription" with an existing memorial plan should
  // land on the wedding tab, not be prompted to buy memorial again.
  const [tab,        setTab]        = useState(() => {
    if (user?.hasMemorial && !user?.hasWedding) return 'wedding';
    return 'memorial';
  });
  const [lengths,    setLengths]    = useState(SUBSCRIPTION_LENGTHS);
  const [addonPricesInr, setAddonPricesInr] = useState(DEFAULT_ADDON_PRICES_INR);
  const [loadingPrices, setLoadingPrices]   = useState(true);

  // Configurator state
  const [lengthIdx,       setLengthIdx]       = useState(0);  // index into lengths
  const [extraPhotoPacks, setExtraPhotoPacks] = useState(0);
  const [extraVideoPacks, setExtraVideoPacks] = useState(0);
  const [audioEnabled,    setAudioEnabled]    = useState(false);
  const [themesEnabled,   setThemesEnabled]   = useState(false);
  const [paymentMode,     setPaymentMode]     = useState('monthly'); // 'monthly' | 'upfront'

  // UI state
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [physicalModal, setPhysicalModal] = useState(null); // null | 'qr_print' | 'nfc_tag'
  const [physicalDone,  setPhysicalDone]  = useState('');

  // Referral
  const [referralCode,  setReferralCode]  = useState(() =>
    typeof window !== 'undefined' ? getReferralCode(new URLSearchParams(window.location.search).get('ref')) : ''
  );
  const [referralValid, setReferralValid] = useState(null);
  const [checkingRef,   setCheckingRef]   = useState(false);

  // ── Fetch live prices from API ──────────────────────────────
  useEffect(() => {
    captureReferralFromLocation();
    const fetchPrices = async () => {
      try {
        const data = await apiCall(`/api/payments/pricing-options?type=${tab}`);
        if (data.basePricing?.length) {
          // Merge API base pricing into our lengths array
          setLengths(SUBSCRIPTION_LENGTHS.map((l) => {
            const api = data.basePricing.find((r) => r.lengthMonths === l.months);
            if (!api) return l;
            return {
              ...l,
              memorialMonthlyInr: tab === 'memorial' ? api.monthlyRateInr : l.memorialMonthlyInr,
              weddingMonthlyInr:  tab === 'wedding'  ? api.monthlyRateInr : l.weddingMonthlyInr,
            };
          }));
        }
        if (data.addons?.length) {
          const map = {};
          data.addons.forEach((a) => { map[a.key] = a.priceInr; });
          setAddonPricesInr((prev) => ({ ...prev, ...map }));
        }
      } catch { /* use defaults */ }
      finally { setLoadingPrices(false); }
    };
    fetchPrices();
  }, [tab]);

  // ── Derived config ──────────────────────────────────────────
  const selectedLength = lengths[lengthIdx] || lengths[0];
  const baseMonthlyInr = tab === 'wedding'
    ? selectedLength.weddingMonthlyInr
    : selectedLength.memorialMonthlyInr;

  const config = {
    planType: tab, lengthMonths: selectedLength.months,
    extraPhotoPacks, extraVideoPacks, audioEnabled, themesEnabled, paymentMode,
  };

  const pricing = calculateConfigPrice(config, addonPricesInr, baseMonthlyInr);

  // ── Refresh user session after payment ──────────────────────
  // Polls /api/payments/status up to 4 times (2s apart) until the subscription is
  // active. This handles the window between Razorpay's handler callback firing and
  // the webhook activating the subscription — or the verify-endpoint failsafe
  // activating it directly.
  const refreshUser = async (tok) => {
    const MAX_POLLS = 4;
    const POLL_INTERVAL_MS = 2000;
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      try {
        const fresh = await apiCall('/api/payments/status', {}, tok);
        const normalized = normalizeUserPayload({ ...fresh });
        const isActive = normalized.hasMemorial || normalized.hasWedding
          || ['active', 'trialing', 'lifetime'].includes(normalized.subscriptionStatus);
        setUser((prev) => normalizeUserPayload({ ...prev, ...fresh }));
        if (isActive) return; // subscription is live — stop polling
        if (attempt < MAX_POLLS - 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (_) {
        if (attempt < MAX_POLLS - 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
    }
  };

  // ── Referral check ──────────────────────────────────────────
  const checkReferral = async (code) => {
    if (!code.trim()) { setReferralValid(null); return; }
    setCheckingRef(true);
    try {
      const d = await apiCall(`/api/affiliates/validate/${code.trim().toUpperCase()}`);
      setReferralValid(d.valid !== false);
    } catch { setReferralValid(false); }
    finally { setCheckingRef(false); }
  };

  // ── Checkout ────────────────────────────────────────────────
  const pay = async () => {
    setError(''); setLoading(true);
    const token = getToken();
    const normalizedRef = referralCode.trim().toUpperCase();
    if (normalizedRef) persistReferralCode(normalizedRef, { overwrite: true });

    try {
      if (!window.Razorpay) throw new Error('Razorpay not loaded. Please refresh.');

      const endpoint  = paymentMode === 'upfront' ? '/api/payments/create-order' : '/api/payments/create-subscription';
      const data = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          planType: tab,
          lengthMonths: selectedLength.months,
          extraPhotoPacks, extraVideoPacks,
          audioEnabled, themesEnabled,
          paymentMode,
          referralCode: normalizedRef || undefined,
        }),
      }, token);

      const rzpOptions = {
        key:      data.razorpayKeyId,
        amount:   data.amount,
        currency: 'INR',
        name:     'Hriatrengna',
        description: `${tab === 'wedding' ? 'Wedding' : 'Memorial'} Custom Plan — ${selectedLength.label}`,
        prefill: { name: data.customer.name, email: data.customer.email, contact: data.customer.contact },
        theme: { color: '#C9A84C' },
        modal: { ondismiss: () => { setLoading(false); setError('Payment was cancelled.'); } },
        handler: async (response) => {
          try {
            const verifyResult = await apiCall('/api/payments/verify', {
              method: 'POST',
              body: JSON.stringify({
                ...response,
                // Echo config back for server-side re-resolution
                planType: tab,
                lengthMonths: selectedLength.months,
                extraPhotoPacks, extraVideoPacks,
                audioEnabled, themesEnabled,
                paymentMode,
              }),
            }, token);
            // If the server already activated via the failsafe path, skip the poll.
            // Otherwise poll until the async webhook activates the subscription.
            if (verifyResult?.status !== 'active') {
              await refreshUser(token);
            } else {
              // Still update user state but no need to retry
              try {
                const fresh = await apiCall('/api/payments/status', {}, token);
                setUser((prev) => normalizeUserPayload({ ...prev, ...fresh }));
              } catch (_) {}
            }
            setPage('dashboard');
          } catch {
            setError('Payment received but activation failed — contact support. Payment ID: ' + (response.razorpay_payment_id || ''));
            setLoading(false);
          }
        },
      };

      rzpOptions.order_id = data.orderId;

      const rzp = new window.Razorpay(rzpOptions);
      rzp.open();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // ── Total photos / videos ───────────────────────────────────
  const totalPhotos = BASE_PHOTOS + extraPhotoPacks * PHOTOS_PER_PACK;
  const totalVideos = BASE_VIDEOS + extraVideoPacks * VIDEOS_PER_PACK;

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>

      {physicalModal && (
        <PhysicalOrderModal
          orderType={physicalModal}
          user={user}
          onClose={() => setPhysicalModal(null)}
          onSuccess={() => {
            setPhysicalModal(null);
            setPhysicalDone(physicalModal === 'nfc_tag' ? 'NFC tag' : 'QR print');
          }}
        />
      )}

      <div className="pay-page">

        {/* Header */}
        <div className="pay-head">
          <div className="pay-logo">✦</div>
          <h1 className="pay-title">Build Your Plan</h1>
          <p className="pay-sub">Pay securely via UPI, Cards, or Netbanking · Powered by Razorpay</p>
        </div>

        {/* Existing subscription context */}
        {user && (user.hasMemorial || user.hasWedding) && (
          <div style={{
            background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 12,
            padding: '0.85rem 1.1rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: '#E8EAF0',
            lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: '#C9A84C' }}>
              Active Subscriptions
            </div>
            {user.hasMemorial && (
              <div>🕯️ Memorial — active{user.memorialSub?.subscription_count > 1 ? ` (${user.memorialSub.subscription_count} slots)` : ''}</div>
            )}
            {user.hasWedding && (
              <div>💍 Wedding — active{user.weddingSub?.subscription_count > 1 ? ` (${user.weddingSub.subscription_count} slots)` : ''}</div>
            )}
            <div style={{ marginTop: '0.4rem', color: 'rgba(232,234,240,0.55)', fontSize: '0.78rem' }}>
              Each new subscription adds album slots. Selecting the same type below adds more capacity.
            </div>
          </div>
        )}

        {/* Memorial / Wedding tabs */}
        <div className="pay-tabs" role="tablist">
          {[['memorial', '🕯️ Memorial'], ['wedding', '💍 Wedding']].map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`pay-tab${tab === t ? ' active' : ''}`}
              onClick={() => { setTab(t); setLengthIdx(0); setExtraPhotoPacks(0); setExtraVideoPacks(0); setAudioEnabled(false); setThemesEnabled(false); setError(''); }}
            >{label}</button>
          ))}
        </div>

        <div className="pay-configurator">

          {/* ── Length picker ─────────────────────────── */}
          <section className="pay-section">
            <div className="pay-section-title">Subscription Length</div>
            <div className="length-grid">
              {lengths.map((l, i) => {
                const isSelected = i === lengthIdx;
                const monthlyInr = tab === 'wedding' ? l.weddingMonthlyInr : l.memorialMonthlyInr;
                return (
                  <button
                    key={l.months}
                    onClick={() => setLengthIdx(i)}
                    className={`length-btn${isSelected ? ' selected' : ''}`}
                  >
                    <span className="length-label">{l.label}</span>
                    {l.discountPct > 0 && (
                      <span className="length-discount">−{l.discountPct}%</span>
                    )}
                    <span className="length-rate">₹{monthlyInr}/mo</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Add-ons ───────────────────────────────── */}
          <section className="pay-section">
            <div className="pay-section-title">Media Add-ons</div>

            <div className="addon-row">
              <div className="addon-info">
                <span className="addon-name">📸 Extra Photos</span>
                <span className="addon-desc">+{PHOTOS_PER_PACK} photos per pack · ₹{addonPricesInr.photo_pack}/pack/mo</span>
              </div>
              <Stepper
                value={extraPhotoPacks}
                onDecrement={() => setExtraPhotoPacks((n) => Math.max(0, n - 1))}
                onIncrement={() => setExtraPhotoPacks((n) => Math.min(490, n + 1))}
                label="photo packs"
              />
            </div>

            <div className="addon-row">
              <div className="addon-info">
                <span className="addon-name">🎥 Extra Videos</span>
                <span className="addon-desc">+{VIDEOS_PER_PACK} videos per pack · ₹{addonPricesInr.video_pack}/pack/mo</span>
              </div>
              <Stepper
                value={extraVideoPacks}
                onDecrement={() => setExtraVideoPacks((n) => Math.max(0, n - 1))}
                onIncrement={() => setExtraVideoPacks((n) => Math.min(99, n + 1))}
                label="video packs"
              />
            </div>

            <div className="addon-row toggle-row">
              <div className="addon-info">
                <span className="addon-name">🎵 Audio Uploads</span>
                <span className="addon-desc">Background music & audio tributes · ₹{addonPricesInr.audio_toggle}/mo</span>
              </div>
              <button
                onClick={() => setAudioEnabled((v) => !v)}
                className={`toggle-btn${audioEnabled ? ' on' : ''}`}
                aria-pressed={audioEnabled}
                aria-label="Toggle audio uploads"
              >
                <span className="toggle-knob" />
              </button>
            </div>

            <div className="addon-row toggle-row">
              <div className="addon-info">
                <span className="addon-name">🎨 Extra Themes</span>
                <span className="addon-desc">Access all {tab === 'wedding' ? 6 : 5} album themes · ₹{addonPricesInr.themes_toggle}/mo</span>
              </div>
              <button
                onClick={() => setThemesEnabled((v) => !v)}
                className={`toggle-btn${themesEnabled ? ' on' : ''}`}
                aria-pressed={themesEnabled}
                aria-label="Toggle extra themes"
              >
                <span className="toggle-knob" />
              </button>
            </div>
          </section>

          {/* ── Payment mode ──────────────────────────── */}
          <section className="pay-section">
            <div className="pay-section-title">Payment Mode</div>
            <div className="mode-grid">
              <button
                className={`mode-btn${paymentMode === 'monthly' ? ' selected' : ''}`}
                onClick={() => setPaymentMode('monthly')}
              >
                <span className="mode-label">Monthly Billing</span>
                <span className="mode-desc">Charged every month · Cancel anytime</span>
                <span className="mode-price">₹{fmtPaise(pricing.totalMoPaise).replace('₹', '')}/mo</span>
              </button>
              <button
                className={`mode-btn${paymentMode === 'upfront' ? ' selected' : ''}`}
                onClick={() => setPaymentMode('upfront')}
              >
                <span className="mode-label">Pay Upfront</span>
                <span className="mode-desc">One payment for full period · Extra {UPFRONT_DISCOUNT_PCT}% off</span>
                <span className="mode-price">{fmtPaise(pricing.totalChargedPaise)} total</span>
                {pricing.upfrontDiscountPaise > 0 && (
                  <span className="mode-save">Save {fmtPaise(pricing.upfrontDiscountPaise)}</span>
                )}
              </button>
            </div>
          </section>

          {/* ── Price summary ─────────────────────────── */}
          <section className="pay-summary">
            <div className="summary-title">Order Summary</div>

            <div className="summary-row">
              <span>Base ({tab === 'wedding' ? 'Wedding' : 'Memorial'})</span>
              <span>₹{baseMonthlyInr}/mo</span>
            </div>
            {pricing.addonMoInr > 0 && (
              <div className="summary-row">
                <span>Add-ons</span>
                <span>+₹{pricing.addonMoInr}/mo</span>
              </div>
            )}
            {selectedLength.discountPct > 0 && (
              <div className="summary-row green">
                <span>{selectedLength.label} discount</span>
                <span>−{selectedLength.discountPct}%</span>
              </div>
            )}
            {paymentMode === 'upfront' && (
              <div className="summary-row green">
                <span>Upfront discount</span>
                <span>−{UPFRONT_DISCOUNT_PCT}%</span>
              </div>
            )}

            <div className="summary-divider" />

            <div className="summary-row limits">
              <span>📸 {totalPhotos} photos · 🎥 {totalVideos} videos{audioEnabled ? ' · 🎵 audio' : ''}{themesEnabled ? ' · 🎨 themes' : ''}</span>
            </div>
            <div className="summary-row limits">
              <span>🔍 Digital QR download · 📄 PDF Plaque — always free</span>
            </div>

            <div className="summary-divider" />

            <div className="summary-total">
              {paymentMode === 'monthly' ? (
                <>
                  <span>Monthly charge</span>
                  <span className="total-amount">{fmtPaise(pricing.totalMoPaise)}<span className="total-unit">/mo</span></span>
                </>
              ) : (
                <>
                  <span>Total for {selectedLength.label}</span>
                  <span className="total-amount">{fmtPaise(pricing.totalChargedPaise)}</span>
                </>
              )}
            </div>
          </section>

          {/* Error */}
          {error && <div className="pay-err" role="alert">{error}</div>}

          {/* Pay button */}
          <button className="pay-btn" onClick={pay} disabled={loading || loadingPrices}>
            {loading
              ? 'Opening Payment…'
              : paymentMode === 'monthly'
                ? `Subscribe ${fmtPaise(pricing.totalMoPaise)}/mo →`
                : `Pay ${fmtPaise(pricing.totalChargedPaise)} →`}
          </button>

          {/* Referral code */}
          <div className="referral-row">
            <input
              value={referralCode}
              onChange={(e) => {
                const c = e.target.value.toUpperCase();
                setReferralCode(c);
                if (c.trim()) persistReferralCode(c, { overwrite: true });
                setReferralValid(null);
              }}
              onBlur={(e) => checkReferral(e.target.value)}
              placeholder="Referral code (optional)"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${referralValid === true ? '#22c55e' : referralValid === false ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 10, padding: '0.6rem 1rem', color: '#E8EAF0',
                fontSize: '0.85rem', outline: 'none', letterSpacing: '0.05em', fontFamily: 'monospace',
              }}
            />
            {checkingRef && <span style={{ color: 'rgba(232,234,240,0.4)', fontSize: '0.78rem' }}>Checking…</span>}
            {referralValid === true  && <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.82rem' }}>✓ Valid</span>}
            {referralValid === false && <span style={{ color: '#ef4444', fontSize: '0.82rem' }}>✗ Invalid</span>}
          </div>
          {referralValid === true && (
            <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.3rem' }}>
              Referral applied — your referrer earns a commission.
            </div>
          )}

          <div className="pay-secure">🔒 Secured by Razorpay · UPI · Cards · Netbanking · ₹ INR</div>

          {/* ── Physical add-ons section ──────────────────────── */}
          <div className="physical-section">
            <div className="physical-title">Physical Products</div>
            <p className="physical-sub">Order a printed QR code or NFC tag for your album. Ships across India in 5–7 business days.</p>
            <div className="physical-grid">
              {[
                { type: 'qr_print', icon: '🖨️', label: 'Physical QR Print', desc: 'High-quality printed QR code ready to display or frame.' },
                { type: 'nfc_tag',  icon: '🔖', label: 'Physical NFC Tag',   desc: 'Tap-to-open NFC tag, ideal for plaques and frames.' },
              ].map(({ type, icon, label, desc }) => (
                <div key={type} className="physical-card">
                  <span className="physical-icon">{icon}</span>
                  <span className="physical-label">{label}</span>
                  <span className="physical-desc">{desc}</span>
                  <span className="physical-price">₹299 · incl. shipping</span>
                  <button
                    className="physical-btn"
                    onClick={() => setPhysicalModal(type)}
                    disabled={!user}
                    title={!user ? 'Subscribe first to order physical products' : undefined}
                  >
                    Order Now
                  </button>
                </div>
              ))}
            </div>
            {physicalDone && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.86rem', marginTop: '1rem' }}>
                ✓ Your {physicalDone} order is confirmed! We'll ship it within 5–7 business days.
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ── Style helpers ─────────────────────────────────────────────

const stepperBtn = (disabled) => ({
  width: 32, height: 32, borderRadius: '50%',
  border: `1.5px solid ${disabled ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.5)'}`,
  background: 'transparent',
  color: disabled ? 'rgba(201,168,76,0.3)' : '#C9A84C',
  fontSize: '1.1rem', cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
});

const payBtn = (disabled) => ({
  width: '100%', padding: '0.9rem',
  background: disabled ? 'rgba(201,168,76,0.3)' : 'linear-gradient(135deg,#C9A84C,#E8C97A)',
  color: '#111', border: 'none', borderRadius: 12,
  fontSize: '1rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: '0.75rem',
});

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: '1rem',
};
const modal = {
  background: '#17171f', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 480,
  position: 'relative', maxHeight: '90vh', overflowY: 'auto',
};
const closeBtn = {
  position: 'absolute', top: '1rem', right: '1rem',
  background: 'none', border: 'none', color: 'rgba(232,234,240,0.4)',
  fontSize: '1.1rem', cursor: 'pointer',
};
const modalTitle = { fontFamily: 'Manrope,sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#E8EAF0', marginBottom: '0.5rem' };
const fieldLabel = { display: 'block', fontSize: '0.78rem', color: 'rgba(232,234,240,0.5)', marginBottom: '0.3rem' };
const fieldInput = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '0.55rem 0.85rem', color: '#E8EAF0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };
const errBox = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.84rem', marginBottom: '0.75rem' };

// ── Embedded CSS ──────────────────────────────────────────────
const CSS = `
  .pay-page { min-height:100vh; background:#0f0f16; display:flex; flex-direction:column; align-items:center; padding:3rem 1rem 5rem; }
  .pay-head  { text-align:center; margin-bottom:2rem; }
  .pay-logo  { font-size:2rem; margin-bottom:0.75rem; }
  .pay-title { font-family:'Manrope',sans-serif; font-size:2rem; font-weight:700; color:#E8EAF0; margin-bottom:0.4rem; }
  .pay-sub   { color:rgba(232,234,240,0.5); font-size:0.9rem; }
  .pay-tabs  { display:flex; gap:0.4rem; background:rgba(255,255,255,0.05); border-radius:100px; padding:0.3rem; margin-bottom:2rem; }
  .pay-tab   { padding:0.55rem 1.75rem; border-radius:100px; border:none; font-size:0.9rem; font-weight:600; cursor:pointer; transition:all 0.2s; background:transparent; color:rgba(232,234,240,0.5); }
  .pay-tab.active { background:#C9A84C; color:#111; }
  .pay-tab:not(.active):hover { color:#E8EAF0; }

  .pay-configurator { width:100%; max-width:640px; display:flex; flex-direction:column; gap:1.25rem; }

  .pay-section { background:#17171f; border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:1.5rem; }
  .pay-section-title { font-size:0.78rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:rgba(232,234,240,0.4); margin-bottom:1rem; }

  /* Length grid */
  .length-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:0.5rem; }
  .length-btn  { background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.08); border-radius:12px; padding:0.65rem 0.5rem; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.2rem; transition:all 0.15s; }
  .length-btn:hover { border-color:rgba(201,168,76,0.4); }
  .length-btn.selected { border-color:#C9A84C; background:#1e1c14; box-shadow:0 0 0 1px #C9A84C; }
  .length-label    { font-size:0.85rem; font-weight:600; color:#E8EAF0; }
  .length-discount { font-size:0.7rem; color:#C9A84C; font-weight:700; }
  .length-rate     { font-size:0.72rem; color:rgba(232,234,240,0.4); }

  /* Addon rows */
  .addon-row { display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px solid rgba(255,255,255,0.05); }
  .addon-row:last-child { border-bottom:none; padding-bottom:0; }
  .addon-info { display:flex; flex-direction:column; gap:0.15rem; }
  .addon-name { font-size:0.9rem; font-weight:600; color:#E8EAF0; }
  .addon-desc { font-size:0.76rem; color:rgba(232,234,240,0.4); }

  /* Toggle */
  .toggle-btn { width:48px; height:26px; border-radius:100px; border:none; cursor:pointer; position:relative; transition:background 0.2s; background:rgba(255,255,255,0.1); flex-shrink:0; }
  .toggle-btn.on { background:#C9A84C; }
  .toggle-knob { position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; transition:transform 0.2s; display:block; }
  .toggle-btn.on .toggle-knob { transform:translateX(22px); }

  /* Payment mode */
  .mode-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
  .mode-btn  { background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.08); border-radius:14px; padding:1rem; cursor:pointer; display:flex; flex-direction:column; align-items:flex-start; gap:0.25rem; transition:all 0.15s; text-align:left; }
  .mode-btn:hover { border-color:rgba(201,168,76,0.35); }
  .mode-btn.selected { border-color:#C9A84C; background:#1e1c14; }
  .mode-label { font-size:0.88rem; font-weight:700; color:#E8EAF0; }
  .mode-desc  { font-size:0.72rem; color:rgba(232,234,240,0.4); line-height:1.4; }
  .mode-price { font-size:1.05rem; font-weight:800; color:#C9A84C; margin-top:0.25rem; }
  .mode-save  { font-size:0.72rem; color:#86efac; font-weight:600; background:rgba(34,197,94,0.1); border-radius:100px; padding:0.15rem 0.55rem; }

  /* Summary */
  .pay-summary { background:#17171f; border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:1.5rem; }
  .summary-title { font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:rgba(232,234,240,0.4); margin-bottom:1rem; }
  .summary-row { display:flex; justify-content:space-between; font-size:0.86rem; color:rgba(232,234,240,0.6); padding:0.3rem 0; }
  .summary-row.green span:last-child { color:#86efac; }
  .summary-row.limits { font-size:0.78rem; color:rgba(232,234,240,0.4); flex-direction:column; align-items:flex-start; }
  .summary-divider { border:none; border-top:1px solid rgba(255,255,255,0.06); margin:0.75rem 0; }
  .summary-total { display:flex; justify-content:space-between; align-items:baseline; margin-top:0.25rem; }
  .summary-total span:first-child { font-size:0.9rem; color:#E8EAF0; font-weight:600; }
  .total-amount { font-size:1.6rem; font-weight:800; color:#C9A84C; }
  .total-unit   { font-size:0.85rem; color:rgba(232,234,240,0.5); font-weight:500; }

  /* Pay button */
  .pay-btn { width:100%; padding:1rem; background:linear-gradient(135deg,#C9A84C,#E8C97A); color:#111; border:none; border-radius:14px; font-size:1.05rem; font-weight:700; cursor:pointer; transition:all 0.2s; }
  .pay-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(201,168,76,0.35); }
  .pay-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .pay-err { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#fca5a5; border-radius:12px; padding:0.85rem 1rem; font-size:0.86rem; }
  .pay-secure { font-size:0.76rem; color:rgba(232,234,240,0.25); text-align:center; margin-top:0.5rem; }
  .referral-row { display:flex; gap:0.5rem; align-items:center; }

  /* Physical section */
  .physical-section { background:#17171f; border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:1.5rem; }
  .physical-title { font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:rgba(232,234,240,0.4); margin-bottom:0.5rem; }
  .physical-sub   { font-size:0.82rem; color:rgba(232,234,240,0.45); margin-bottom:1rem; line-height:1.5; }
  .physical-grid  { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
  .physical-card  { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:1rem; display:flex; flex-direction:column; gap:0.3rem; }
  .physical-icon  { font-size:1.5rem; }
  .physical-label { font-size:0.88rem; font-weight:700; color:#E8EAF0; }
  .physical-desc  { font-size:0.75rem; color:rgba(232,234,240,0.4); line-height:1.4; }
  .physical-price { font-size:0.82rem; font-weight:600; color:#C9A84C; }
  .physical-btn   { margin-top:0.5rem; padding:0.5rem; background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.3); color:#C9A84C; border-radius:8px; font-size:0.82rem; font-weight:600; cursor:pointer; transition:all 0.15s; }
  .physical-btn:hover:not(:disabled) { background:rgba(201,168,76,0.2); }
  .physical-btn:disabled { opacity:0.35; cursor:not-allowed; }

  @media(max-width:500px) {
    .pay-title { font-size:1.6rem; }
    .length-grid { grid-template-columns:repeat(3,1fr); }
    .mode-grid { grid-template-columns:1fr; }
    .physical-grid { grid-template-columns:1fr; }
  }
`;
