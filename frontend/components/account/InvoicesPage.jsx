import { useEffect, useMemo, useState } from 'react';
import { API, apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';
import Spinner from '../../components/shared/Spinner';

function RefundBadge({ status }) {
  const colors = {
    requested: { bg: '#FEF3C7', color: '#92400E' },
    approved: { bg: '#DBEAFE', color: '#1D4ED8' },
    rejected: { bg: '#FEE2E2', color: '#B91C1C' },
    processing: { bg: '#E0E7FF', color: '#4338CA' },
    processed: { bg: '#DCFCE7', color: '#166534' },
    failed: { bg: '#FDE68A', color: '#92400E' },
  };
  const tone = colors[status] || { bg: '#E5E7EB', color: '#374151' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.25rem 0.6rem',
      borderRadius: 999,
      fontSize: '0.72rem',
      fontWeight: 600,
      textTransform: 'capitalize',
      background: tone.bg,
      color: tone.color,
    }}>
      {status}
    </span>
  );
}

function InvoicesPage({ setPage }) {
  const [invoices, setInvoices] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const token = getToken();

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceData, refundData] = await Promise.all([
        apiCall('/api/payments/invoices', {}, token),
        apiCall('/api/payments/refunds', {}, token),
      ]);
      setInvoices(invoiceData.invoices || []);
      setRefunds(refundData.refunds || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refundMap = useMemo(() => {
    const map = new Map();
    refunds.forEach((refund) => {
      if (refund.transaction_id && !map.has(refund.transaction_id)) {
        map.set(refund.transaction_id, refund);
      }
    });
    return map;
  }, [refunds]);

  const downloadPdf = async (id, num) => {
    setDownloading(id);
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
      alert('Download failed: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  const requestRefund = async (invoice) => {
    if (!invoice.transaction_id) {
      alert('This invoice is not linked to a refundable transaction.');
      return;
    }

    const reason = window.prompt(
      'Tell us briefly why you want this refund reviewed.',
      'Requested by customer'
    );
    if (reason === null) return;

    setRequesting(invoice.id);
    try {
      await apiCall('/api/payments/refunds/request', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: invoice.transaction_id,
          invoiceId: invoice.id,
          reason: reason.trim(),
        }),
      }, token);
      await loadAll();
      alert('Your refund request has been submitted for review.');
    } catch (err) {
      alert('Refund request failed: ' + err.message);
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner dark />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', paddingTop: '4rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
        <button
          onClick={() => setPage('dashboard')}
          style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1.5rem' }}
        >
          Back
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem' }}>Payment History</h1>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Download invoices and request a refund review for eligible payments.
        </p>

        {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}

        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
          {invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Invoices</div>
              <p style={{ margin: 0, fontWeight: 500 }}>No invoices yet</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Your payment receipts will appear here</p>
            </div>
          ) : (
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Refund</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const refund = refundMap.get(inv.transaction_id);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{inv.invoice_number}</td>
                      <td>{new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td>{inv.description || 'Hriatrengna Subscription'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>Rs {Number(inv.amount_inr || 0).toLocaleString('en-IN')}</td>
                      <td>
                        {refund ? (
                          <RefundBadge status={refund.status} />
                        ) : (
                          <button
                            onClick={() => requestRefund(inv)}
                            disabled={requesting === inv.id}
                            style={{
                              background: '#FFF7ED',
                              border: '1px solid #FDBA74',
                              color: '#C2410C',
                              borderRadius: 999,
                              padding: '0.35rem 0.75rem',
                              cursor: requesting === inv.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {requesting === inv.id ? 'Sending...' : 'Request refund'}
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                          disabled={downloading === inv.id}
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: downloading === inv.id ? 'not-allowed' : 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                        >
                          {downloading === inv.id ? '...' : 'PDF'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.25rem 1.4rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#111827', marginBottom: '0.35rem' }}>Refund requests</h2>
          <p style={{ color: '#6B7280', fontSize: '0.88rem', marginBottom: '1rem' }}>
            Requests are reviewed by the admin team before any refund is processed.
          </p>
          {refunds.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No refund requests yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {refunds.map((refund) => (
                <div
                  key={refund.id}
                  style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: 14,
                    padding: '0.95rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    background: '#FCFCFD',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
                      {refund.invoice_number || 'Refund request'}
                    </div>
                    <div style={{ fontSize: '0.83rem', color: '#6B7280', lineHeight: 1.6 }}>
                      Amount: Rs {Number(refund.approved_amount_inr || refund.requested_amount_inr || 0).toLocaleString('en-IN')}
                    </div>
                    {refund.reason && (
                      <div style={{ fontSize: '0.83rem', color: '#4B5563', marginTop: '0.35rem' }}>
                        Reason: {refund.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                    <RefundBadge status={refund.status} />
                    <span style={{ fontSize: '0.76rem', color: '#9CA3AF' }}>
                      {new Date(refund.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InvoicesPage;
