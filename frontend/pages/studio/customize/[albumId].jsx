/**
 * pages/studio/customize/[albumId].jsx
 * Photographer album customizer — theme, colors, font, layout, hero, toggles.
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { studioApi } from '../../../lib/studio-client';
import { studioBaseCss } from '../../../styles/studio-template';

const PRESETS = [
  { id:'classic',        label:'Classic',         emoji:'🖤', type:'memorial',  bg:'#111118', accent:'#C9A84C', text:'#E8EAF0' },
  { id:'dark',           label:'Dark',            emoji:'🌑', type:'memorial',  bg:'#0a0a0a', accent:'#888888', text:'#E8EAF0' },
  { id:'floral',         label:'Floral',          emoji:'🌸', type:'memorial',  bg:'#fdf6f0', accent:'#c9726b', text:'#1a1a1a' },
  { id:'traditional',    label:'Traditional',     emoji:'📜', type:'memorial',  bg:'#1a1208', accent:'#d4a849', text:'#FAF7F2' },
  { id:'minimal',        label:'Minimal',         emoji:'⬜', type:'memorial',  bg:'#f8f8f8', accent:'#222222', text:'#1a1a1a' },
  { id:'classic-romance',label:'Classic Romance', emoji:'💍', type:'wedding',   bg:'#1a0a10', accent:'#C9A84C', text:'#FAF7F2' },
  { id:'floral-garden',  label:'Floral Garden',   emoji:'🌷', type:'wedding',   bg:'#fdf4f5', accent:'#c9607a', text:'#1a1a1a' },
  { id:'minimalist',     label:'Minimalist',      emoji:'🤍', type:'wedding',   bg:'#ffffff', accent:'#1a1a1a', text:'#1a1a1a' },
  { id:'royal',          label:'Royal',           emoji:'👑', type:'wedding',   bg:'#0a0d1a', accent:'#C9A84C', text:'#E8EAF0' },
  { id:'retro-film',     label:'Retro Film',      emoji:'🎞️', type:'wedding',  bg:'#1a150e', accent:'#c4965a', text:'#FFF0D0' },
  { id:'tropical',       label:'Tropical',        emoji:'🌺', type:'wedding',   bg:'#071a1a', accent:'#2ec9a0', text:'#E8EAF0' },
];
const FONTS   = ['Playfair Display','Lora','Crimson Pro','Inter','Great Vibes'];
const LAYOUTS = [
  { id:'grid',      label:'Grid',      desc:'Equal squares' },
  { id:'masonry',   label:'Masonry',   desc:'Varying heights' },
  { id:'magazine',  label:'Magazine',  desc:'Feature + grid' },
  { id:'slideshow', label:'Slideshow', desc:'One at a time' },
];
const HEROES = [
  { id:'full',    label:'Full Height', desc:'Immersive hero' },
  { id:'minimal', label:'Minimal',     desc:'Compact header' },
  { id:'split',   label:'Split',       desc:'Photo + info side by side' },
];

const CSS = `
  ${studioBaseCss}
  .nav{padding:0 1.5rem;
    display:flex;align-items:center;justify-content:space-between;height:56px;
    position:sticky;top:0;z-index:50}
  .nav-l{display:flex;flex-direction:column;gap:0.1rem}
  .nav-title{font-size:0.9rem;font-weight:600}
  .nav-sub{font-size:0.7rem;color:var(--t3)}
  .nav-r{display:flex;gap:0.6rem;align-items:center}
  .btn{border:1px solid var(--b);background:transparent;color:var(--t2);
    padding:0.38rem 0.85rem;border-radius:8px;cursor:pointer;font-size:0.8rem}
  .btn:hover{border-color:rgba(255,255,255,0.18);color:var(--t)}
  .btn-gold{background:var(--g);color:#fffaf3;border:none;padding:0.42rem 1.25rem;
    border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:700}
  .btn-gold:disabled{opacity:0.6;cursor:not-allowed}
  .wrap{display:grid;grid-template-columns:360px 1fr;min-height:calc(100vh - 56px)}
  @media(max-width:860px){.wrap{grid-template-columns:1fr}.preview{display:none}}
  .sidebar{border-right:1px solid var(--b);overflow-y:auto;padding:1.25rem}
  .s{margin-bottom:1.75rem}
  .sl{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;
    color:var(--t3);margin-bottom:0.7rem;font-weight:600;display:flex;
    justify-content:space-between;align-items:center}
  .sl a{color:var(--g);font-size:0.62rem;cursor:pointer}
  .pg{display:grid;grid-template-columns:repeat(3,1fr);gap:0.4rem}
  .pb{border-radius:14px;padding:0.7rem 0.5rem;cursor:pointer;
    border:2px solid transparent;text-align:center;transition:border 0.15s}
  .pb.on{border-color:var(--g)}
  .pe{font-size:1.1rem;display:block;margin-bottom:0.15rem}
  .pn{font-size:0.6rem;font-weight:600}
  .cr{display:flex;align-items:center;justify-content:space-between;
    padding:0.45rem 0;border-bottom:1px solid rgba(255,255,255,0.03)}
  .cl{font-size:0.78rem;color:var(--t2)}
  .cp{display:flex;align-items:center;gap:0.4rem}
  .sw{width:26px;height:26px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);
    padding:2px;overflow:hidden;cursor:pointer}
  .sw input{width:100%;height:100%;border:none;background:none;cursor:pointer;padding:0}
  .hex{font-size:0.66rem;color:var(--t3);font-family:monospace;width:55px}
  .og{display:grid;grid-template-columns:1fr 1fr;gap:0.35rem}
  .ob{background:var(--d3);border:1.5px solid var(--b);border-radius:14px;
    padding:0.6rem 0.7rem;cursor:pointer;text-align:left;transition:all 0.15s}
  .ob.on{border-color:var(--g);background:rgba(201,168,76,0.08)}
  .on-name{font-size:0.78rem;font-weight:600;color:var(--t)}
  .on-desc{font-size:0.62rem;color:var(--t3);margin-top:0.1rem}
  .tr{display:flex;align-items:center;justify-content:space-between;
    padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.03)}
  .tl{font-size:0.8rem;color:var(--t2)}
  .tg{width:36px;height:20px;border-radius:100px;cursor:pointer;
    position:relative;transition:background 0.2s;flex-shrink:0}
  .tk{position:absolute;top:2px;width:16px;height:16px;border-radius:50%;
    background:white;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
  .preview{background:var(--d);display:flex;flex-direction:column;
    align-items:center;padding:2rem 1rem;overflow-y:auto}
  .plabel{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;
    color:var(--t3);margin-bottom:1rem}
  .pcard{width:100%;max-width:360px;border-radius:24px;overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,0.5)}
  .err{color:#ef4444;font-size:0.78rem}
  .ok{color:#22c55e;font-size:0.78rem}
`;

export default function AlbumCustomizer() {
  const router   = useRouter();
  const { albumId } = router.query;

  const [album,   setAlbum]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [err,     setErr]     = useState('');

  const [theme,   setTheme]   = useState('classic');
  const [bgColor, setBgColor] = useState('#111118');
  const [accent,  setAccent]  = useState('#C9A84C');
  const [txtColor,setTxtColor]= useState('#E8EAF0');
  const [useCustom,setUseCustom]=useState(false);
  const [font,    setFont]    = useState('Playfair Display');
  const [layout,  setLayout]  = useState('grid');
  const [hero,    setHero]    = useState('full');
  const [showDates,    setShowDates]    = useState(true);
  const [showBio,      setShowBio]      = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);

  useEffect(() => {
    if (!albumId) return;
    studioApi(`/api/studio/albums/${albumId}/customize`)
      .then(d => {
        setAlbum(d);
        const p = PRESETS.find(x => x.id === d.theme);
        if (p) { setTheme(p.id); setBgColor(p.bg); setAccent(p.accent); setTxtColor(p.text); }
        const c = d.customConfig || {};
        if (c.customColors) {
          if (c.customColors.bg)     setBgColor(c.customColors.bg);
          if (c.customColors.accent) setAccent(c.customColors.accent);
          if (c.customColors.text)   setTxtColor(c.customColors.text);
          setUseCustom(true);
        }
        if (c.fontFamily)  setFont(c.fontFamily);
        if (c.layout)      setLayout(c.layout);
        if (c.heroStyle)   setHero(c.heroStyle);
        if (typeof c.showDates    === 'boolean') setShowDates(c.showDates);
        if (typeof c.showBio      === 'boolean') setShowBio(c.showBio);
        if (typeof c.showCaptions === 'boolean') setShowCaptions(c.showCaptions);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [albumId]);

  const applyPreset = (p) => {
    setTheme(p.id); setBgColor(p.bg); setAccent(p.accent); setTxtColor(p.text);
    setUseCustom(false);
  };

  const save = async () => {
    setSaving(true); setSaved(false); setErr('');
    try {
      await studioApi(`/api/studio/albums/${albumId}/customize`, {
        method: 'PUT',
        body: JSON.stringify({
          theme,
          customColors: useCustom ? { bg: bgColor, accent, text: txtColor } : undefined,
          fontFamily: font, layout, heroStyle: hero,
          showDates, showBio, showCaptions,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const isLight = bgColor.startsWith('#f') || bgColor.startsWith('#e') || bgColor === '#ffffff' || bgColor === '#fff';

  if (loading) return (
    <div style={{ minHeight:'100vh',background:'#f5f1ea',display:'flex',
      alignItems:'center',justifyContent:'center',color:'#8b6944',fontFamily:'system-ui' }}>
      Loading...
    </div>
  );

  return (
    <>
      <Head>
        <title>Customise - {album?.albumName}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=Lora:wght@400;600&family=Crimson+Pro:wght@300;400&family=Inter:wght@400;500&family=Great+Vibes&display=swap" />
      </Head>
      <style>{CSS}</style>

      <nav className="nav">
        <div className="nav-l">
          <div className="nav-title">✦ Album Customiser</div>
          <div className="nav-sub">{album?.albumName || albumId}</div>
        </div>
        <div className="nav-r">
          {err  && <span className="err">{err}</span>}
          {saved && <span className="ok">Saved</span>}
          <button className="btn" onClick={() => router.push('/studio')}>Back to Studio</button>
          <a href={album?.publicUrl || '#'} target="_blank" rel="noopener noreferrer"
            className="btn" style={{ textDecoration:'none',display:'inline-block' }}>Preview</a>
          <button className="btn-gold" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </nav>

      <div className="wrap">
        {/* ── Sidebar ── */}
        <div className="sidebar">

          {/* Presets */}
          <div className="s">
            <div className="sl"><span>Preset Themes</span></div>
            <div className="pg">
              {PRESETS.map(p => (
                <button key={p.id} className={`pb ${theme===p.id&&!useCustom?'on':''}`}
                  style={{ background: p.bg }} onClick={() => applyPreset(p)}>
                  <span className="pe">{p.emoji}</span>
                  <span className="pn" style={{ color: p.text }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom colours */}
          <div className="s">
            <div className="sl">
              <span>Custom Colours</span>
              {useCustom && (
                <a onClick={() => { const p=PRESETS.find(x=>x.id===theme)||PRESETS[0];
                  setBgColor(p.bg);setAccent(p.accent);setTxtColor(p.text);setUseCustom(false); }}>
                  Reset
                </a>
              )}
            </div>
            {[
              { label:'Background', val:bgColor,   set:(v)=>{setBgColor(v);setUseCustom(true);} },
              { label:'Accent',     val:accent,    set:(v)=>{setAccent(v); setUseCustom(true);} },
              { label:'Text',       val:txtColor,  set:(v)=>{setTxtColor(v);setUseCustom(true);} },
            ].map(c => (
              <div key={c.label} className="cr">
                <span className="cl">{c.label}</span>
                <div className="cp">
                  <div className="sw" style={{ background:c.val }}>
                    <input type="color" value={c.val.startsWith('#')?c.val:'#ffffff'}
                      onChange={e => c.set(e.target.value)} />
                  </div>
                  <span className="hex">{c.val}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Font */}
          <div className="s">
            <div className="sl"><span>Font</span></div>
            <div style={{ display:'flex',flexDirection:'column',gap:'0.3rem' }}>
              {FONTS.map(f => (
                <button key={f} className={`ob ${font===f?'on':''}`} onClick={() => setFont(f)}
                  style={{ fontFamily:`'${f}',Georgia,serif` }}>
                  <span className="on-name" style={{ fontFamily:`'${f}',serif` }}>
                    {f} — Aa Bb
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="s">
            <div className="sl"><span>Photo Layout</span></div>
            <div className="og">
              {LAYOUTS.map(l => (
                <button key={l.id} className={`ob ${layout===l.id?'on':''}`}
                  onClick={() => setLayout(l.id)}>
                  <div className="on-name">{l.label}</div>
                  <div className="on-desc">{l.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hero */}
          <div className="s">
            <div className="sl"><span>Hero Style</span></div>
            <div className="og">
              {HEROES.map(h => (
                <button key={h.id} className={`ob ${hero===h.id?'on':''}`}
                  onClick={() => setHero(h.id)}>
                  <div className="on-name">{h.label}</div>
                  <div className="on-desc">{h.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="s">
            <div className="sl"><span>Content Visibility</span></div>
            {[
              { label:'Show Dates',     val:showDates,    set:setShowDates },
              { label:'Show Biography', val:showBio,      set:setShowBio },
              { label:'Show Captions',  val:showCaptions, set:setShowCaptions },
            ].map(t => (
              <div key={t.label} className="tr">
                <span className="tl">{t.label}</span>
                <div className="tg" onClick={() => t.set(!t.val)}
                  style={{ background:t.val?'#C9A84C':'rgba(255,255,255,0.12)' }}>
                  <div className="tk" style={{ left:t.val?18:2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Live Preview ── */}
        <div className="preview">
          <div className="plabel">Live Preview</div>
          <div className="pcard">
            {/* Hero section */}
            <div style={{ background:bgColor,
              padding: hero==='minimal' ? '1.75rem 1.25rem' : '2.75rem 1.25rem',
              textAlign:'center', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute',inset:0,opacity:0.07,
                background:`radial-gradient(ellipse 80% 60% at 50% 0%,${accent},transparent)`,
                pointerEvents:'none' }} />
              <div style={{ width:64,height:64,borderRadius:'50%',
                background:`${accent}22`, border:`2px solid ${accent}55`,
                margin:'0 auto 0.75rem',display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:'1.4rem',position:'relative',zIndex:1 }}>
                {album?.albumType==='wedding'?'💍':'✦'}
              </div>
              <div style={{ fontFamily:`'${font}',Georgia,serif`,
                fontSize:'1.25rem',fontWeight:700,color:txtColor,
                position:'relative',zIndex:1,marginBottom:'0.25rem' }}>
                {album?.albumName||'Client Name'}
              </div>
              {showDates && (
                <div style={{ fontSize:'0.68rem',color:`${txtColor}55`,
                  letterSpacing:'0.1em',position:'relative',zIndex:1 }}>
                  ✦ 2025 ✦
                </div>
              )}
              <div style={{ width:36,height:1,background:accent,opacity:0.5,
                margin:'0.75rem auto 0',position:'relative',zIndex:1 }} />
            </div>

            {/* Body */}
            <div style={{ background:bgColor,padding:'1rem' }}>
              {showBio && (
                <div style={{ background:`${accent}10`,border:`1px solid ${accent}22`,
                  borderRadius:7,padding:'0.65rem',marginBottom:'0.6rem' }}>
                  <div style={{ fontSize:'0.58rem',textTransform:'uppercase',
                    letterSpacing:'0.1em',color:accent,marginBottom:'0.3rem',opacity:0.85 }}>
                    About
                  </div>
                  <div style={{ fontSize:'0.66rem',color:`${txtColor}77`,
                    fontStyle:'italic',fontFamily:`'${font}',serif`,lineHeight:1.5 }}>
                    Biography appears here…
                  </div>
                </div>
              )}
              <div style={{ fontSize:'0.58rem',textTransform:'uppercase',
                letterSpacing:'0.1em',color:accent,marginBottom:'0.4rem',opacity:0.85 }}>
                {layout==='slideshow'?'Slideshow':layout==='magazine'?'Magazine':'Gallery'}
              </div>
              <div style={{ display:'grid',
                gridTemplateColumns:layout==='slideshow'?'1fr':'repeat(3,1fr)',
                gap:'2px' }}>
                {Array.from({length:layout==='slideshow'?1:6}).map((_,i)=>(
                  <div key={i} style={{ background:`${accent}18`,borderRadius:3,
                    aspectRatio: layout==='magazine'&&i===0?'16/9':'1',
                    gridColumn: layout==='magazine'&&i===0?'1/-1':undefined,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'0.55rem',color:`${accent}55` }}>
                    {i===0?'📷':''}
                  </div>
                ))}
              </div>
              {showCaptions && layout!=='slideshow' && (
                <div style={{ fontSize:'0.55rem',color:`${txtColor}33`,
                  textAlign:'center',marginTop:'0.3rem',fontStyle:'italic' }}>
                  captions below photos
                </div>
              )}
            </div>
          </div>
          <a href={album?.publicUrl || '#'} target="_blank" rel="noopener noreferrer"
            style={{ marginTop:'1rem',color:'#C9A84C',fontSize:'0.72rem',textDecoration:'none' }}>
            View full album ↗
          </a>
        </div>
      </div>
    </>
  );
}
