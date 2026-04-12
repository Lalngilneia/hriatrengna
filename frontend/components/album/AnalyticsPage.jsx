/**
 * Subscriber analytics page
 */

import { useEffect, useState } from 'react';
import { apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';
import Spinner from '../../components/shared/Spinner';

function StatCard({ label, value, sub }) {
  return (
    <div className="subpage-card pad">
      <div className="subpage-stat-label">{label}</div>
      <div className="subpage-stat-value">{value}</div>
      <div className="subpage-stat-sub">{sub}</div>
    </div>
  );
}

export default function AnalyticsPage({ currentAlbum, setCurrentAlbum, setPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = getToken();

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!currentAlbum?.id) {
        try {
          const result = await apiCall('/api/albums', {}, token);
          const first = result.albums?.[0];
          if (!active) return;
          if (first) {
            setCurrentAlbum(first);
          } else {
            setPage('dashboard');
          }
        } catch {
          if (active) setPage('dashboard');
        }
        return;
      }

      try {
        const result = await apiCall(`/api/albums/${currentAlbum.id}/analytics`, {}, token);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load analytics');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [currentAlbum?.id, setCurrentAlbum, setPage, token]);

  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner dark />
      </div>
    );
  }

  const summary = data?.summary || {};
  const byDay = data?.byDay || [];
  const byReferrer = data?.byReferrer || [];
  const maxViews = byDay.length ? Math.max(...byDay.map((item) => parseInt(item.views, 10) || 0), 1) : 1;
  const conversion = summary.total_views
    ? `${Math.round(((summary.unique_visitors || 0) / summary.total_views) * 100)}% unique`
    : 'No visitor data yet';

  return (
    <div className="subpage">
      <section className="subpage-header">
        <div className="subpage-header-copy">
          <button type="button" className="subpage-back" onClick={() => setPage('dashboard')}>
            Back to Dashboard
          </button>
          <div className="subpage-eyebrow">Analytics</div>
          <div className="subpage-title">Visitor insights</div>
          <div className="subpage-sub">
            Track traffic, repeat visits, and referral sources for {currentAlbum?.name || 'this album'}.
          </div>
        </div>
        <div className="subpage-actions">
          <button type="button" className="subdash-btn secondary" onClick={() => setPage('qr')}>
            Open QR
          </button>
        </div>
      </section>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <section className="subpage-grid">
        <StatCard label="Total Views" value={summary.total_views || 0} sub="All recorded visits" />
        <StatCard label="Unique Visitors" value={summary.unique_visitors || 0} sub={conversion} />
        <StatCard label="Last 30 Days" value={summary.views_30d || 0} sub="Recent interest" />
        <StatCard label="Today" value={summary.views_today || 0} sub="Current daily traffic" />
      </section>

      <section className="subpage-card pad">
        <div className="subpage-section-title">Daily trend</div>
        <div className="subpage-section-sub">Last 30 days of traffic to this album.</div>
        {byDay.length > 0 ? (
          <>
            <div className="subpage-chart">
              {byDay.slice(-30).map((item, index) => {
                const height = Math.max(8, ((parseInt(item.views, 10) || 0) / maxViews) * 100);
                return (
                  <div
                    key={`${item.day}-${index}`}
                    className="subpage-bar"
                    style={{ height: `${height}%` }}
                    title={`${item.day}: ${item.views} views`}
                  />
                );
              })}
            </div>
            <div className="subpage-row" style={{ paddingTop: '0.9rem' }}>
              <span>{byDay[0]?.day?.substring(5) || 'Start'}</span>
              <strong>{byDay[byDay.length - 1]?.day?.substring(5) || 'Now'}</strong>
            </div>
          </>
        ) : (
          <div className="subpage-empty">
            <div className="subpage-empty-title">No analytics yet</div>
            <div>Share your album link or QR code to begin collecting visitor data.</div>
          </div>
        )}
      </section>

      <section className="subpage-card pad">
        <div className="subpage-section-title">Top referrers</div>
        <div className="subpage-section-sub">Where your visitors are coming from right now.</div>
        {byReferrer.length > 0 ? (
          <div className="subpage-list">
            {byReferrer.slice(0, 6).map((item, index) => (
              <div className="subpage-row" key={`${item.referrer || 'direct'}-${index}`}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.referrer || 'Direct'}
                </span>
                <strong>{item.views}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="subpage-empty">
            <div className="subpage-empty-title">No referral data yet</div>
            <div>Referrers will appear here after visitors start opening your link from other apps or websites.</div>
          </div>
        )}
      </section>
    </div>
  );
}
