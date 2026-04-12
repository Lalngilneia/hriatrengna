/**
 * QRPage
 * Auto-extracted from index.jsx during refactor.
 * Edit this file to modify QRPage in isolation.
 */

import { API, APP_URL } from '../../lib/api';
import { getToken } from '../../lib/auth';
import { WEDDING_ALBUM_LABELS, getQRUrl} from '../../lib/constants';

function QRPage({ user, currentAlbum, setPage }) {
  if (!currentAlbum?.slug) { setPage("dashboard"); return null; }

  const album    = currentAlbum;
  const isWedding = album.type === 'wedding';
  
  // For wedding albums, link to wedding collection page
  // For memorial albums, link to individual album
  const albumUrl = isWedding 
    ? `${APP_URL}/wedding/${album.slug}`
    : `${APP_URL}/album/${album.slug}`;
    
  const token    = getToken();

  const downloadQR = async (format) => {
    try {
      const res = await fetch(`${API}/api/albums/${album.id}/qr?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${album.slug}-qr.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("QR download failed: " + err.message);
    }
  };

  return (
    <div className="qr-page">
      <div className="qr-inner fade-up">
        <div className="qr-success-badge">✓ Album {currentAlbum?.isEdit ? "Updated" : "Created"} Successfully</div>
        <h1 className="qr-title">
          {isWedding ? "Your Wedding Collection" : "Your QR Code"}
          <br />is Ready
        </h1>
        <p className="qr-sub">
          {isWedding 
            ? "This QR code links to your entire wedding collection. Share it with guests to see all your wedding albums."
            : "Print it, engrave it, or share the link — anyone who scans it will see the album instantly."}
        </p>

        <div className="qr-card">
          <div className="qr-name">{album.name}</div>
          {(album.birth_year || album.death_year) && (
            <div className="qr-dates">{album.birth_year} {album.death_year ? `— ${album.death_year}` : ""}</div>
          )}
          {isWedding && album.album_label && (
            <div className="qr-dates">{WEDDING_ALBUM_LABELS.find(l => l.value === album.album_label)?.label || album.album_label}</div>
          )}
          <div className="qr-code-wrap">
            <img src={getQRUrl(isWedding ? `wedding/${album.slug}` : album.slug)} alt="QR Code" width={200} height={200} style={{ display: "block", borderRadius: 8 }} />
          </div>
          <div className="qr-url">{albumUrl}</div>
        </div>

        <div className="qr-actions">
          <button className="btn-primary" onClick={() => setPage("public-view")}>
            {isWedding ? "Preview Collection →" : "Preview Album →"}
          </button>
          <button className="btn-secondary" onClick={() => downloadQR("png")}>⬇ Download QR (PNG)</button>
          <button className="btn-secondary" onClick={() => downloadQR("svg")}>⬇ Download QR (SVG)</button>
        </div>

        <div className="tip-box">
          <strong>💡 Where to use this QR code</strong>
          <ul>
            {isWedding ? (
              <>
                <li>Share on wedding invitations</li>
                <li>Display at the wedding venue</li>
                <li>Include in wedding programs</li>
                <li>Share via WhatsApp, email, or social media</li>
              </>
            ) : (
              <>
                <li>Print on funeral or memorial service programs</li>
                <li>Engrave on a gravestone or memorial plaque</li>
                <li>Share via WhatsApp, email, or social media</li>
                <li>Display at a wake, celebration of life, or reception</li>
              </>
            )}
          </ul>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <button className="btn-secondary" onClick={() => setPage("dashboard")}>← Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
}


// ── PLAQUE DESIGNER ──────────────────────────────────────────
const PLAQUE_THEMES = [
  { id: 'classic',     label: 'Classic',     icon: '🖤', desc: 'Timeless black & gold' },
  { id: 'dark',        label: 'Dark',        icon: '🌑', desc: 'Deep charcoal' },
  { id: 'floral',      label: 'Floral',      icon: '🌸', desc: 'Soft floral border' },
  { id: 'traditional', label: 'Traditional', icon: '📜', desc: 'Heritage serif style' },
  { id: 'minimal',     label: 'Minimal',     icon: '⬜', desc: 'Clean & modern' },
];


export default QRPage;
