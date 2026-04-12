import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ICON_MAP = {
  star:"⭐", heart:"❤️", education:"🎓", work:"💼", wedding:"💍",
  travel:"✈️", award:"🏆", home:"🏠", music:"🎵", baby:"👶",
  flag:"🚩", gift:"🎁", camera:"📷", book:"📚", globe:"🌍",
};

// ── THEME CSS VARIABLES ──────────────────────────────────────
const THEME_VARS = {
  // ── Memorial themes ──
  'classic':     { bg:'#111118', hero:'linear-gradient(160deg,#0d0d14 0%,#1a1a2a 60%,#0d0d14 100%)', accent:'#C9A84C', accentLight:'#E8C97A', font:"'Lora',Georgia,serif", headFont:"'Playfair Display',serif" },
  'dark':        { bg:'#0a0a0a', hero:'linear-gradient(160deg,#050505 0%,#111 60%,#050505 100%)',     accent:'#888',     accentLight:'#aaa',     font:"'Lora',Georgia,serif", headFont:"'Playfair Display',serif" },
  'floral':      { bg:'#fdf6f0', hero:'linear-gradient(160deg,#f5e6d8 0%,#ede0d4 60%,#f5e6d8 100%)',  accent:'#c9726b', accentLight:'#e8938d',  font:"'Lora',Georgia,serif", headFont:"'Playfair Display',serif" },
  'traditional': { bg:'#1a1208', hero:'linear-gradient(160deg,#120d04 0%,#2a1e0a 60%,#120d04 100%)', accent:'#d4a849', accentLight:'#e8c97a',  font:"'Crimson Pro',serif",  headFont:"'Playfair Display',serif" },
  'minimal':     { bg:'#f8f8f8', hero:'linear-gradient(160deg,#f0f0f0 0%,#e8e8e8 60%,#f0f0f0 100%)', accent:'#222',     accentLight:'#555',     font:"'Inter',sans-serif",   headFont:"'Inter',sans-serif" },
  // ── Wedding themes ──
  'classic-romance': { bg:'#1a0a10', hero:'linear-gradient(160deg,#120608 0%,#2d1020 60%,#120608 100%)', accent:'#C9A84C', accentLight:'#E8C97A', font:"'Crimson Pro',serif", headFont:"'Playfair Display',serif" },
  'floral-garden':   { bg:'#fdf4f5', hero:'linear-gradient(160deg,#f8e8ea 0%,#f0d8dc 60%,#f8e8ea 100%)', accent:'#c9607a', accentLight:'#e8839a', font:"'Lora',Georgia,serif", headFont:"'Playfair Display',serif" },
  'minimalist':      { bg:'#ffffff', hero:'linear-gradient(160deg,#f5f5f5 0%,#e8e8e8 60%,#f5f5f5 100%)', accent:'#1a1a1a', accentLight:'#444',    font:"'Inter',sans-serif",  headFont:"'Inter',sans-serif" },
  'royal':           { bg:'#0a0d1a', hero:'linear-gradient(160deg,#060814 0%,#101828 60%,#060814 100%)', accent:'#C9A84C', accentLight:'#E8C97A', font:"'Crimson Pro',serif", headFont:"'Playfair Display',serif" },
  'retro-film':      { bg:'#1a150e', hero:'linear-gradient(160deg,#120e08 0%,#2a2018 60%,#120e08 100%)', accent:'#c4965a', accentLight:'#ddb87a', font:"'Lora',Georgia,serif", headFont:"'Playfair Display',serif" },
  'tropical':        { bg:'#071a1a', hero:'linear-gradient(160deg,#041212 0%,#0d2828 60%,#041212 100%)', accent:'#2ec9a0', accentLight:'#5ee8c4', font:"'Lora',Georgia,serif", headFont:"'Playfair Display',serif" },
};

function getThemeCss(theme, customConfig = {}) {
  const t = THEME_VARS[theme] || THEME_VARS['classic'];
  // Photographer custom overrides — merge over preset
  const cc = customConfig.customColors || {};
  const isLight = ['floral','minimal','floral-garden','minimalist'].includes(theme);
  const textColor    = isLight ? '#1a1a1a' : '#E8EAF0';
  const textColor2   = isLight ? 'rgba(26,26,26,0.7)'  : 'rgba(232,234,240,0.75)';
  const textColor3   = isLight ? 'rgba(26,26,26,0.45)' : 'rgba(232,234,240,0.4)';
  const borderColor  = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
  const cardBg       = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';
  // Apply custom overrides from photographer
  const finalBg     = cc.bg     || t.bg;
  const finalAccent = cc.accent || t.accent;
  const finalText   = cc.text   || textColor;
  const finalFont   = customConfig.fontFamily
    ? `'${customConfig.fontFamily}', Georgia, serif`
    : t.font;
  const finalHeadFont = customConfig.fontFamily
    ? `'${customConfig.fontFamily}', Georgia, serif`
    : t.headFont;

  return `
    :root {
      --gold: ${finalAccent}; --gold-light: ${cc.accent ? finalAccent + 'cc' : t.accentLight};
      --dark: ${finalBg}; --dark2: ${finalBg}; --dark3: ${finalBg};
      --text: ${finalText}; --text2: ${finalText}cc; --text3: ${finalText}66;
      --border-color: ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'}; --card-bg: ${cc.card || cardBg};
    }
    body { background: ${finalBg}; font-family: ${finalFont}; color: ${finalText}; }
    .hero { background: ${cc.bg ? finalBg : t.hero}; }
    .name { font-family: ${finalHeadFont}; }
    .section-title { font-family: ${finalHeadFont}; }
  `;
}

const CSS = `
  @import url(https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Lora:wght@400;500&family=Crimson+Pro:wght@300;400;500&family=Inter:wght@400;500&display=swap);
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --gold: #C9A84C; --gold-light: #E8C97A;
    --dark: #111118; --dark2: #1A1A28; --dark3: #242434;
    --text: #E8EAF0; --text2: rgba(232,234,240,0.75); --text3: rgba(232,234,240,0.4);
    --border-color: rgba(255,255,255,0.08); --card-bg: rgba(255,255,255,0.04);
  }
  html, body { height: 100%; overflow-x: hidden; }
  body { background: var(--dark); font-family: 'Lora', Georgia, serif; color: var(--text); min-height: 100svh; -webkit-overflow-scrolling: touch; }
  .page { min-height: 100svh; }
  .hero { min-height: 60svh; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 5rem 2rem 3rem; padding-top: max(5rem, env(safe-area-inset-top) + 3rem); text-align: center; position: relative; overflow: hidden; background: linear-gradient(160deg, #0d0d14 0%, #1a1a2a 60%, #0d0d14 100%); }
  .hero-cover-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.45; z-index: 0; }
  .hero-cover-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(13,13,20,0.3) 0%, rgba(13,13,20,0.75) 100%); z-index: 1; }
  .hero-accent { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(201,168,76,0.1), transparent); z-index: 2; pointer-events: none; }
  .hero-content { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; }
  .avatar { width: 130px; height: 130px; border-radius: 50%; border: 3px solid rgba(201,168,76,0.5); background: rgba(201,168,76,0.08); box-shadow: 0 0 0 6px rgba(201,168,76,0.08), 0 8px 32px rgba(0,0,0,0.5); overflow: hidden; display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; font-size: 3rem; color: var(--gold); margin-bottom: 1.4rem; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .name { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 6vw, 3.8rem); font-weight: 700; color: var(--text); line-height: 1.1; margin-bottom: 0.5rem; text-shadow: 0 2px 16px rgba(0,0,0,0.6); }
  .dates { font-size: 0.92rem; color: rgba(232,234,240,0.55); letter-spacing: 0.14em; font-family: 'Crimson Pro', serif; margin-bottom: 0.3rem; }
  .age-line { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(201,168,76,0.12); border: 1px solid rgba(201,168,76,0.25); color: var(--gold-light); font-family: 'Crimson Pro', serif; font-size: 0.8rem; letter-spacing: 0.1em; padding: 0.3rem 0.9rem; border-radius: 100px; margin-top: 0.5rem; }
  .body { max-width: 960px; margin: 0 auto; padding: 3rem 2rem 5rem; }
  .tabs { display: flex; gap: 0.2rem; background: rgba(255,255,255,0.04); border-radius: 100px; padding: 0.3rem; margin-bottom: 2.5rem; width: fit-content; flex-wrap: wrap; }
  .tab { padding: 0.55rem 1.25rem; border-radius: 100px; border: none; background: transparent; font-family: 'Lora', serif; font-size: 0.86rem; color: var(--text3); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .tab.active { background: var(--dark3); color: var(--text); box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
  .tab:hover:not(.active) { color: var(--text2); }
  .section-title { font-family: 'Playfair Display', serif; font-size: 1.25rem; color: var(--gold-light); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.6rem; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.15); }
  .bio-block { background: rgba(255,255,255,0.03); border: 1px solid rgba(201,168,76,0.1); border-radius: 20px; padding: 2rem 2.5rem; font-family: 'Crimson Pro', serif; font-size: 1.08rem; color: var(--text2); line-height: 1.85; }
  .bio-block p { margin-bottom: 0.8rem; }
  .bio-block strong, .bio-block b { color: var(--text); }
  .bio-empty { color: var(--text3); font-style: italic; font-family: 'Crimson Pro', serif; padding: 2rem 0; }
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
  .photo-grid.layout-masonry { columns: 3; gap: 0; display: block; }
  .photo-grid.layout-masonry > div { break-inside: avoid; margin-bottom: 0.75rem; }
  .photo-grid.layout-masonry > div .photo-item { aspect-ratio: unset; height: auto; }
  .photo-grid.layout-magazine { grid-template-columns: repeat(3,1fr); }
  .photo-grid.layout-magazine > div:first-child { grid-column: 1/-1; }
  .photo-grid.layout-magazine > div:first-child .photo-item { aspect-ratio: 16/9; }
  .photo-grid.layout-slideshow { grid-template-columns: 1fr; max-width: 600px; margin: 0 auto; }
  .photo-grid.layout-slideshow > div:not(:first-child) { display: none; }
  .photo-grid.layout-slideshow .photo-item { aspect-ratio: 4/3; }
  .photo-item { aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.04); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border: none; padding: 0; }
  .photo-item:hover { transform: scale(1.03); box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .photo-item img { width: 100%; height: 100%; object-fit: cover; }
  .photo-caption { font-size: 0.74rem; color: var(--text3); font-family: 'Crimson Pro', serif; padding: 0.4rem 0.5rem; text-align: center; }
  .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.96); z-index: 1000; display: flex; align-items: center; justify-content: center; }
  .lightbox-img { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 8px; }
  .lb-close { position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; width: 44px; height: 44px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .lb-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; width: 52px; height: 52px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .lb-prev { left: 1.5rem; } .lb-next { right: 1.5rem; }
  .lb-counter { position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%); color: var(--text3); font-family: 'Crimson Pro', serif; font-size: 0.82rem; letter-spacing: 0.1em; }
  .lb-caption { position: absolute; bottom: 3.5rem; width: 100%; text-align: center; color: var(--text2); font-family: 'Crimson Pro', serif; font-size: 0.9rem; padding: 0 5rem; }
  .tributes { display: flex; flex-direction: column; gap: 1rem; }
  .tribute { background: rgba(255,255,255,0.04); border: 1px solid rgba(201,168,76,0.12); border-radius: 16px; padding: 1.5rem; }
  .tribute-text { font-size: 1rem; color: var(--text2); line-height: 1.8; font-family: 'Crimson Pro', serif; font-style: italic; margin-bottom: 0.6rem; }
  .tribute-from { font-size: 0.8rem; color: var(--gold-light); font-family: 'Lora', serif; letter-spacing: 0.04em; }
  .audio-list { display: flex; flex-direction: column; gap: 0; }
  audio { accent-color: var(--gold, #C9A84C); }
  audio::-webkit-media-controls-panel { background: rgba(255,255,255,0.06); }
  .audio-item { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 1rem 1.2rem; display: flex; align-items: center; gap: 1rem; transition: border-color 0.2s; }
  .audio-item.playing { border-color: rgba(201,168,76,0.35); background: rgba(201,168,76,0.05); }
  .play-btn { width: 42px; height: 42px; border-radius: 50%; background: var(--gold); border: none; cursor: pointer; font-size: 0.9rem; color: #111; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .play-btn:hover { background: var(--gold-light); }
  .audio-name { font-size: 0.9rem; color: var(--text); font-family: 'Lora', serif; flex: 1; }
  .audio-duration { font-size: 0.78rem; color: var(--text3); font-family: 'Crimson Pro', serif; }
  .timeline { position: relative; padding-left: 2rem; }
  .timeline::before { content: ''; position: absolute; left: 0.55rem; top: 0.5rem; width: 2px; bottom: 0.5rem; background: linear-gradient(to bottom, rgba(201,168,76,0.5), rgba(201,168,76,0.05)); }
  .timeline-item { position: relative; margin-bottom: 2rem; }
  .timeline-dot { position: absolute; left: -1.65rem; top: 0.2rem; width: 22px; height: 22px; border-radius: 50%; background: var(--dark2); border: 2px solid rgba(201,168,76,0.5); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; z-index: 1; }
  .timeline-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(201,168,76,0.1); border-radius: 14px; padding: 1.2rem 1.5rem; transition: border-color 0.2s; }
  .timeline-card:hover { border-color: rgba(201,168,76,0.25); }
  .timeline-date { font-size: 0.75rem; color: var(--gold); font-family: 'Crimson Pro', serif; letter-spacing: 0.1em; margin-bottom: 0.4rem; }
  .timeline-title { font-family: 'Playfair Display', serif; font-size: 1.05rem; color: var(--text); margin-bottom: 0.4rem; }
  .timeline-desc { font-family: 'Crimson Pro', serif; font-size: 0.95rem; color: var(--text2); line-height: 1.7; }
  @media (max-width: 640px) {
    .hero { min-height: 70svh; padding: 6rem 1.25rem 2.5rem; }
    .body { padding: 2rem 1.25rem 4rem; }
    .name { font-size: clamp(1.8rem, 8vw, 3rem); }
    .tabs { overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; gap: 0.1rem; }
    .tabs::-webkit-scrollbar { display: none; }
    .tab { padding: 0.45rem 0.9rem; font-size: 0.8rem; white-space: nowrap; }
    .photo-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .bio-block { padding: 1.25rem; font-size: 0.98rem; }
  }
  .page-footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 3rem; }
  .footer-logo { font-family: 'Playfair Display', serif; color: var(--text3); font-size: 0.9rem; }
  .footer-logo span { color: var(--gold); opacity: 0.7; }
  .footer-cta { margin-top: 1rem; }
  .footer-cta a { color: var(--text3); font-size: 0.82rem; font-family: 'Crimson Pro', serif; text-decoration: none; border: 1px solid rgba(255,255,255,0.08); padding: 0.5rem 1.2rem; border-radius: 100px; }
  .footer-cta a:hover { color: var(--gold); border-color: rgba(201,168,76,0.3); }
  .center { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem; }
  .spinner { width: 40px; height: 40px; border-radius: 50%; border: 3px solid rgba(201,168,76,0.2); border-top-color: var(--gold); animation: spin 0.8s linear infinite; margin: 0 auto 1.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-msg { color: var(--text3); font-style: italic; font-family: 'Crimson Pro', serif; padding: 1.5rem 0; font-size: 0.95rem; }
`;

// ── MINI CHAT BUBBLE FOR PUBLIC ALBUM VISITORS ───────────────
const PUB_CHAT_API = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in') + '/api/chat';


// ── PUBLIC TRIBUTE / WISH WIDGET ─────────────────────────────
function TributeWidget({ albumSlug, albumType, allowContributions }) {
  const [open,    setOpen]    = useState(false);
  const [name,    setName]    = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  const isWedding = albumType === 'wedding';

  if (!allowContributions) return null;

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true); setError('');
    try {
      const res = await fetch(`${API}/api/public/album/${albumSlug}/wishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: name.trim() || 'Anonymous', message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} title={isWedding ? 'Leave a Wish' : 'Leave a Tribute'}
          style={{ position:'fixed', bottom:'1.5rem', right:'1.5rem', zIndex:1000,
            width:54, height:54, borderRadius:'50%', background:'var(--gold,#C9A84C)',
            color:'#111', border:'none', cursor:'pointer', fontSize:'1.4rem',
            boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          ✍
        </button>
      )}
      {open && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:1001,
          background:'#1A1A28', border:'1px solid rgba(201,168,76,0.18)',
          borderBottom:'none', borderRadius:'20px 20px 0 0',
          padding:'1.5rem 1.5rem 2rem', boxShadow:'0 -8px 40px rgba(0,0,0,0.5)',
          maxWidth:520, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.05rem', fontWeight:700, color:'#E8C97A' }}>
              {isWedding ? '💌 Leave a Wish' : '✍ Leave a Tribute'}
            </div>
            <button onClick={() => { setOpen(false); setSent(false); setError(''); }}
              style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(232,234,240,0.4)', fontSize:'1.2rem' }}>
              ✕
            </button>
          </div>
          {sent ? (
            <div style={{ textAlign:'center', padding:'1.5rem 0' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.5rem' }}>{isWedding ? '💌' : '🕯'}</div>
              <div style={{ fontFamily:"'Crimson Pro',serif", fontSize:'1.05rem', color:'#E8C97A' }}>
                {isWedding ? 'Your wish has been shared!' : 'Your tribute has been added.'}
              </div>
            </div>
          ) : (
            <>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name (optional)"
                style={{ width:'100%', background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
                  padding:'0.6rem 0.9rem', color:'rgba(250,247,242,0.85)',
                  fontSize:'0.88rem', outline:'none', marginBottom:'0.5rem', fontFamily:'inherit' }} />
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder={isWedding ? 'Wishing you both a lifetime of love…' : 'Share a memory or words of love…'}
                rows={4}
                style={{ width:'100%', background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
                  padding:'0.6rem 0.9rem', color:'rgba(250,247,242,0.85)',
                  fontSize:'0.9rem', outline:'none', resize:'none', marginBottom:'0.75rem',
                  fontFamily:"'Crimson Pro',Georgia,serif" }} />
              {error && <div style={{ color:'#fca5a5', fontSize:'0.82rem', marginBottom:'0.5rem' }}>{error}</div>}
              <button onClick={submit} disabled={sending || !message.trim()}
                style={{ width:'100%', background:'#C9A84C', color:'#111', border:'none',
                  borderRadius:10, padding:'0.8rem', fontWeight:700, fontSize:'0.92rem',
                  cursor:'pointer', opacity:(sending || !message.trim()) ? 0.5 : 1 }}>
                {sending ? 'Sending…' : isWedding ? '💌 Send Wish' : '✍ Post Tribute'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function AlbumPublicPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [album, setAlbum]           = useState(null);
  const [media, setMedia]           = useState({});
  const [lifeEvents, setLifeEvents] = useState([]);
  const [guestWishes, setGuestWishes] = useState([]);
  const [wishName,    setWishName]    = useState('');
  const [wishMsg,     setWishMsg]     = useState('');
  const [wishSubmitting, setWishSubmitting] = useState(false);
  const [wishSent,    setWishSent]    = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [tab, setTab]               = useState("biography");
  const [lightbox, setLightbox]     = useState(null);
  const [playingId, setPlayingId]   = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/public/album/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setAlbum(d.album);
        setMedia(d.media || {});
        setLifeEvents(d.lifeEvents || []);
        const fetchedWishes = d.guestWishes || [];
    setGuestWishes(fetchedWishes);
    // For memorial albums: merge public tributes into the tributes tab
    if (d.album?.type !== 'wedding' && (d.album?.allow_public_tributes || d.album?.allowPublicTributes)) {
      const publicTributes = fetchedWishes
        .filter(w => (w.tribute_type || 'tribute') === 'tribute')
        .map(w => ({ id: w.id, tribute_text: w.message, tribute_from: w.guest_name }));
      setMedia(prev => ({ ...prev, tributes: [...(prev.tributes || []), ...publicTributes] }));
    }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!lightbox) return;
    const h = (e) => {
      if (e.key === "ArrowLeft")  setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.items.length) % lb.items.length }));
      if (e.key === "ArrowRight") setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.items.length }));
      if (e.key === "Escape")     setLightbox(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox]);

  // Audio playback handled by native <audio> elements — no JS Audio() needed

  useEffect(() => {
    // Audio elements handle their own state — no manual pause needed
  }, [tab]);

  const fmtDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  };

  const fmtEventDate = (d, y) => {
    if (d) {
      // Parse date parts directly to avoid UTC→IST timezone shift
      const parts = String(d).substring(0, 10).split("-");
      if (parts.length === 3) {
        const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
      }
    }
    if (y) return String(y);
    return null;
  };

  const calcAge = (bd, dd) => {
    if (!bd || !dd) return null;
    const birth = new Date(bd), death = new Date(dd);
    let age = death.getFullYear() - birth.getFullYear();
    const m = death.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && death.getDate() < birth.getDate())) age--;
    return age > 0 ? age : null;
  };

  if (loading) return (
    <><style>{CSS}</style>
      <div className="center">
        <div><div className="spinner" /><div style={{color:"var(--text3)",fontFamily:"'Crimson Pro',serif"}}>Loading memorial…</div></div>
      </div>
    </>
  );

  if (error || !album) return (
    <><style>{CSS}</style>
      <div className="center">
        <div>
          <div style={{fontSize:"3rem",marginBottom:"1rem"}}>✦</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.8rem",color:"var(--text)",marginBottom:"0.5rem"}}>Album Not Found</div>
          <div style={{color:"var(--text3)",fontFamily:"'Crimson Pro',serif",marginBottom:"2rem"}}>{error || "This memorial may be unpublished or the link has expired."}</div>
          <a style={{background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.3)",color:"var(--gold)",padding:"0.7rem 1.5rem",borderRadius:"100px",fontFamily:"'Lora',serif",fontSize:"0.9rem",textDecoration:"none"}} href="/">Create a Memorial →</a>
        </div>
      </div>
    </>
  );

  const photos    = (media.photos  || []).filter(m => m.url);
  const videos    = (media.videos  || []).filter(m => m.url);
  const audio     = media.audio    || [];
  const tributes  = media.tributes || [];
  const allVisual = [...photos, ...videos];

  // Conditional tabs
  const showMusicTab   = audio.length > 0;
  const showEventsTab  = lifeEvents.length > 0;
  const isWedding      = album.type === 'wedding';
  const showWishesTab  = isWedding || Boolean(album?.allowPublicTributes || album?.allow_public_tributes);
  const showWishesForm = isWedding || Boolean(album?.allowPublicTributes || album?.allow_public_tributes);
  const tributeLabel   = isWedding ? 'Leave a Wish' : 'Leave a Tribute';
  // Grace period: album is accessible but subscription is ending
  const inGrace = album.gracePeriodUntil && new Date(album.gracePeriodUntil) > new Date();

  const bd  = album.birthDate || (album.birthYear && `${album.birthYear}-01-01`);
  const dd  = album.deathDate || (album.deathYear && `${album.deathYear}-01-01`);
  const age = calcAge(bd, dd);

  // Wedding submit wish
  const submitWish = async (e) => {
    e.preventDefault();
    if (!wishMsg.trim()) return;
    setWishSubmitting(true);
    try {
      await fetch(`${API}/api/public/album/${album.slug}/wishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: wishName, message: wishMsg }),
      });
      setWishSent(true);
      setWishName(''); setWishMsg('');
    } catch (_) { alert('Failed to submit. Please try again.'); }
    finally { setWishSubmitting(false); }
  };

  const lbPrev = (e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.items.length) % lb.items.length })); };
  const lbNext = (e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.items.length })); };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>{isWedding
          ? `${album.partner1Name || album.name} & ${album.partner2Name || ''} — Wedding`
          : `${album.name} — Memorial`}</title>
        <meta name="description" content={isWedding
          ? `Wedding album of ${album.partner1Name || album.name} & ${album.partner2Name || ''}`
          : `A memorial tribute to ${album.name}`} />
        {album.avatarUrl && <meta property="og:image" content={album.avatarUrl} />}
      </Head>
      <style>{CSS}</style>
      <style>{getThemeCss(album.theme || 'classic', album.customConfig || {})}</style>
      <div className="page">

        <div className="hero">
          {album.coverUrl && <div className="hero-cover-bg" style={{ backgroundImage: `url(${album.coverUrl})` }} />}
          <div className="hero-cover-gradient" />
          <div className="hero-accent" />
          <div className="hero-content">
            <div className="avatar">
              {album.avatarUrl ? <img src={album.avatarUrl} alt={album.name} /> : (isWedding ? "💍" : (album.name?.[0] || "✦"))}
            </div>
            <h1 className="name">
              {isWedding && album.partner1Name && album.partner2Name
                ? `${album.partner1Name} & ${album.partner2Name}`
                : album.name}
            </h1>
            {isWedding ? (
              <>
                {album.weddingDate && (
                  <div className="dates">✦ &nbsp;{fmtDate(album.weddingDate)}&nbsp; ✦</div>
                )}
                {album.venueName && (
                  <div className="age-line" style={{opacity:0.7}}>📍 {album.venueName}</div>
                )}
                {album.albumLabel && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:'0.4rem',
                    background:'rgba(201,168,76,0.15)',border:'1px solid rgba(201,168,76,0.3)',
                    color:'#E8C97A',padding:'0.25rem 0.85rem',borderRadius:100,
                    fontSize:'0.75rem',letterSpacing:'0.1em',textTransform:'uppercase',marginTop:'0.4rem'}}>
                    {album.albumLabel.replace('-',' ')}
                  </div>
                )}
              </>
            ) : (
              <>
                {(bd || dd) && album.customConfig?.showDates !== false && (
                  <div className="dates">✦&nbsp;{fmtDate(bd) || album.birthYear || "?"}&nbsp;—&nbsp;{fmtDate(dd) || album.deathYear || "?"}&nbsp;✦</div>
                )}
                {age !== null && <div className="age-line">✦ &nbsp;Lived {age} years</div>}
              </>
            )}
          </div>
        </div>

        {inGrace && (
          <div style={{
            background:"rgba(234,179,8,0.12)", border:"1px solid rgba(234,179,8,0.3)",
            color:"#fbbf24", textAlign:"center", padding:"0.6rem 1rem", fontSize:"0.78rem",
            fontFamily:"'Crimson Pro',serif", letterSpacing:"0.02em"
          }}>
            ⚠ This album will go offline on {new Date(album.gracePeriodUntil).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}. The owner's subscription has ended.
          </div>
        )}

        <div className="body">
          <div className="tabs">
            <button className={`tab ${tab==="biography"?"active":""}`} onClick={() => setTab("biography")}>
              {isWedding ? "💑 Our Story" : "📖 Biography"}
            </button>
            <button className={`tab ${tab==="photos"?"active":""}`} onClick={() => setTab("photos")}>
              📷 Photos{allVisual.length>0?` (${allVisual.length})`:""}
            </button>
            {!isWedding && (
              <button className={`tab ${tab==="tributes"?"active":""}`} onClick={() => setTab("tributes")}>
                ✍️ Tributes{tributes.length>0?` (${tributes.length})`:""}
              </button>
            )}
            {showEventsTab && (
              <button className={`tab ${tab==="events"?"active":""}`} onClick={() => setTab("events")}>
                {isWedding ? "💒 Our Day" : "⏳ Life Events"} ({lifeEvents.length})
              </button>
            )}
            {isWedding && (
              <button className={`tab ${tab==="wishes"?"active":""}`} onClick={() => setTab("wishes")}>
                💌 Wishes {guestWishes.length > 0 ? `(${guestWishes.length})` : ""}
              </button>
            )}
            {showMusicTab && (
              <button className={`tab ${tab==="music"?"active":""}`} onClick={() => setTab("music")}>
                🎵 Music ({audio.length})
              </button>
            )}
          </div>

          {/* ── BIOGRAPHY / LOVE STORY ── */}
          {tab === "biography" && album.customConfig?.showBio !== false && (
            <>
              <div className="section-title">{isWedding ? "Our Love Story" : "Life & Legacy"}</div>
              {album.biography
                ? <div className="bio-block" dangerouslySetInnerHTML={{ __html: album.biography }} />
                : <p className="bio-empty">{isWedding ? "No love story added yet." : "No biography has been added yet."}</p>}
            </>
          )}

          {/* ── PHOTOS ── */}
          {tab === "photos" && (
            <>
              <div className="section-title">{isWedding ? "Our Memories" : "Memories"}</div>
              {allVisual.length === 0
                ? <p className="empty-msg">No photos or videos added yet.</p>
                : <div className={`photo-grid layout-${(album.customConfig?.layout) || 'grid'}`}>
                    {allVisual.map((m, idx) => {
                      const isVid = m.type === 'video' || m.mime_type?.startsWith('video/');
                      return (
                        <div key={m.id}>
                          <button
                            className="photo-item"
                            onClick={() => setLightbox({ items: allVisual, index: idx })}
                            aria-label={isVid ? `Play video: ${m.file_name || 'Video'}` : `View photo: ${m.caption || m.file_name || 'Memory'}`}
                            style={{ position: 'relative' }}
                          >
                            {isVid ? (
                              <>
                                {/* Video thumbnail — browser renders first frame */}
                                <video
                                  src={m.url}
                                  preload="metadata"
                                  muted
                                  playsInline
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                                />
                                {/* Play icon overlay */}
                                <span style={{
                                  position: 'absolute', inset: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(0,0,0,0.28)',
                                }}>
                                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
                                    <circle cx="21" cy="21" r="20" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
                                    <polygon points="17,13 32,21 17,29" fill="white"/>
                                  </svg>
                                </span>
                              </>
                            ) : (
                              <img src={m.url} alt={m.caption || m.file_name || 'Memory'} />
                            )}
                          </button>
                          {m.caption && <div className="photo-caption">{m.caption}</div>}
                        </div>
                      );
                    })}
                  </div>}
            </>
          )}

          {/* ── TRIBUTES (memorial only) ── */}
          {tab === "tributes" && !isWedding && (
            <>
              <div className="section-title">Words of Love</div>
              {tributes.length === 0
                ? <p className="empty-msg">No tributes added yet.</p>
                : <div className="tributes">
                    {tributes.map(t => (
                      <div key={t.id} className="tribute">
                        <div className="tribute-text">"{t.tribute_text}"</div>
                        {t.tribute_from && <div className="tribute-from">— {t.tribute_from}</div>}
                      </div>
                    ))}
                  </div>}
            </>
          )}

          {/* ── TIMELINE / WEDDING DAY ── */}
          {tab === "events" && showEventsTab && (
            <>
              <div className="section-title">{isWedding ? "Wedding Day Timeline" : "Life Journey"}</div>
              <div className="timeline">
                {lifeEvents.map(ev => {
                  const dateStr = fmtEventDate(ev.event_date, ev.event_year);
                  const icon    = ICON_MAP[ev.icon] || "⭐";
                  return (
                    <div key={ev.id} className="timeline-item">
                      <div className="timeline-dot">{icon}</div>
                      <div className="timeline-card">
                        {dateStr && <div className="timeline-date">{dateStr}</div>}
                        <div className="timeline-title">{ev.title}</div>
                        {ev.description && <div className="timeline-desc">{ev.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── GUEST WISHES (wedding only) ── */}
          {tab === "wishes" && isWedding && (
            <>
              {guestWishes.length > 0 && (
                <>
                  <div className="section-title">Wishes from Our Guests</div>
                  <div className="tributes" style={{marginBottom:"2rem"}}>
                    {guestWishes.map(w => (
                      <div key={w.id} className="tribute">
                        <div className="tribute-text">"{w.message}"</div>
                        {w.guest_name && <div className="tribute-from">— {w.guest_name}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="section-title">Leave a Wish</div>
              {wishSent ? (
                <div style={{textAlign:"center",padding:"2rem",background:"rgba(201,168,76,0.08)",borderRadius:16,border:"1px solid rgba(201,168,76,0.2)"}}>
                  <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>💌</div>
                  <div style={{color:"var(--gold-light)",fontFamily:"'Crimson Pro',serif",fontSize:"1.05rem"}}>
                    Your wish has been sent and is awaiting approval.
                  </div>
                  <div style={{color:"rgba(250,247,242,0.4)",fontSize:"0.82rem",marginTop:"0.4rem",fontFamily:"'Crimson Pro',serif"}}>
                    Thank you for celebrating with us!
                  </div>
                </div>
              ) : (
                <form onSubmit={submitWish} style={{display:"flex",flexDirection:"column",gap:"0.85rem",maxWidth:520}}>
                  <div>
                    <label style={{display:"block",fontSize:"0.78rem",color:"rgba(250,247,242,0.45)",marginBottom:"0.35rem",letterSpacing:"0.06em"}}>Your Name (optional)</label>
                    <input value={wishName} onChange={e => setWishName(e.target.value)}
                      placeholder="e.g. Sarah & Tom"
                      style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"0.65rem 0.9rem",color:"rgba(250,247,242,0.85)",fontSize:"0.9rem",outline:"none"}} />
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:"0.78rem",color:"rgba(250,247,242,0.45)",marginBottom:"0.35rem",letterSpacing:"0.06em"}}>Your Wish *</label>
                    <textarea value={wishMsg} onChange={e => setWishMsg(e.target.value)} required
                      placeholder="Wishing you both a lifetime of love and happiness…"
                      rows={4}
                      style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"0.65rem 0.9rem",color:"rgba(250,247,242,0.85)",fontSize:"0.9rem",outline:"none",resize:"vertical",fontFamily:"'Crimson Pro',serif"}} />
                  </div>
                  <button type="submit" disabled={wishSubmitting || !wishMsg.trim()}
                    style={{background:"var(--gold)",color:"#2C2A28",border:"none",borderRadius:10,padding:"0.8rem 1.5rem",fontWeight:600,fontSize:"0.92rem",cursor:"pointer",opacity:wishSubmitting?0.6:1,alignSelf:"flex-start"}}>
                    {wishSubmitting ? "Sending…" : isWedding ? "💌 Send Wish" : "✍ Post Tribute"}
                  </button>
                </form>
              )}
            </>
          )}

          {/* ── MUSIC ── */}
          {tab === "music" && showMusicTab && (
            <>
              <div className="section-title">{isWedding ? "Wedding Music" : "Voices & Recordings"}</div>
              <div className="audio-list">
                {audio.map(a => (
                  <div key={a.id} className="audio-item" style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '1rem 1.25rem',
                    marginBottom: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🎵</span>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.1rem' }}>
                          {a.file_name || 'Recording'}
                        </div>
                        {a.duration_sec > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                            {Math.floor(a.duration_sec / 60)}:{String(a.duration_sec % 60).padStart(2, '0')}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Native <audio> element — works on all devices, respects CORS, iOS-safe */}
                    <audio
                      controls
                      preload="none"
                      controlsList="nodownload"
                      crossOrigin="anonymous"
                      style={{
                        width: '100%',
                        height: 36,
                        borderRadius: 8,
                        outline: 'none',
                        accentColor: 'var(--gold)',
                      }}
                    >
                      <source src={a.url} type={a.mime_type || 'audio/mpeg'} />
                      {/* Fallback for unsupported MIME */}
                      <source src={a.url} />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ))}
              </div>
            </>
          )}

          {album.studioName && (
            <div style={{textAlign:'center',padding:'0.5rem',fontSize:'0.7rem',
              color:'var(--text3)',letterSpacing:'0.06em'}}>
              Album by {album.studioName} · <a href="/" style={{color:'var(--gold)',textDecoration:'none'}}>
                Hriatrengna
              </a>
            </div>
          )}
          <div className="page-footer">
            <div className="footer-logo">Hriatrengna</div>
            <div className="footer-cta">
              <a href="/">{isWedding ? "Create your own wedding album →" : "Create your own memorial album →"}</a>
            </div>
          </div>

          {/* Public tribute / wish widget — toggle per album in Settings → Security */}
          <TributeWidget
            albumSlug={slug}
            albumType={album?.type}
            allowContributions={album?.allowPublicTributes || album?.allowPublicWishes || album?.allow_public_tributes || album?.allow_public_wishes}
          />
        </div>

        {lightbox && (
          <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
            <button className="lb-close" onClick={() => setLightbox(null)}>✕</button>
            {lightbox.items.length > 1 && <button className="lb-nav lb-prev" onClick={lbPrev}>‹</button>}
            {(() => {
              const item = lightbox.items[lightbox.index];
              const isVid = item?.type === 'video' || item?.mime_type?.startsWith('video/');
              return isVid ? (
                <video
                  key={item.url}
                  src={item.url}
                  controls
                  autoPlay
                  playsInline
                  controlsList="nodownload"
                  style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, outline: 'none', background: '#000' }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <img className="lightbox-img" src={item?.url} alt={item?.caption || ''} onClick={e => e.stopPropagation()} />
              );
            })()}
            {lightbox.items.length > 1 && <button className="lb-nav lb-next" onClick={lbNext}>›</button>}
            {lightbox.items[lightbox.index]?.caption && <div className="lb-caption">{lightbox.items[lightbox.index].caption}</div>}
            {lightbox.items.length > 1 && <div className="lb-counter">{lightbox.index+1} / {lightbox.items.length}</div>}
          </div>
        )}
      </div>
    </>
  );
}
