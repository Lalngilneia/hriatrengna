/**
 * components/shared/SocialShare.jsx
 *
 * Social share widget for public album pages (memorial & wedding).
 *
 * Platforms:
 *  - WhatsApp (primary — most used in India)
 *  - Facebook
 *  - Twitter / X
 *  - Copy link
 *  - Native Share API (mobile — Chrome, Safari iOS 12+)
 *
 * No external SDK or tracking scripts. All links use platform
 * intent/sharer URLs which work without authentication.
 *
 * Usage:
 *   <SocialShare
 *     url="https://hriatrengna.in/album/sample-memorial"
 *     title="In loving memory of Lianpuia Ralte"
 *     description="A life well lived — 1942 to 2023"
 *     coverUrl="https://cdn.hriatrengna.in/albums/..."
 *     type="memorial"   // "memorial" | "wedding"
 *   />
 */

import { useState, useCallback } from 'react';

// ── Platform configs ──────────────────────────────────────────────────────────
const platforms = (url, text) => [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    color: '#25D366',
    href: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    color: '#1877F2',
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: '#000000',
    href: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function SocialShare({ url, title, description, coverUrl, type = 'memorial' }) {
  const [copied, setCopied]     = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const shareText = description ? `${title} — ${description}` : title;
  const accentColor = type === 'wedding' ? '#C9A84C' : '#C9A84C';
  const emoji = type === 'wedding' ? '💍' : '🕯';

  // Native Web Share API (works on mobile Chrome + Safari iOS 12+)
  const nativeShare = useCallback(async () => {
    if (!navigator.share) return false;
    try {
      await navigator.share({ title, text: shareText, url });
      return true;
    } catch {
      return false; // user cancelled or not supported
    }
  }, [title, shareText, url]);

  const handleShareBtn = useCallback(async () => {
    // Try native first on mobile
    if (/Mobi|Android/i.test(navigator?.userAgent)) {
      const shared = await nativeShare();
      if (shared) return;
    }
    setShowPanel(v => !v);
  }, [nativeShare]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    setShowPanel(false);
  }, [url]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid rgba(201,168,76,0.2)`,
    borderRadius: 100,
    padding: '0.5rem 1.1rem',
    color: '#E8EAF0',
    fontSize: '0.82rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  };

  const panelStyle = {
    position: 'absolute',
    bottom: '110%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1A1A28',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: '1rem',
    minWidth: 220,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 100,
    animation: 'shareSlideUp 0.18s ease',
  };

  const platformBtnStyle = (color) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#E8EAF0',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    transition: 'background 0.15s',
    textAlign: 'left',
  });

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <style>{`
        @keyframes shareSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
        }
        .share-platform-btn:hover { background: rgba(255,255,255,0.06) !important; }
        .share-main-btn:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(201,168,76,0.4) !important; }
      `}</style>

      {/* Main share button */}
      <button
        className="share-main-btn"
        onClick={handleShareBtn}
        style={btnStyle}
        aria-label="Share this album"
        aria-expanded={showPanel}
        aria-haspopup="true"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Share {emoji}
      </button>

      {/* Share panel */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowPanel(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            aria-hidden="true"
          />
          <div style={panelStyle} role="dialog" aria-label="Share options">
            <div style={{ fontSize: '0.72rem', color: 'rgba(232,234,240,0.4)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem',
              paddingLeft: '0.75rem' }}>
              Share this album
            </div>

            {/* Platform buttons */}
            {platforms(url, shareText).map(p => (
              <a
                key={p.id}
                className="share-platform-btn"
                href={p.href(url, shareText)}
                target="_blank"
                rel="noopener noreferrer"
                style={platformBtnStyle(p.color)}
                onClick={() => setShowPanel(false)}
                aria-label={`Share on ${p.label}`}
              >
                <span style={{ color: p.color, display: 'flex', flexShrink: 0 }}>
                  {p.icon}
                </span>
                {p.label}
              </a>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)',
              margin: '0.5rem 0' }} />

            {/* Copy link */}
            <button
              className="share-platform-btn"
              onClick={copyLink}
              style={{ ...platformBtnStyle('#888'), width: '100%' }}
              aria-live="polite"
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
