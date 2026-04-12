/**
 * components/album/PublicView.jsx
 * Subscriber's own preview of their memorial album (in-app).
 * NOT the same as pages/album/[slug].jsx (fully public, no auth).
 */

import { useState, useEffect } from 'react';
import { renderEventIcon } from '../../lib/constants';

function PublicView({ currentAlbum, setPage }) {
  const [album,      setAlbum]      = useState(null);
  const [media,      setMedia]      = useState({});
  const [lifeEvents, setLifeEvents] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [tab,        setTab]        = useState("biography");
  const [lightbox,   setLightbox]   = useState(null);
  const [playingId,  setPlayingId]  = useState(null);
  const audioRef = { current: null };

  useEffect(() => {
    const slug = currentAlbum?.slug || "demo";
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/public/album/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setAlbum({ ...d.album, guestWishes: d.guestWishes || [] });
        setMedia(d.media || {});
        setLifeEvents(d.lifeEvents || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentAlbum]);

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

  const playAudio = (track) => {
    if (!track.url) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playingId === track.id) { setPlayingId(null); return; }
    const a = new Audio(track.url);
    a.play().catch(() => {});
    a.onended = () => setPlayingId(null);
    audioRef.current = a;
    setPlayingId(track.id);
  };

  const fmtDate = (d) => {
    if (!d) return null;
    const parts = String(d).substring(0, 10).split("-");
    if (parts.length === 3) {
      const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    }
    return null;
  };

  const fmtEventDate = (d, y) => {
    if (d) {
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
    if (death.getMonth() - birth.getMonth() < 0 || (death.getMonth() === birth.getMonth() && death.getDate() < birth.getDate())) age--;
    return age > 0 ? age : null;
  };

  const PV_CSS = `
    @import url(https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Lora:wght@400;500&family=Crimson+Pro:wght@300;400;500&display=swap);
    .pv-wrap { min-height:100svh; background:#111118; overflow-x:hidden; font-family:'Lora',Georgia,serif; color:#E8EAF0; }
    .pv-back { position:fixed; top:1rem; left:1rem; z-index:200; background:rgba(17,17,24,0.85); border:1px solid rgba(255,255,255,0.1); color:rgba(232,234,240,0.6); border-radius:100px; padding:0.45rem 1rem; font-size:0.8rem; cursor:pointer; backdrop-filter:blur(8px); }
    .pv-back:hover { color:#C9A84C; border-color:rgba(201,168,76,0.4); }
    .pv-hero { min-height:55svh; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding:5rem 2rem 3rem; text-align:center; position:relative; overflow:hidden; background:linear-gradient(160deg,#0d0d14 0%,#1a1a2a 60%,#0d0d14 100%); }
    .pv-cover-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:0.45; z-index:0; }
    .pv-cover-grad { position:absolute; inset:0; background:linear-gradient(to bottom,rgba(13,13,20,0.3) 0%,rgba(13,13,20,0.75) 100%); z-index:1; }
    .pv-accent { position:absolute; inset:0; background:radial-gradient(ellipse 60% 40% at 50% 100%,rgba(201,168,76,0.1),transparent); z-index:2; pointer-events:none; }
    .pv-hero-content { position:relative; z-index:3; display:flex; flex-direction:column; align-items:center; }
    .pv-avatar { width:120px; height:120px; border-radius:50%; border:3px solid rgba(201,168,76,0.5); background:rgba(201,168,76,0.08); box-shadow:0 0 0 6px rgba(201,168,76,0.08),0 8px 32px rgba(0,0,0,0.5); overflow:hidden; display:flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; font-size:3rem; color:#C9A84C; margin-bottom:1.2rem; }
    .pv-avatar img { width:100%; height:100%; object-fit:cover; }
    .pv-name { font-family:'Playfair Display',serif; font-size:clamp(1.8rem,5vw,3.4rem); font-weight:700; color:#E8EAF0; line-height:1.1; margin-bottom:0.4rem; text-shadow:0 2px 16px rgba(0,0,0,0.6); }
    .pv-dates { font-size:0.88rem; color:rgba(232,234,240,0.5); letter-spacing:0.14em; font-family:'Crimson Pro',serif; }
    .pv-age { display:inline-flex; align-items:center; gap:0.4rem; background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.25); color:#E8C97A; font-family:'Crimson Pro',serif; font-size:0.78rem; letter-spacing:0.1em; padding:0.3rem 0.9rem; border-radius:100px; margin-top:0.5rem; }
    .pv-body { max-width:920px; margin:0 auto; padding:2.5rem 1.5rem 5rem; }
    .pv-tabs { display:flex; gap:0.2rem; background:rgba(255,255,255,0.04); border-radius:100px; padding:0.3rem; margin-bottom:2.5rem; width:fit-content; flex-wrap:wrap; }
    .pv-tab { padding:0.5rem 1.1rem; border-radius:100px; border:none; background:transparent; font-family:'Lora',serif; font-size:0.83rem; color:rgba(232,234,240,0.38); cursor:pointer; transition:all 0.2s; white-space:nowrap; }
    .pv-tab.active { background:#242434; color:#E8EAF0; box-shadow:0 2px 10px rgba(0,0,0,0.4); }
    .pv-section-title { font-family:'Playfair Display',serif; font-size:1.2rem; color:#E8C97A; margin-bottom:1.4rem; display:flex; align-items:center; gap:0.6rem; }
    .pv-section-title::after { content:''; flex:1; height:1px; background:rgba(201,168,76,0.15); }
    .pv-bio { background:rgba(255,255,255,0.03); border:1px solid rgba(201,168,76,0.1); border-radius:18px; padding:1.8rem 2rem; font-family:'Crimson Pro',serif; font-size:1.05rem; color:rgba(232,234,240,0.75); line-height:1.85; }
    .pv-bio p { margin-bottom:0.8rem; }
    .pv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:0.7rem; }
    .pv-photo { aspect-ratio:1; border-radius:10px; overflow:hidden; background:rgba(255,255,255,0.04); cursor:pointer; border:none; padding:0; transition:transform 0.2s; }
    .pv-photo:hover { transform:scale(1.03); }
    .pv-photo img { width:100%; height:100%; object-fit:cover; }
    .pv-tributes { display:flex; flex-direction:column; gap:0.9rem; }
    .pv-tribute { background:rgba(255,255,255,0.04); border:1px solid rgba(201,168,76,0.12); border-radius:14px; padding:1.3rem 1.4rem; }
    .pv-tribute-text { font-size:0.98rem; color:rgba(232,234,240,0.75); line-height:1.8; font-family:'Crimson Pro',serif; font-style:italic; margin-bottom:0.5rem; }
    .pv-tribute-from { font-size:0.78rem; color:#E8C97A; font-family:'Lora',serif; }
    .pv-audio-list { display:flex; flex-direction:column; gap:0.7rem; }
    .pv-audio-item { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:0.9rem 1.1rem; display:flex; align-items:center; gap:0.9rem; transition:border-color 0.2s; }
    .pv-audio-item.playing { border-color:rgba(201,168,76,0.35); background:rgba(201,168,76,0.05); }
    .pv-play { width:40px; height:40px; border-radius:50%; background:#C9A84C; border:none; cursor:pointer; color:#111; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:0.85rem; }
    .pv-audio-name { font-size:0.88rem; color:#E8EAF0; font-family:'Lora',serif; flex:1; }
    .pv-audio-dur { font-size:0.75rem; color:rgba(232,234,240,0.38); font-family:'Crimson Pro',serif; }
    .pv-timeline { position:relative; padding-left:2rem; }
    .pv-timeline::before { content:''; position:absolute; left:0.55rem; top:0.5rem; width:2px; bottom:0.5rem; background:linear-gradient(to bottom,rgba(201,168,76,0.5),rgba(201,168,76,0.05)); }
    .pv-tl-item { position:relative; margin-bottom:1.8rem; }
    .pv-tl-dot { position:absolute; left:-1.65rem; top:0.2rem; width:22px; height:22px; border-radius:50%; background:#1A1A28; border:2px solid rgba(201,168,76,0.5); display:flex; align-items:center; justify-content:center; font-size:0.62rem; z-index:1; }
    .pv-tl-card { background:rgba(255,255,255,0.03); border:1px solid rgba(201,168,76,0.1); border-radius:13px; padding:1.1rem 1.4rem; }
    .pv-tl-date { font-size:0.72rem; color:#C9A84C; font-family:'Crimson Pro',serif; letter-spacing:0.1em; margin-bottom:0.35rem; }
    .pv-tl-title { font-family:'Playfair Display',serif; font-size:1rem; color:#E8EAF0; margin-bottom:0.35rem; }
    .pv-tl-desc { font-family:'Crimson Pro',serif; font-size:0.92rem; color:rgba(232,234,240,0.7); line-height:1.7; }
    .pv-lightbox { position:fixed; inset:0; background:rgba(0,0,0,0.96); z-index:1000; display:flex; align-items:center; justify-content:center; }
    .pv-lb-close { position:absolute; top:1.5rem; right:1.5rem; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:white; width:42px; height:42px; border-radius:50%; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .pv-lb-nav { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:white; width:50px; height:50px; border-radius:50%; font-size:1.5rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .pv-lb-prev { left:1.5rem; } .pv-lb-next { right:1.5rem; }
    .pv-lb-img { max-width:90vw; max-height:85vh; object-fit:contain; border-radius:8px; }
    .pv-lb-counter { position:absolute; bottom:1.5rem; left:50%; transform:translateX(-50%); color:rgba(232,234,240,0.4); font-family:'Crimson Pro',serif; font-size:0.8rem; }
    .pv-empty { color:rgba(232,234,240,0.38); font-style:italic; font-family:'Crimson Pro',serif; padding:1.5rem 0; }
    .pv-footer { text-align:center; padding:1.5rem; border-top:1px solid rgba(255,255,255,0.05); margin-top:2.5rem; }
    .pv-footer-text { font-family:'Playfair Display',serif; color:rgba(232,234,240,0.3); font-size:0.85rem; }
  `;

  if (loading) return (
    <><style>{PV_CSS}</style>
      <div className="pv-wrap" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:40,height:40,borderRadius:"50%",border:"3px solid rgba(201,168,76,0.2)",borderTopColor:"#C9A84C",animation:"spin 0.8s linear infinite",margin:"0 auto 1rem"}} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{color:"rgba(232,234,240,0.4)",fontFamily:"'Crimson Pro',serif"}}>Loading preview…</div>
        </div>
      </div>
    </>
  );

  const photos   = (media.photos  || []).filter(m => m.url);
  const videos   = (media.videos  || []).filter(m => m.url);
  const audioTracks = media.audio  || [];
  const tributes = [
    ...(media.tributes || []),
    // Public tributes submitted via the floating form (auto-approved)
    ...(album?.guestWishes || [])
      .filter(w => w.tribute_type === 'tribute')
      .map(w => ({ id: w.id, tribute_text: w.message, tribute_from: w.guest_name })),
  ];
  const allVisual = [...photos, ...videos];
  const showMusic  = audioTracks.length > 0;
  const showEvents = lifeEvents.length > 0;

  const bd  = album?.birthDate || (album?.birthYear  && `${album.birthYear}-01-01`);
  const dd  = album?.deathDate || (album?.deathYear   && `${album.deathYear}-01-01`);
  const age = calcAge(bd, dd);

  const lbPrev = (e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.items.length) % lb.items.length })); };
  const lbNext = (e) => { e.stopPropagation(); setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.items.length })); };

  return (
    <>
      <style>{PV_CSS}</style>
      <div className="pv-wrap">
        <button className="pv-back" onClick={() => setPage("settings")}>← Back to Settings</button>

        <div className="pv-hero">
          {album?.coverUrl && <div className="pv-cover-bg" style={{backgroundImage:`url(${album.coverUrl})`}} />}
          <div className="pv-cover-grad" />
          <div className="pv-accent" />
          <div className="pv-hero-content">
            <div className="pv-avatar">
              {album?.avatarUrl ? <img src={album.avatarUrl} alt={album?.name} /> : (album?.name?.[0] || "✦")}
            </div>
            <h1 className="pv-name">{album?.name || "—"}</h1>
            {(bd || dd) && (
              <div className="pv-dates">✦&nbsp;{fmtDate(bd) || album?.birthYear || "?"}&nbsp;—&nbsp;{fmtDate(dd) || album?.deathYear || "?"}&nbsp;✦</div>
            )}
            {age !== null && <div className="pv-age">✦ &nbsp;Lived {age} years</div>}
          </div>
        </div>

        <div className="pv-body">
          <div className="pv-tabs">
            <button className={`pv-tab ${tab==="biography"?"active":""}`} onClick={() => setTab("biography")}>📖 Biography</button>
            <button className={`pv-tab ${tab==="photos"?"active":""}`} onClick={() => setTab("photos")}>📷 Photos{allVisual.length>0?` (${allVisual.length})`:""}</button>
            <button className={`pv-tab ${tab==="tributes"?"active":""}`} onClick={() => setTab("tributes")}>✍️ Tributes{tributes.length>0?` (${tributes.length})`:""}</button>
            {showEvents && <button className={`pv-tab ${tab==="events"?"active":""}`} onClick={() => setTab("events")}>⏳ Life Events ({lifeEvents.length})</button>}
            {showMusic  && <button className={`pv-tab ${tab==="music"?"active":""}`}  onClick={() => setTab("music")}>🎵 Music ({audioTracks.length})</button>}
          </div>

          {tab === "biography" && (
            <>
              <div className="pv-section-title">Life &amp; Legacy</div>
              {album?.biography
                ? <div className="pv-bio" dangerouslySetInnerHTML={{ __html: album.biography }} />
                : <p className="pv-empty">No biography has been added yet.</p>}
            </>
          )}

          {tab === "photos" && (
            <>
              <div className="pv-section-title">Memories</div>
              {allVisual.length === 0
                ? <p className="pv-empty">No photos added yet.</p>
                : <div className="pv-grid">
                    {allVisual.map((m, idx) => (
                      <button key={m.id} className="pv-photo" onClick={() => setLightbox({ items: allVisual, index: idx })}>
                        <img src={m.url} alt={m.caption || m.file_name || "Memory"} />
                      </button>
                    ))}
                  </div>}
            </>
          )}

          {tab === "tributes" && (
            <>
              <div className="pv-section-title">Words of Love</div>
              {tributes.length === 0
                ? <p className="pv-empty">No tributes added yet.</p>
                : <div className="pv-tributes">
                    {tributes.map(t => (
                      <div key={t.id} className="pv-tribute">
                        <div className="pv-tribute-text">"{t.tribute_text}"</div>
                        {t.tribute_from && <div className="pv-tribute-from">— {t.tribute_from}</div>}
                      </div>
                    ))}
                  </div>}
            </>
          )}

          {tab === "events" && showEvents && (
            <>
              <div className="pv-section-title">Life Journey</div>
              <div className="pv-timeline">
                {lifeEvents.map(ev => {
                  const dateStr = fmtEventDate(ev.event_date, ev.event_year);
                  const icon    = renderEventIcon(ev.icon);
                  return (
                    <div key={ev.id} className="pv-tl-item">
                      <div className="pv-tl-dot">{icon}</div>
                      <div className="pv-tl-card">
                        {dateStr && <div className="pv-tl-date">{dateStr}</div>}
                        <div className="pv-tl-title">{ev.title}</div>
                        {ev.description && <div className="pv-tl-desc">{ev.description}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "music" && showMusic && (
            <>
              <div className="pv-section-title">Voices &amp; Recordings</div>
              <div className="pv-audio-list">
                {audioTracks.map(a => (
                  <div key={a.id} className={`pv-audio-item ${playingId===a.id?"playing":""}`}>
                    <button className="pv-play" onClick={() => playAudio(a)}>{playingId===a.id?"⏸":"▶"}</button>
                    <div className="pv-audio-name">{a.file_name || "Recording"}</div>
                    {a.duration_sec && <div className="pv-audio-dur">{Math.floor(a.duration_sec/60)}:{String(a.duration_sec%60).padStart(2,"0")}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pv-footer">
            <div className="pv-footer-text">✦ Hriatrengna — Preview Mode</div>
          </div>
        </div>

        {lightbox && (
          <div className="pv-lightbox" onClick={() => setLightbox(null)}>
            <button className="pv-lb-close" onClick={() => setLightbox(null)}>✕</button>
            {lightbox.items.length > 1 && <button className="pv-lb-nav pv-lb-prev" onClick={lbPrev} aria-label="Previous photo">‹</button>}
            <img className="pv-lb-img" src={lightbox.items[lightbox.index]?.url} alt="Lightbox image" onClick={e => e.stopPropagation()} />
            {lightbox.items.length > 1 && <button className="pv-lb-nav pv-lb-next" onClick={lbNext} aria-label="Next photo">›</button>}
            {lightbox.items.length > 1 && <div className="pv-lb-counter">{lightbox.index+1} / {lightbox.items.length}</div>}
          </div>
        )}
      </div>
    </>
  );
}


// ── CHAT WIDGET ───────────────────────────────────────────────

export default PublicView;
