/**
 * components/album/RsvpTab.jsx
 *
 * RSVP management tab — shown inside AlbumSettings for wedding albums.
 * Shows: attending/declined/maybe counts, full guest list, CSV export, delete.
 */

import { useState, useEffect } from 'react';
import { apiCall } from '../../lib/api';

export default function RsvpTab({ albumId, token, showToast }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');   // all | yes | no | maybe
  const [deleting,setDeleting]= useState(null);

  const load = () => {
    setLoading(true);
    apiCall(`/api/albums/${albumId}/rsvps`, {}, token)
      .then(d => setData(d))
      .catch(e => showToast?.(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [albumId]);

  const remove = async (id) => {
    if (!confirm('Remove this RSVP?')) return;
    setDeleting(id);
    try {
      await apiCall(`/api/albums/${albumId}/rsvps/${id}`, { method: 'DELETE' }, token);
      showToast?.('RSVP removed');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setDeleting(null); }
  };

  const exportCsv = () => {
    if (!data?.rsvps?.length) return;
    const rows = [
      ['Name', 'Email', 'Attending', 'Guests', 'Message', 'Date'],
      ...data.rsvps.map(r => [
        r.guest_name, r.guest_email || '', r.attending,
        r.guest_count || 1, r.message || '',
        new Date(r.created_at).toLocaleDateString('en-IN'),
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `rsvps-${albumId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Loading RSVPs…</div>
  );

  const rsvps    = data?.rsvps  || [];
  const summary  = data?.summary || {};
  const filtered = filter === 'all' ? rsvps : rsvps.filter(r => r.attending === filter);

  const statusColor = { yes: '#22c55e', no: '#ef4444', maybe: '#f59e0b' };
  const statusLabel = { yes: '✓ Attending', no: '✗ Not Attending', maybe: '◎ Maybe' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Responses', value: summary.total || 0,       color: '#1a1a1a' },
          { label: 'Attending',       value: summary.attending || 0,   color: '#22c55e' },
          { label: 'Declined',        value: summary.declined || 0,    color: '#ef4444' },
          { label: 'Total Guests',    value: summary.totalGuests || 0, color: '#6366f1' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'white', borderRadius: 12,
            padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.color }}>
              {c.value}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.2rem' }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Export */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['all', 'yes', 'no', 'maybe'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: 100,
                border: '1.5px solid',
                borderColor: filter === f ? '#1a1a1a' : '#E5E5E5',
                background: filter === f ? '#1a1a1a' : 'white',
                color: filter === f ? 'white' : '#666',
                fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                textTransform: 'capitalize',
              }}>
              {f === 'all' ? `All (${rsvps.length})` :
               f === 'yes' ? `Attending (${rsvps.filter(r => r.attending === 'yes').length})` :
               f === 'no'  ? `Declined (${rsvps.filter(r => r.attending === 'no').length})` :
               `Maybe (${rsvps.filter(r => r.attending === 'maybe').length})`}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} disabled={!rsvps.length}
          style={{
            padding: '0.35rem 0.85rem', borderRadius: 100,
            border: '1.5px solid #E5E5E5', background: 'white',
            color: '#444', fontSize: '0.78rem', cursor: rsvps.length ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '0.3rem',
          }}>
          ⬇ Export CSV
        </button>
      </div>

      {/* RSVP list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999',
          background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💌</div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {rsvps.length === 0 ? 'No RSVPs yet. Share your invitation to get responses.' : 'No results for this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(r => (
            <div key={r.id} style={{
              background: 'white', borderRadius: 12, padding: '0.9rem 1.1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: '1rem',
              borderLeft: `3px solid ${statusColor[r.attending]}`,
            }}>
              {/* Avatar initial */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: `${statusColor[r.attending]}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.9rem', color: statusColor[r.attending],
              }}>
                {r.guest_name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                  flexWrap: 'wrap', marginBottom: '0.1rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a1a1a' }}>
                    {r.guest_name}
                  </span>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 600, padding: '0.1rem 0.5rem',
                    borderRadius: 100, background: `${statusColor[r.attending]}18`,
                    color: statusColor[r.attending],
                  }}>
                    {statusLabel[r.attending]}
                  </span>
                  {r.attending === 'yes' && r.guest_count > 1 && (
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>
                      {r.guest_count} guests
                    </span>
                  )}
                </div>
                {r.guest_email && (
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{r.guest_email}</div>
                )}
                {r.message && (
                  <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.2rem',
                    fontStyle: 'italic' }}>"{r.message}"</div>
                )}
              </div>

              {/* Date + delete */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                gap: '0.3rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.7rem', color: '#bbb' }}>
                  {new Date(r.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short',
                  })}
                </span>
                <button onClick={() => remove(r.id)} disabled={deleting === r.id}
                  style={{
                    background: 'none', border: 'none', color: '#ccc',
                    cursor: 'pointer', fontSize: '0.85rem', padding: '0.1rem 0.3rem',
                  }}
                  title="Remove RSVP">
                  {deleting === r.id ? '…' : '🗑'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
