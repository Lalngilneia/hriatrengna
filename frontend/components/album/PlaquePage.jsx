import { useEffect, useState } from 'react';
import { API, apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { getAlbumFeatureAccess } from '../../lib/constants';
import Spinner from '../../components/shared/Spinner';

const PLAQUE_THEMES = [
  { id: 'classic', label: 'Classic', desc: 'Timeless black and gold finish' },
  { id: 'dark', label: 'Dark', desc: 'Deep charcoal with strong contrast' },
  { id: 'floral', label: 'Floral', desc: 'Soft decorative styling' },
  { id: 'traditional', label: 'Traditional', desc: 'Formal serif presentation' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean and modern layout' },
];

const DOWNLOAD_FORMATS = [
  { id: 'png', label: 'PNG Image', sub: 'Best for quick sharing or local printing' },
  { id: 'pdf', label: 'PDF Document', sub: 'Best for professional printing and framing' },
];

export default function PlaquePage({ user, currentAlbum, setCurrentAlbum, setPage }) {
  const [theme, setTheme] = useState('classic');
  const [format, setFormat] = useState('png');
  const [downloading, setDownloading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(!currentAlbum?.id);
  const token = getToken();
  const featureAccess = getAlbumFeatureAccess(user, currentAlbum?.type === 'wedding' ? 'wedding' : 'memorial');

  useEffect(() => {
    if (currentAlbum?.id) return;
    const tok = getToken();
    apiCall('/api/albums', {}, tok)
      .then((result) => {
        const firstAlbum = result.albums?.[0];
        if (firstAlbum) {
          setCurrentAlbum(firstAlbum);
        } else {
          setPage('dashboard');
        }
      })
      .catch(() => setPage('dashboard'))
      .finally(() => setAutoLoading(false));
  }, [currentAlbum?.id, setCurrentAlbum, setPage]);

  const download = async () => {
    if (!featureAccess.canDownloadPlaque) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API}/api/albums/${currentAlbum.id}/plaque?format=${format}&theme=${theme}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentAlbum.slug}-plaque.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Plaque download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  if (autoLoading && !currentAlbum?.id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <Spinner dark />
      </div>
    );
  }

  if (!currentAlbum?.id) return null;

  const selectedTheme = PLAQUE_THEMES.find((item) => item.id === theme);

  return (
    <div className="subpage">
      <div className="subpage-header">
        <div className="subpage-header-copy">
          <button type="button" className="subpage-back" onClick={() => setPage('dashboard')}>
            Back
          </button>
          <div className="subpage-eyebrow">Print Studio</div>
          <h1 className="subpage-title" style={{ margin: 0 }}>QR Plaque Designer</h1>
          <p className="subpage-sub">
            Prepare a clean print-ready plaque for <strong>{currentAlbum.name}</strong> with the QR code, branding,
            and your preferred presentation style.
          </p>
        </div>
        <div className="subpage-actions">
          <button type="button" className="subdash-btn ghost" onClick={() => setPage('qr')}>
            Open QR View
          </button>
          <button type="button" className="subdash-btn primary" onClick={download} disabled={downloading || !featureAccess.canDownloadPlaque}>
            {downloading ? 'Generating...' : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>

      {!featureAccess.canDownloadPlaque && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Print-ready plaque downloads are not included in your current plan for this album.
        </div>
      )}

      <div className="subpage-grid">
        <div className="subpage-card pad">
          <div className="subpage-stat-label">Album</div>
          <div className="subpage-stat-value" style={{ fontSize: '1.25rem' }}>{currentAlbum.name}</div>
          <div className="subpage-stat-sub">{currentAlbum.slug}</div>
        </div>
        <div className="subpage-card pad">
          <div className="subpage-stat-label">Theme</div>
          <div className="subpage-stat-value" style={{ fontSize: '1.25rem' }}>{selectedTheme?.label}</div>
          <div className="subpage-stat-sub">{selectedTheme?.desc}</div>
        </div>
        <div className="subpage-card pad">
          <div className="subpage-stat-label">Format</div>
          <div className="subpage-stat-value" style={{ fontSize: '1.25rem' }}>{format.toUpperCase()}</div>
          <div className="subpage-stat-sub">
            {DOWNLOAD_FORMATS.find((item) => item.id === format)?.sub}
          </div>
        </div>
      </div>

      <div className="subpage-card pad">
        <div className="subpage-section-title">Choose a Theme</div>
        <p className="subpage-section-sub">
          Pick the look that best matches the memorial or occasion before exporting the plaque.
        </p>
        <div className="theme-grid">
          {PLAQUE_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`theme-option${theme === item.id ? ' selected' : ''}`}
              onClick={() => setTheme(item.id)}
              style={{ background: theme === item.id ? '#FFF8E6' : '#FFFFFF' }}
            >
              <div className="theme-name">{item.label}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.3rem', lineHeight: 1.6 }}>
                {item.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="subpage-grid">
        <div className="subpage-card pad">
          <div className="subpage-section-title">Export Format</div>
          <p className="subpage-section-sub">
            Choose the file type that best fits how you want to print or share the plaque.
          </p>
          <div className="subpage-list">
            {DOWNLOAD_FORMATS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFormat(item.id)}
                className={`subsettings-tab${format === item.id ? ' active' : ''}`}
                style={{ justifyContent: 'flex-start', width: '100%' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="subpage-card pad">
          <div className="subpage-section-title">Included in the Plaque</div>
          <p className="subpage-section-sub">
            Every export includes the album name, dates, QR code, and Hriatrengna branding in the theme you select.
          </p>
          <div className="subpage-list">
            <div className="subpage-row">
              <span>Album title</span>
              <strong>Included</strong>
            </div>
            <div className="subpage-row">
              <span>QR code</span>
              <strong>Included</strong>
            </div>
            <div className="subpage-row">
              <span>Theme styling</span>
              <strong>{selectedTheme?.label}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="subpage-card pad">
        <div className="subpage-section-title">Ready to Export</div>
        <p className="subpage-section-sub">
          Download a {format.toUpperCase()} plaque using the <strong>{selectedTheme?.label}</strong> theme.
        </p>
        <div className="subpage-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="subdash-btn primary" onClick={download} disabled={downloading || !featureAccess.canDownloadPlaque}>
            {downloading ? 'Generating...' : `Download ${format.toUpperCase()} Plaque`}
          </button>
        </div>
      </div>
    </div>
  );
}
