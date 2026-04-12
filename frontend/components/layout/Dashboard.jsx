/**
 * Subscriber dashboard
 */

import { useEffect, useState } from 'react';
import { CDN, apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';
import {
  canCreateAlbumType,
  getPlanForType,
  getQuotaForType,
  getRemainingAlbumSlots,
  isOneTimePlan,
} from '../../lib/constants';
import Spinner from '../../components/shared/Spinner';

function formatDate(value) {
  if (!value) return 'No renewal date';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatPlan(plan) {
  const map = {
    'memorial-basic': 'Memorial Basic',
    'memorial-standard': 'Memorial Standard',
    'memorial-premium': 'Memorial Premium',
    'wedding-basic': 'Wedding Basic',
    'wedding-classic': 'Wedding Classic',
    'wedding-premium': 'Wedding Premium',
    monthly: 'Monthly',
    yearly: 'Yearly',
    lifetime: 'Lifetime',
  };
  return map[plan] || plan || 'No plan';
}

function StatCard({ label, value, sub }) {
  return (
    <div className="subdash-stat">
      <div className="subdash-stat-label">{label}</div>
      <div className="subdash-stat-value">{value}</div>
      <div className="subdash-stat-sub">{sub}</div>
    </div>
  );
}

function ActionCard({ label, sub, onClick }) {
  return (
    <button type="button" className="subdash-action" onClick={onClick}>
      <span className="subdash-action-label">{label}</span>
      <span className="subdash-action-sub">{sub}</span>
    </button>
  );
}

function AlbumCard({ album, canPreview, onPreview, onEdit, onSettings, onQr, onDelete, isWedding }) {
  const coverStyle = album.cover_key
    ? { backgroundImage: `url(${CDN}/${album.cover_key})` }
    : {
        backgroundImage: isWedding
          ? 'linear-gradient(135deg, #FCE7F3, #F5D0FE)'
          : 'linear-gradient(135deg, #E2E8F0, #CBD5E1)',
      };

  const dateLabel = isWedding
    ? (album.wedding_date ? formatDate(album.wedding_date) : 'Wedding date not set')
    : album.birth_year && album.death_year
      ? `${album.birth_year} - ${album.death_year}`
      : album.birth_year || 'Dates not added';

  return (
    <article className="subdash-album">
      <button
        type="button"
        className="subdash-album-cover"
        onClick={() => canPreview && onPreview(album)}
        style={coverStyle}
      >
        <span className={`subdash-status-pill ${album.is_published ? 'live' : 'draft'}`}>
          {album.is_published ? 'Live' : 'Draft'}
        </span>
      </button>
      <div className="subdash-album-body">
        <div className="subdash-album-header">
          <div>
            <div className="subdash-album-name">{album.name}</div>
            <div className="subdash-album-date">{dateLabel}</div>
          </div>
          <div className="subdash-album-avatar">
            {album.avatar_key
              ? <img src={`${CDN}/${album.avatar_key}`} alt="Album avatar" />
              : <span>{(album.name || 'A')[0].toUpperCase()}</span>}
          </div>
        </div>
        <div className="subdash-album-metrics">
          <span>{album.view_count || 0} views</span>
          <span>{album.media_count || 0} media</span>
          {!isWedding && <span>{album.tribute_count || 0} tributes</span>}
        </div>
      </div>
      <div className="subdash-album-actions">
        <button type="button" className="subdash-btn ghost" onClick={() => onSettings(album)}>Settings</button>
        <button type="button" className="subdash-btn ghost" onClick={() => onEdit(album)}>Edit</button>
        <button type="button" className="subdash-btn ghost" onClick={() => onQr(album)}>QR</button>
        <button type="button" className="subdash-btn danger" onClick={(event) => onDelete(album, event)}>Delete</button>
      </div>
    </article>
  );
}

export default function Dashboard({ user, setPage, setCurrentAlbum, showToast }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  const token = getToken();

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const data = await apiCall('/api/albums', {}, token);
        if (!active) return;

        const nextAlbums = data.albums || [];
        setAlbums(nextAlbums);

        if (nextAlbums[0]?.id) {
          apiCall(`/api/albums/${nextAlbums[0].id}/health`, {}, token)
            .then((result) => {
              if (active) setHealth(result);
            })
            .catch(() => {});
        }
      } catch (err) {
        if (active) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [token]);

  const memorialAlbums = albums.filter((album) => album.type !== 'wedding');
  const weddingAlbums = albums.filter((album) => album.type === 'wedding');
  const publishedCount = albums.filter((album) => album.is_published).length;
  const draftCount = albums.length - publishedCount;
  const totalViews = albums.reduce((sum, album) => sum + (album.view_count || 0), 0);
  const totalMedia = albums.reduce((sum, album) => sum + (album.media_count || 0), 0);
  const totalTributes = albums.reduce((sum, album) => sum + (album.tribute_count || 0), 0);
  const memorialPlan = getPlanForType(user, 'memorial');
  const weddingPlan = getPlanForType(user, 'wedding');
  const memorialQuota = getQuotaForType(user, 'memorial');
  const weddingQuota = getQuotaForType(user, 'wedding');
  const memorialRemaining = getRemainingAlbumSlots(user, albums, 'memorial');
  const weddingRemaining = getRemainingAlbumSlots(user, albums, 'wedding');
  const canCreateMemorial = canCreateAlbumType(user, albums, 'memorial');
  const canCreateWedding = canCreateAlbumType(user, albums, 'wedding');
  const canCreateMore = canCreateMemorial || canCreateWedding;
  const usageParts = [];
  if (user?.hasMemorial || memorialAlbums.length > 0 || memorialPlan) {
    usageParts.push(memorialQuota === Infinity
      ? `${memorialAlbums.length} memorial albums`
      : `Memorial ${memorialAlbums.length}/${memorialQuota}`);
  }
  if (user?.hasWedding || weddingAlbums.length > 0 || weddingPlan) {
    usageParts.push(weddingQuota === Infinity
      ? `${weddingAlbums.length} wedding albums`
      : `Wedding ${weddingAlbums.length}/${weddingQuota}`);
  }
  const usageText = usageParts.length ? usageParts.join(' · ') : `${albums.length} albums in workspace`;
  const healthScore = health?.score || 0;
  const firstAlbum = albums[0] || null;
  const planTone = user?.hasWedding && !user?.hasMemorial
    ? 'wedding'
    : isOneTimePlan(user?.subscriptionPlan)
      ? 'premium'
      : 'memorial';

  const viewAlbum = (album) => {
    setCurrentAlbum(album);
    setPage('public-view');
  };
  const editAlbum = (album) => {
    setCurrentAlbum(album);
    setPage('create');
  };
  const openSettings = (album) => {
    setCurrentAlbum(album);
    setPage('settings');
  };
  const openQr = (album) => {
    setCurrentAlbum(album);
    setPage('qr');
  };
  const newAlbum = () => {
    setCurrentAlbum(null);
    setPage('create');
  };

  const deleteAlbum = async (album, event) => {
    event.stopPropagation();
    if (!confirm(`Delete "${album.name}"? This cannot be undone.`)) return;

    try {
      await apiCall(`/api/albums/${album.id}`, { method: 'DELETE' }, token);
      setAlbums((prev) => prev.filter((item) => item.id !== album.id));
      showToast?.('Album deleted');
    } catch (err) {
      showToast?.(err.message || 'Failed to delete album', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem' }}>
        <Spinner dark />
      </div>
    );
  }

  return (
    <div className="subdash">
      <section className="subdash-hero">
        <div>
          <div className="subdash-eyebrow">Workspace</div>
          <h2 className="subdash-title">Manage your albums in one place</h2>
          <p className="subdash-copy">
            A faster overview of your subscriber workspace with grouped albums, quick actions,
            health status, and billing context.
          </p>
          <div className="subdash-plan-row">
            {(user?.hasMemorial || (!user?.hasWedding && memorialAlbums.length > 0)) && <span className="subdash-plan memorial">{formatPlan(memorialPlan || user.subscriptionPlan)}</span>}
            {(user?.hasWedding || (!user?.hasMemorial && weddingAlbums.length > 0)) && <span className="subdash-plan wedding">{formatPlan(weddingPlan || user.subscriptionPlan)}</span>}
            {!user?.hasMemorial && !user?.hasWedding && albums.length === 0 && <span className={`subdash-plan ${planTone}`}>{formatPlan(user?.subscriptionPlan)}</span>}
            <span className="subdash-plan subtle">{usageText}</span>
          </div>
        </div>
        <div className="subdash-hero-actions">
          {canCreateMore && <button type="button" className="subdash-btn primary" onClick={newAlbum}>Create Album</button>}
          <button type="button" className="subdash-btn secondary" onClick={() => setPage('account')}>Manage Billing</button>
        </div>
      </section>

      {user?.isDemo && (
        <div className="subdash-banner demo">
          <div>
            <div className="subdash-banner-title">Demo mode is active</div>
            <div className="subdash-banner-copy">Upgrade before the trial ends to keep your albums and media.</div>
          </div>
          <button type="button" className="subdash-btn secondary" onClick={() => setPage('payment')}>View Plans</button>
        </div>
      )}

      {user?.cancelAtPeriodEnd && (
        <div className="subdash-banner warn">
          <div>
            <div className="subdash-banner-title">Subscription ends soon</div>
            <div className="subdash-banner-copy">Your access is set to cancel at the end of the current billing period.</div>
          </div>
          <button type="button" className="subdash-btn secondary" onClick={() => setPage('account')}>Review Billing</button>
        </div>
      )}

      {user?.subscriptionStatus === 'past_due' && (
        <div className="subdash-banner danger">
          <div>
            <div className="subdash-banner-title">Payment action needed</div>
            <div className="subdash-banner-copy">Your last payment failed. Update billing to avoid service interruption.</div>
          </div>
          <button type="button" className="subdash-btn secondary" onClick={() => setPage('payment')}>Retry Payment</button>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <section className="subdash-stat-grid">
        <StatCard label="Albums" value={albums.length} sub={`${publishedCount} live / ${draftCount} draft`} />
        <StatCard label="Views" value={totalViews} sub="Across all albums" />
        <StatCard label="Media" value={totalMedia} sub="Photos and videos uploaded" />
        <StatCard label="Tributes" value={totalTributes} sub="Messages and memories shared" />
      </section>

      <section className="subdash-actions">
        <ActionCard label="QR Plaque" sub="Design and download QR signage" onClick={() => setPage('plaque')} />
        <ActionCard label="Analytics" sub="Track traffic and engagement" onClick={() => setPage('analytics')} />
        <ActionCard label="Life Events" sub="Update timeline milestones" onClick={() => setPage('life-events')} />
        <ActionCard label="Invoices" sub="Review receipts and billing history" onClick={() => setPage('invoices')} />
      </section>

      <section className="subdash-layout">
        <div className="subdash-main-panel">
          <div className="subdash-section-head">
            <div>
              <div className="subdash-section-label">Albums</div>
              <div className="subdash-section-title">Your collection</div>
            </div>
            {canCreateMore
              ? <button type="button" className="subdash-btn primary" onClick={newAlbum}>New Album</button>
              : <button type="button" className="subdash-btn secondary" onClick={() => setPage('payment')}>Upgrade Plan</button>}
          </div>

          {albums.length === 0 ? (
            <div className="subdash-empty">
              <div className="subdash-empty-title">Create your first album</div>
              <div className="subdash-empty-copy">
                Start with a clean workspace and build a memorial or wedding collection with media, stories, and QR sharing.
              </div>
              <button type="button" className="subdash-btn primary" onClick={newAlbum}>Create Album</button>
            </div>
          ) : (
            <div className="subdash-album-sections">
              {memorialAlbums.length > 0 && (
                <div className="subdash-album-section">
                  <div className="subdash-group-title">Memorial Albums</div>
                  <div className="subdash-album-grid">
                    {memorialAlbums.map((album) => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        canPreview
                        onPreview={viewAlbum}
                        onEdit={editAlbum}
                        onSettings={openSettings}
                        onQr={openQr}
                        onDelete={deleteAlbum}
                        isWedding={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {weddingAlbums.length > 0 && (
                <div className="subdash-album-section">
                  <div className="subdash-group-title">Wedding Albums</div>
                  <div className="subdash-album-grid">
                    {weddingAlbums.map((album) => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        canPreview
                        onPreview={viewAlbum}
                        onEdit={editAlbum}
                        onSettings={openSettings}
                        onQr={openQr}
                        onDelete={deleteAlbum}
                        isWedding
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="subdash-side-panel">
          <div className="subdash-side-card">
            <div className="subdash-side-label">Subscription</div>
            <div className="subdash-side-title">
              {[memorialPlan && formatPlan(memorialPlan), weddingPlan && formatPlan(weddingPlan)].filter(Boolean).join(' + ') || formatPlan(user?.subscriptionPlan)}
            </div>
            <div className="subdash-side-copy">
              {user?.currentPeriodEnd
                ? `Renews on ${formatDate(user.currentPeriodEnd)}`
                : 'Long-term access is active for this account.'}
            </div>
          </div>

          {firstAlbum && health && (
            <div className="subdash-side-card">
              <div className="subdash-side-label">Completeness</div>
              <div className="subdash-side-title">{healthScore}% ready</div>
              <div className="subdash-side-copy">Based on your first album: {firstAlbum.name}</div>
              <div className="db-health-bar" style={{ marginTop: '1rem' }}>
                <div
                  className="db-health-fill"
                  style={{
                    width: `${healthScore}%`,
                    background: healthScore >= 80
                      ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                      : healthScore >= 50
                        ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                        : 'linear-gradient(90deg,#ef4444,#dc2626)',
                  }}
                />
              </div>
              {Array.isArray(health.checks) && health.checks.length > 0 && (
                <div className="subdash-checks">
                  {health.checks.slice(0, 5).map((item) => (
                    <span key={item.id} className={`subdash-check ${item.done ? 'done' : 'todo'}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="subdash-side-card">
            <div className="subdash-side-label">Workspace Summary</div>
            <div className="subdash-mini-list">
              <div className="subdash-mini-row"><span>Memorial albums</span><strong>{memorialQuota === Infinity ? `${memorialAlbums.length}` : `${memorialAlbums.length}/${memorialQuota}`}</strong></div>
              <div className="subdash-mini-row"><span>Wedding albums</span><strong>{weddingQuota === Infinity ? `${weddingAlbums.length}` : `${weddingAlbums.length}/${weddingQuota}`}</strong></div>
              <div className="subdash-mini-row"><span>Slots left</span><strong>{`${memorialRemaining === Infinity ? '∞' : memorialRemaining} M / ${weddingRemaining === Infinity ? '∞' : weddingRemaining} W`}</strong></div>
              <div className="subdash-mini-row"><span>Published albums</span><strong>{publishedCount}</strong></div>
              <div className="subdash-mini-row"><span>Draft albums</span><strong>{draftCount}</strong></div>
            </div>
          </div>

          {!canCreateMore && (
            <div className="subdash-side-card emphasis">
              <div className="subdash-side-label">Need more slots?</div>
              <div className="subdash-side-title">Your current quota is full</div>
              <div className="subdash-side-copy">Upgrade to add more people, events, or wedding chapters to this workspace.</div>
              <button type="button" className="subdash-btn primary" style={{ marginTop: '1rem' }} onClick={() => setPage('payment')}>
                Upgrade Plan
              </button>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
