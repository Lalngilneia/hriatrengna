/**
 * components/album/InvitationTab.jsx
 *
 * Adds to previous version:
 *  - Profile photo upload with circular crop + resize
 *  - Cover photo upload with banner crop (16:9) + resize
 *  - Both use canvas-based cropper (no external library)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { apiCall } from '../../lib/api';
import { getToken } from '../../lib/auth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hriatrengna.in';
const CDN     = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://cdn.hriatrengna.in';

const PRESETS = [
  { name:'Classic Gold',  bgColor:'#1A0A10', bgType:'gradient', bgColor2:'#2D1020', textColor:'#FAF7F2', accentColor:'#C9A84C', fontFamily:'Playfair Display', pattern:'none' },
  { name:'Rose Romance',  bgColor:'#2d0a1a', bgType:'gradient', bgColor2:'#4a1030', textColor:'#FAF7F2', accentColor:'#e8839a', fontFamily:'Lora',            pattern:'floral' },
  { name:'Royal Navy',    bgColor:'#060e26', bgType:'gradient', bgColor2:'#0d1f4a', textColor:'#E8EAF0', accentColor:'#C9A84C', fontFamily:'Crimson Pro',     pattern:'geometric' },
  { name:'Forest Green',  bgColor:'#071a10', bgType:'gradient', bgColor2:'#0d2e1a', textColor:'#F0FAF0', accentColor:'#5ee8a0', fontFamily:'Lora',            pattern:'none' },
  { name:'Minimal White', bgColor:'#ffffff', bgType:'solid',    bgColor2:'#f5f5f5', textColor:'#1a1a1a', accentColor:'#C9A84C', fontFamily:'Inter',           pattern:'none' },
  { name:'Sunset Gold',   bgColor:'#1a0e00', bgType:'gradient', bgColor2:'#3a1f00', textColor:'#FFF0D0', accentColor:'#E8A84C', fontFamily:'Great Vibes',     pattern:'waves' },
];

const FONTS    = ['Playfair Display','Lora','Crimson Pro','Inter','Great Vibes'];
const PATTERNS = ['none','floral','geometric','dots','waves'];

// ══════════════════════════════════════════════════════════════
// ImageCropper — canvas-based crop + resize
// ══════════════════════════════════════════════════════════════
function ImageCropper({ src, aspectRatio, circular, onApply, onCancel }) {
  const canvasRef  = useRef(null);
  const imgRef     = useRef(null);
  const [loaded,   setLoaded]   = useState(false);
  const [crop,     setCrop]     = useState({ x:0, y:0, w:100, h:100 });
  const [dragging, setDragging] = useState(null);
  const [scale,    setScale]    = useState(100);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Initial crop — centred, filling longest dimension
      const ar  = aspectRatio || 1;
      const sw  = img.naturalWidth;
      const sh  = img.naturalHeight;
      let cw, ch;
      if (sw/sh > ar) { ch=sh; cw=Math.round(sh*ar); }
      else            { cw=sw; ch=Math.round(sw/ar); }
      setCrop({ x:Math.round((sw-cw)/2), y:Math.round((sh-ch)/2), w:cw, h:ch });
      setLoaded(true);
    };
    img.src = src;
  }, [src, aspectRatio]);

  // Draw preview onto canvas
  useEffect(() => {
    if (!loaded || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const img    = imgRef.current;
    const displayW = 360;
    const displayH = Math.round(displayW / (aspectRatio || 1));
    canvas.width  = displayW;
    canvas.height = displayH;

    // Scale image to fit display
    const scaleX = displayW / img.naturalWidth;
    const scaleY = displayH / img.naturalHeight;
    const s = Math.min(scaleX, scaleY) * (scale / 100);

    const iw = img.naturalWidth  * s;
    const ih = img.naturalHeight * s;
    const ix = (displayW - iw) / 2;
    const iy = (displayH - ih) / 2;

    ctx.clearRect(0, 0, displayW, displayH);

    if (circular) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(displayW/2, displayH/2, Math.min(displayW,displayH)/2, 0, Math.PI*2);
      ctx.clip();
    }
    ctx.drawImage(img, ix, iy, iw, ih);
    if (circular) ctx.restore();

    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, displayW, displayH);
    // Clear crop area
    const cx = (crop.x / img.naturalWidth)  * iw + ix;
    const cy = (crop.y / img.naturalHeight) * ih + iy;
    const cw = (crop.w / img.naturalWidth)  * iw;
    const ch = (crop.h / img.naturalHeight) * ih;

    if (circular) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx+cw/2, cy+ch/2, Math.min(cw,ch)/2, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx+cw/2, cy+ch/2, Math.min(cw,ch)/2, 0, Math.PI*2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.restore();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2;
      ctx.strokeRect(cx, cy, cw, ch);
    }
  }, [loaded, crop, scale, circular, aspectRatio]);

  const apply = () => {
    if (!imgRef.current) return;
    const img    = imgRef.current;
    const outW   = circular ? 400 : 1200;
    const outH   = Math.round(outW / (aspectRatio || 1));
    const out    = document.createElement('canvas');
    out.width    = outW;
    out.height   = outH;
    const ctx    = out.getContext('2d');
    const s      = scale / 100;
    const sw     = crop.w / s;
    const sh     = crop.h / s;
    const sx     = crop.x / s;
    const sy     = crop.y / s;

    if (circular) {
      ctx.beginPath();
      ctx.arc(outW/2, outH/2, Math.min(outW,outH)/2, 0, Math.PI*2);
      ctx.clip();
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    out.toBlob(blob => onApply(blob), 'image/jpeg', 0.92);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem' }}>
      <canvas ref={canvasRef} style={{ borderRadius:8, maxWidth:'100%',
        border:'1px solid #E5E5E5', cursor:'crosshair' }} />

      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', width:'100%' }}>
        <label style={{ fontSize:'0.78rem', color:'#666', flexShrink:0 }}>Zoom</label>
        <input type="range" min={50} max={200} value={scale}
          onChange={e => setScale(Number(e.target.value))}
          style={{ flex:1 }} />
        <span style={{ fontSize:'0.75rem', color:'#888', width:36 }}>{scale}%</span>
      </div>

      <div style={{ display:'flex', gap:'0.5rem', width:'100%' }}>
        <button onClick={onCancel}
          style={{ flex:1, padding:'0.6rem', border:'1.5px solid #E5E5E5',
            borderRadius:8, background:'white', color:'#666',
            fontSize:'0.85rem', cursor:'pointer' }}>
          Cancel
        </button>
        <button onClick={apply}
          style={{ flex:1, padding:'0.6rem', border:'none',
            borderRadius:8, background:'#1a1a1a', color:'white',
            fontSize:'0.85rem', cursor:'pointer', fontWeight:600 }}>
          ✓ Apply Crop
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PhotoUpload — handles file selection, crop, upload
// ══════════════════════════════════════════════════════════════
function PhotoUpload({ albumId, token, type, label, aspectRatio, circular,
                       currentUrl, onUploaded, showToast }) {
  const [stage,    setStage]    = useState('idle'); // idle | cropping | uploading
  const [srcUrl,   setSrcUrl]   = useState(null);
  const [preview,  setPreview]  = useState(currentUrl);
  const fileRef = useRef(null);

  const endpoint = type === 'avatar'
    ? `/api/albums/${albumId}/invitation/avatar`
    : `/api/albums/${albumId}/invitation/cover`;

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/'))
      return showToast?.('Please select an image file', 'error');
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    setStage('cropping');
    e.target.value = '';
  };

  const onApply = async (blob) => {
    setStage('uploading');
    try {
      const form = new FormData();
      form.append('file', blob, type === 'avatar' ? 'profile.jpg' : 'cover.jpg');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://api.hriatrengna.in'}${endpoint}`,
        { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:form }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Upload failed');
      const newUrl = d.url || (d.key ? `${CDN}/${d.key}` : null);
      setPreview(newUrl);
      onUploaded?.(newUrl, d.key);
      showToast?.(d.message || 'Photo updated');
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setStage('idle');
      if (srcUrl) { URL.revokeObjectURL(srcUrl); setSrcUrl(null); }
    }
  };

  const onCancel = () => {
    setStage('idle');
    if (srcUrl) { URL.revokeObjectURL(srcUrl); setSrcUrl(null); }
  };

  return (
    <div style={{ background:'white', borderRadius:14, padding:'1.25rem',
      boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight:600, fontSize:'0.88rem', color:'#1a1a1a',
        marginBottom:'0.75rem' }}>
        {label}
        <span style={{ fontWeight:400, fontSize:'0.72rem', color:'#999', marginLeft:'0.5rem' }}>
          {circular ? 'Circular crop — 1:1' : 'Banner crop — 16:9'}
        </span>
      </div>

      {stage === 'cropping' && srcUrl ? (
        <ImageCropper
          src={srcUrl}
          aspectRatio={aspectRatio}
          circular={circular}
          onApply={onApply}
          onCancel={onCancel}
        />
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
          {/* Preview */}
          <div style={{
            width: circular ? 80 : 160,
            height: circular ? 80 : 90,
            borderRadius: circular ? '50%' : 8,
            overflow:'hidden',
            border:'2px solid #E5E5E5',
            background:'#f5f5f5',
            flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {preview
              ? <img src={preview} alt="Invitation preview image" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:'1.5rem' }}>{circular ? '👤' : '🖼️'}</span>}
          </div>

          {/* Actions */}
          <div>
            <input ref={fileRef} type="file" accept="image/*"
              onChange={onFile} style={{ display:'none' }}/>
            <button onClick={() => fileRef.current?.click()}
              disabled={stage === 'uploading'}
              style={{
                padding:'0.5rem 1rem', border:'1.5px solid #E5E5E5',
                borderRadius:8, background:'white', color:'#1a1a1a',
                fontSize:'0.82rem', cursor:'pointer', fontWeight:500,
                display:'block', marginBottom:'0.4rem',
              }}>
              {stage === 'uploading' ? 'Uploading…' : '📤 Choose Photo'}
            </button>
            {preview && (
              <div style={{ fontSize:'0.72rem', color:'#22c55e' }}>✓ Photo set</div>
            )}
            <div style={{ fontSize:'0.7rem', color:'#bbb', marginTop:'0.2rem' }}>
              JPEG, PNG, WebP · max 20MB
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// InvitationTab — main component
// ══════════════════════════════════════════════════════════════
export default function InvitationTab({ albumId, album, token, showToast, onUpdate }) {
  const [saving,  setSaving]  = useState(false);
  const [copying, setCopying] = useState(false);
  const invUrl = `${APP_URL}/invitation/${album?.slug || ''}`;

  const [settings, setSettings] = useState({
    invitationEnabled: album?.invitation_enabled || false,
    rsvpEnabled:       album?.rsvp_enabled       || false,
    rsvpDeadline:      album?.rsvp_deadline ? album.rsvp_deadline.split('T')[0] : '',
    ceremonyTime:      album?.ceremony_time   || '',
    receptionTime:     album?.reception_time  || '',
    ceremonyVenue:     album?.ceremony_venue  || album?.venue_name || '',
    receptionVenue:    album?.reception_venue || '',
    dressCode:         album?.dress_code      || '',
    mapUrl:            album?.map_url         || '',
    invitationNote:    album?.invitation_note || '',
  });

  const defaultPreset = PRESETS[0];
  const [theme, setTheme] = useState(() => {
    const t = album?.invitation_theme || {};
    return {
      bgColor:     t.bgColor     || defaultPreset.bgColor,
      bgType:      t.bgType      || defaultPreset.bgType,
      bgColor2:    t.bgColor2    || defaultPreset.bgColor2,
      textColor:   t.textColor   || defaultPreset.textColor,
      accentColor: t.accentColor || defaultPreset.accentColor,
      fontFamily:  t.fontFamily  || defaultPreset.fontFamily,
      pattern:     t.pattern     || defaultPreset.pattern,
    };
  });

  const set  = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const setT = (k, v) => setTheme(t => ({ ...t, [k]: v }));

  const applyPreset = (p) => setTheme({
    bgColor:p.bgColor, bgType:p.bgType, bgColor2:p.bgColor2,
    textColor:p.textColor, accentColor:p.accentColor,
    fontFamily:p.fontFamily, pattern:p.pattern,
  });

  const save = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/albums/${albumId}/invitation`,
        { method:'PUT', body:JSON.stringify({ ...settings, theme }) }, token);
      showToast?.('✓ Invitation settings saved');
      onUpdate?.();
    } catch (e) { showToast?.(e.message||'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(invUrl); }
    catch { window.prompt('Copy:', invUrl); return; }
    setCopying(true); setTimeout(() => setCopying(false), 2000);
  };

  const previewBg = theme.bgType === 'gradient'
    ? `linear-gradient(135deg,${theme.bgColor} 0%,${theme.bgColor2} 100%)`
    : theme.bgColor;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px',
      gap:'1.5rem', alignItems:'start' }}>

      {/* LEFT: Settings */}
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

        {/* Enable + URL */}
        <div style={{ background:'white', borderRadius:14, padding:'1.5rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.95rem', color:'#1a1a1a' }}>
                💌 Wedding Invitation Page
              </div>
              <div style={{ fontSize:'0.75rem', color:'#888', marginTop:'0.2rem' }}>
                hriatrengna.in/invitation/{album?.slug}
              </div>
            </div>
            <Toggle value={settings.invitationEnabled}
              onChange={v => set('invitationEnabled', v)}/>
          </div>
          {settings.invitationEnabled && (
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
              <input value={invUrl} readOnly
                style={{ flex:1, padding:'0.5rem 0.75rem', background:'#F9F9F9',
                  border:'1px solid #E5E5E5', borderRadius:8, fontSize:'0.75rem',
                  color:'#666', outline:'none' }}/>
              <button onClick={copyLink}
                style={{ padding:'0.5rem 1rem', background:copying?'#22c55e':'#1a1a1a',
                  color:'white', border:'none', borderRadius:8,
                  fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                {copying?'✓ Copied':'Copy'}
              </button>
              <a href={invUrl} target="_blank" rel="noopener noreferrer"
                style={{ padding:'0.5rem 0.75rem', background:'white',
                  border:'1px solid #E5E5E5', borderRadius:8,
                  color:'#666', textDecoration:'none', display:'flex', alignItems:'center' }}>
                ↗
              </a>
            </div>
          )}
        </div>

        {/* Photos */}
        <div style={{ background:'white', borderRadius:14, padding:'1.5rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#1a1a1a',
            marginBottom:'1rem' }}>📸 Photos</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <PhotoUpload
              albumId={albumId} token={token}
              type="avatar" label="👤 Profile / Couple Photo"
              aspectRatio={1} circular={true}
              currentUrl={album?.avatar_key ? `${CDN}/${album.avatar_key}` : null}
              onUploaded={onUpdate} showToast={showToast}
            />
            <PhotoUpload
              albumId={albumId} token={token}
              type="cover" label="🖼️ Cover / Banner Photo"
              aspectRatio={16/9} circular={false}
              currentUrl={album?.cover_key ? `${CDN}/${album.cover_key}` : null}
              onUploaded={onUpdate} showToast={showToast}
            />
          </div>
        </div>

        {/* Event Details */}
        <div style={{ background:'white', borderRadius:14, padding:'1.5rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#1a1a1a',
            marginBottom:'1rem' }}>📅 Event Details</div>
          <div style={{ display:'grid', gap:'0.85rem' }}>
            <Row label="Ceremony Time" placeholder="e.g. 11:00 AM"
              value={settings.ceremonyTime} onChange={v=>set('ceremonyTime',v)}/>
            <Row label="Ceremony Venue" placeholder="e.g. St. Paul's Church, Aizawl"
              value={settings.ceremonyVenue} onChange={v=>set('ceremonyVenue',v)}/>
            <Row label="Reception Time" placeholder="e.g. 6:00 PM"
              value={settings.receptionTime} onChange={v=>set('receptionTime',v)}/>
            <Row label="Reception Venue" placeholder="e.g. The Grand Ballroom"
              value={settings.receptionVenue} onChange={v=>set('receptionVenue',v)}/>
            <Row label="Dress Code" placeholder="e.g. Formal / Mizo Traditional"
              value={settings.dressCode} onChange={v=>set('dressCode',v)}/>
            <Row label="Map / Directions URL" placeholder="https://maps.google.com/..."
              value={settings.mapUrl} onChange={v=>set('mapUrl',v)} type="url"/>
          </div>
        </div>

        {/* Personal note */}
        <div style={{ background:'white', borderRadius:14, padding:'1.5rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#1a1a1a',
            marginBottom:'0.4rem' }}>✍️ Personal Note</div>
          <div style={{ fontSize:'0.78rem', color:'#888', marginBottom:'0.75rem' }}>
            A personal message from the couple.
          </div>
          <textarea placeholder="We would be honoured to celebrate with you…"
            value={settings.invitationNote}
            onChange={e=>set('invitationNote',e.target.value)}
            maxLength={500} rows={3}
            style={{ width:'100%', padding:'0.6rem 0.85rem',
              border:'1px solid #E5E5E5', borderRadius:8,
              fontSize:'0.88rem', outline:'none', resize:'vertical', fontFamily:'inherit' }}/>
          <div style={{ fontSize:'0.7rem', color:'#bbb', textAlign:'right', marginTop:'0.25rem' }}>
            {settings.invitationNote.length}/500
          </div>
        </div>

        {/* RSVP */}
        <div style={{ background:'white', borderRadius:14, padding:'1.5rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:'0.75rem' }}>
            <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#1a1a1a' }}>💌 RSVP</div>
            <Toggle value={settings.rsvpEnabled} onChange={v=>set('rsvpEnabled',v)}/>
          </div>
          {settings.rsvpEnabled && (
            <Row label="RSVP Deadline" type="date"
              value={settings.rsvpDeadline} onChange={v=>set('rsvpDeadline',v)}/>
          )}
        </div>

        {/* Save */}
        <button onClick={save} disabled={saving}
          style={{ width:'100%', padding:'0.9rem',
            background:saving?'#ccc':'#1a1a1a', color:'white', border:'none',
            borderRadius:10, fontWeight:600, fontSize:'0.95rem',
            cursor:saving?'not-allowed':'pointer' }}>
          {saving?'Saving…':'✓ Save Invitation Settings'}
        </button>
      </div>

      {/* RIGHT: Theme + Preview */}
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem',
        position:'sticky', top:80 }}>

        {/* Presets */}
        <div style={{ background:'white', borderRadius:14, padding:'1.25rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#1a1a1a',
            marginBottom:'0.75rem' }}>🎨 Preset Themes</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.4rem' }}>
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => applyPreset(p)}
                style={{
                  background: p.bgType==='gradient'
                    ? `linear-gradient(135deg,${p.bgColor} 0%,${p.bgColor2} 100%)`
                    : p.bgColor,
                  border:`2px solid ${p.accentColor}55`,
                  borderRadius:8, padding:'0.5rem 0.6rem', cursor:'pointer', textAlign:'left',
                }}>
                <div style={{ fontFamily:p.fontFamily==='Great Vibes'?`'Great Vibes',cursive`:`'${p.fontFamily}',serif`,
                  fontSize:p.fontFamily==='Great Vibes'?'0.95rem':'0.72rem',
                  color:p.textColor, fontWeight:600 }}>
                  {p.name}
                </div>
                <div style={{ width:20, height:2, background:p.accentColor,
                  marginTop:'0.3rem', borderRadius:1, opacity:0.8 }}/>
              </button>
            ))}
          </div>
        </div>

        {/* Custom controls */}
        <div style={{ background:'white', borderRadius:14, padding:'1.25rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight:600, fontSize:'0.9rem', color:'#1a1a1a',
            marginBottom:'0.75rem' }}>Custom</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.65rem' }}>
            <CRow label="Font">
              <select value={theme.fontFamily} onChange={e=>setT('fontFamily',e.target.value)}
                style={{ fontSize:'0.78rem', padding:'0.35rem 0.5rem',
                  border:'1px solid #E5E5E5', borderRadius:6, outline:'none' }}>
                {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </CRow>
            <CRow label="Background">
              <div style={{ display:'flex', gap:'0.25rem' }}>
                {['solid','gradient'].map(bt=>(
                  <button key={bt} onClick={()=>setT('bgType',bt)}
                    style={{ padding:'0.3rem 0.6rem', fontSize:'0.72rem',
                      border:`1.5px solid ${theme.bgType===bt?'#1a1a1a':'#E5E5E5'}`,
                      borderRadius:6, background:theme.bgType===bt?'#1a1a1a':'white',
                      color:theme.bgType===bt?'white':'#666', cursor:'pointer' }}>
                    {bt.charAt(0).toUpperCase()+bt.slice(1)}
                  </button>
                ))}
              </div>
            </CRow>
            <CRow label="BG Color 1">
              <input type="color" value={theme.bgColor} onChange={e=>setT('bgColor',e.target.value)}
                style={{ width:32, height:28, border:'1px solid #E5E5E5', borderRadius:6, cursor:'pointer', padding:2 }}/>
              <span style={{ fontSize:'0.7rem', color:'#888' }}>{theme.bgColor}</span>
            </CRow>
            {theme.bgType==='gradient' && (
              <CRow label="BG Color 2">
                <input type="color" value={theme.bgColor2} onChange={e=>setT('bgColor2',e.target.value)}
                  style={{ width:32, height:28, border:'1px solid #E5E5E5', borderRadius:6, cursor:'pointer', padding:2 }}/>
                <span style={{ fontSize:'0.7rem', color:'#888' }}>{theme.bgColor2}</span>
              </CRow>
            )}
            <CRow label="Text">
              <input type="color" value={theme.textColor} onChange={e=>setT('textColor',e.target.value)}
                style={{ width:32, height:28, border:'1px solid #E5E5E5', borderRadius:6, cursor:'pointer', padding:2 }}/>
            </CRow>
            <CRow label="Accent">
              <input type="color" value={theme.accentColor} onChange={e=>setT('accentColor',e.target.value)}
                style={{ width:32, height:28, border:'1px solid #E5E5E5', borderRadius:6, cursor:'pointer', padding:2 }}/>
              <span style={{ fontSize:'0.7rem', color:'#888' }}>{theme.accentColor}</span>
            </CRow>
            <CRow label="Pattern">
              <select value={theme.pattern} onChange={e=>setT('pattern',e.target.value)}
                style={{ fontSize:'0.78rem', padding:'0.35rem 0.5rem',
                  border:'1px solid #E5E5E5', borderRadius:6, outline:'none' }}>
                {PATTERNS.map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </CRow>
          </div>
        </div>

        {/* Mini preview */}
        <div style={{ background:'white', borderRadius:14, padding:'1rem',
          boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight:600, fontSize:'0.82rem', color:'#1a1a1a',
            marginBottom:'0.6rem' }}>Preview</div>
          <div style={{ background:previewBg, borderRadius:10, padding:'1.25rem 1rem',
            textAlign:'center', fontFamily:`'${theme.fontFamily}',Georgia,serif`, minHeight:180 }}>
            <div style={{ fontSize:'0.55rem', letterSpacing:'0.2em', textTransform:'uppercase',
              color:theme.accentColor, marginBottom:'0.4rem', opacity:0.9 }}>
              ✦ Together We Begin ✦
            </div>
            <div style={{ fontSize:'1.05rem', fontWeight:700, color:theme.textColor,
              lineHeight:1.2, marginBottom:'0.4rem' }}>
              {album?.partner1_name||'Partner 1'}
              <span style={{ color:theme.accentColor, margin:'0 0.3rem', fontStyle:'italic' }}>&amp;</span>
              {album?.partner2_name||'Partner 2'}
            </div>
            {settings.ceremonyTime && (
              <div style={{ fontSize:'0.6rem', color:`${theme.textColor}99` }}>⏰ {settings.ceremonyTime}</div>
            )}
            <div style={{ width:40, height:1, background:theme.accentColor,
              opacity:0.5, margin:'0.5rem auto' }}/>
            <div style={{ width:50, height:50, background:'white', borderRadius:6,
              margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.5rem', color:'#333', boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
              [QR]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div style={{ width:44, height:24, borderRadius:100,
      background:value?'#1a1a1a':'#D1D5DB',
      position:'relative', transition:'background 0.2s', cursor:'pointer' }}
      onClick={()=>onChange(!value)}>
      <div style={{ position:'absolute', top:2, left:value?22:2,
        width:20, height:20, borderRadius:'50%', background:'white',
        transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </div>
  );
}

function Row({ label, value, onChange, placeholder, type='text' }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'0.78rem', fontWeight:500,
        color:'#555', marginBottom:'0.25rem' }}>{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        style={{ width:'100%', padding:'0.5rem 0.75rem',
          border:'1px solid #E5E5E5', borderRadius:8,
          fontSize:'0.88rem', outline:'none', fontFamily:'inherit' }}/>
    </div>
  );
}

function CRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center',
      justifyContent:'space-between', gap:'0.5rem' }}>
      <span style={{ fontSize:'0.75rem', color:'#666', flexShrink:0, minWidth:70 }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>{children}</div>
    </div>
  );
}
