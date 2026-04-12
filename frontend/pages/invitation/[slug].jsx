import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const API     = process.env.NEXT_PUBLIC_API_URL   || 'https://api.hriatrengna.in';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL   || 'https://hriatrengna.in';

const FONT_URLS = {
  'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap',
  'Lora':             'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&display=swap',
  'Crimson Pro':      'https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@300;400;500&display=swap',
  'Inter':            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
  'Great Vibes':      'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap',
};

const PATTERNS = {
  none:      '',
  floral:    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M30 30c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10zm-20 0c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10S10 35.5 10 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
  geometric: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M0 0h20v20H0V0zm20 20h20v20H20V20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
  dots:      "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='3' cy='3' r='1.5' fill='%23ffffff' fill-opacity='0.08'/%3E%3C/svg%3E\")",
  waves:     "url(\"data:image/svg+xml,%3Csvg width='80' height='20' viewBox='0 0 80 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 C20 0 40 20 60 10 S80 0 100 10' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
};

function fmtDate(v) {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('en-IN', { weekday:'long',day:'numeric',month:'long',year:'numeric' }); }
  catch { return v; }
}

export default function InvitationPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [inv,        setInv]        = useState(null);
  const [rsvpCounts, setRsvpCounts] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [rsvpName,   setRsvpName]   = useState('');
  const [rsvpEmail,  setRsvpEmail]  = useState('');
  const [attending,  setAttending]  = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [rsvpNote,   setRsvpNote]   = useState('');
  const [rsvpDone,   setRsvpDone]   = useState(false);
  const [rsvpMsg,    setRsvpMsg]    = useState('');
  const [rsvpErr,    setRsvpErr]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/api/public/invitation/${slug}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setInv(d.invitation); setRsvpCounts(d.rsvpCounts||{}); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const theme   = inv?.theme || {};
  const font    = theme.fontFamily  || 'Playfair Display';
  const tc      = theme.textColor   || '#FAF7F2';
  const accent  = theme.accentColor || '#C9A84C';
  const pattern = PATTERNS[theme.pattern] || '';
  const bg      = theme.bgType === 'gradient'
    ? `linear-gradient(135deg, ${theme.bgColor||'#1A0A10'} 0%, ${theme.bgColor2||'#2D1020'} 100%)`
    : (theme.bgColor || '#1A0A10');

  // Save as image — backend generates the PNG (no CORS issues)
  const saveAsImage = async () => {
    if (!slug || saving) return;
    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/public/invitation/${slug}/image`);
      if (!res.ok) throw new Error('Image generation failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `invitation-${slug}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert('Could not generate image. Please try again.'); }
    finally { setSaving(false); }
  };

  const shareWhatsApp = () => {
    const url  = `${APP_URL}/invitation/${slug}`;
    const text = `You're invited! 💍\n${inv?.partner1Name||''} & ${inv?.partner2Name||''}\n${fmtDate(inv?.weddingDate)}\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const submitRsvp = async (e) => {
    e.preventDefault();
    if (!attending) return setRsvpErr('Please select your attendance.');
    if (!rsvpName.trim()) return setRsvpErr('Please enter your name.');
    setSubmitting(true); setRsvpErr('');
    try {
      const r = await fetch(`${API}/api/public/invitation/${slug}/rsvp`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ guestName:rsvpName.trim(), guestEmail:rsvpEmail.trim()||undefined,
          attending, guestCount:parseInt(guestCount)||1, message:rsvpNote.trim()||undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRsvpDone(true); setRsvpMsg(d.message);
    } catch (e) { setRsvpErr(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#1A0A10',color:'#FAF7F2',fontFamily:'Georgia,serif'}}>Loading invitation…</div>
  );
  if (error||!inv) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',background:'#1A0A10',color:'#FAF7F2',fontFamily:'Georgia,serif',
      textAlign:'center',padding:'2rem'}}>
      <div style={{fontSize:'2rem',marginBottom:'1rem'}}>💍</div>
      <p>{error||'Invitation not found.'}</p>
      <a href="/" style={{color:'#C9A84C',marginTop:'1rem',fontSize:'0.9rem'}}>Create your own →</a>
    </div>
  );

  const coupleNames = `${inv.partner1Name||''} & ${inv.partner2Name||''}`.trim();

  return (
    <>
      <Head>
        <title>{coupleNames} — Wedding Invitation</title>
        <meta name="description" content={`You are invited to the wedding of ${coupleNames}`}/>
        <meta property="og:title" content={`${coupleNames} — Wedding Invitation`}/>
        {inv.coverUrl && <meta property="og:image" content={inv.coverUrl}/>}
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        {FONT_URLS[font] && <link rel="stylesheet" href={FONT_URLS[font]}/>}
      </Head>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:${theme.bgColor||'#1A0A10'}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .abtn{cursor:pointer;transition:all 0.2s;font-family:'${font}',Georgia,serif}
        .abtn:hover{opacity:0.85;transform:translateY(-1px)}
      `}</style>

      <div style={{minHeight:'100vh',background:bg,backgroundImage:pattern||undefined,
        display:'flex',flexDirection:'column',alignItems:'center',
        padding:'2rem 1rem 4rem',fontFamily:`'${font}',Georgia,serif`}}>

        {/* Action bar */}
        <div style={{width:'100%',maxWidth:560,display:'flex',
          justifyContent:'flex-end',gap:'0.5rem',marginBottom:'1rem'}}>
          <button onClick={saveAsImage} disabled={saving} className="abtn"
            style={{background:'rgba(255,255,255,0.1)',border:`1px solid ${accent}55`,
              color:tc,borderRadius:100,padding:'0.45rem 1rem',fontSize:'0.78rem',fontWeight:500,
              display:'flex',alignItems:'center',gap:'0.4rem'}}>
            {saving
              ? <><span style={{width:12,height:12,border:`2px solid ${tc}44`,borderTopColor:tc,
                  borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}}/>Generating…</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Save as Image</>
            }
          </button>
          <button onClick={shareWhatsApp} className="abtn"
            style={{background:'#25D366',border:'none',color:'#fff',borderRadius:100,
              padding:'0.45rem 1rem',fontSize:'0.78rem',fontWeight:500,
              display:'flex',alignItems:'center',gap:'0.4rem'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share
          </button>
        </div>

        {/* Invitation card */}
        <div style={{width:'100%',maxWidth:560,background:bg,backgroundImage:pattern||undefined,
          borderRadius:20,overflow:'hidden',
          boxShadow:`0 24px 80px rgba(0,0,0,0.5),0 0 0 1px ${accent}33`,
          animation:'fadeUp 0.5s ease'}}>

          {/* Cover */}
          {inv.coverUrl && (
            <div style={{width:'100%',height:200,overflow:'hidden',position:'relative'}}>
              <img src={inv.coverUrl} alt="Invitation cover image" crossOrigin="anonymous"
                onError={e=>{e.currentTarget.parentElement.style.display='none'}}
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
              <div style={{position:'absolute',inset:0,
                background:`linear-gradient(to bottom,transparent 40%,${theme.bgColor||'#1A0A10'} 100%)`}}/>
            </div>
          )}

          <div style={{padding:'2.5rem 2rem',textAlign:'center',color:tc}}>

            {/* Avatar */}
            <div style={{marginBottom:'1.25rem',display:'flex',justifyContent:'center'}}>
              <div style={{width:120,height:120,borderRadius:'50%',overflow:'hidden',
                border:`3px solid ${accent}88`,
                boxShadow:`0 0 0 6px ${accent}18,0 8px 32px rgba(0,0,0,0.4)`,
                background:`${accent}22`,display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'2.5rem'}}>
                {inv.avatarUrl
                  ? <img src={inv.avatarUrl} alt={coupleNames} crossOrigin="anonymous"
                      onError={e=>{e.currentTarget.style.display='none';
                        e.currentTarget.parentElement.textContent='💍'}}
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                  : '💍'}
              </div>
            </div>

            <p style={{fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',
              color:accent,marginBottom:'0.6rem',opacity:0.9}}>✦ Together We Begin ✦</p>

            <h1 style={{fontFamily:`'${font}',Georgia,serif`,
              fontSize:'clamp(1.8rem,7vw,2.8rem)',fontWeight:700,lineHeight:1.15,
              color:tc,marginBottom:'0.4rem'}}>
              {inv.partner1Name||'Partner 1'}
              <span style={{color:accent,margin:'0 0.5rem',fontStyle:'italic'}}>&amp;</span>
              {inv.partner2Name||'Partner 2'}
            </h1>

            <p style={{fontSize:'0.8rem',color:`${tc}88`,marginBottom:'1.5rem',letterSpacing:'0.05em'}}>
              request the pleasure of your company
            </p>

            <div style={{width:80,height:1,background:accent,opacity:0.5,margin:'0 auto 1.5rem'}}/>

            {inv.weddingDate && (
              <div style={{marginBottom:'1.25rem'}}>
                <div style={{fontSize:'0.7rem',letterSpacing:'0.15em',textTransform:'uppercase',
                  color:accent,marginBottom:'0.3rem',opacity:0.8}}>Date</div>
                <div style={{fontSize:'1.05rem',fontWeight:600,color:tc}}>📅 {fmtDate(inv.weddingDate)}</div>
              </div>
            )}

            {(inv.ceremonyTime||inv.ceremonyVenue) && (
              <div style={{background:`${accent}12`,border:`1px solid ${accent}30`,borderRadius:12,
                padding:'1rem 1.25rem',marginBottom:'0.75rem',textAlign:'left'}}>
                <div style={{fontSize:'0.68rem',letterSpacing:'0.15em',textTransform:'uppercase',
                  color:accent,marginBottom:'0.4rem',opacity:0.9}}>Ceremony</div>
                {inv.ceremonyTime  && <div style={{fontSize:'0.95rem',color:tc,marginBottom:'0.2rem'}}>⏰ {inv.ceremonyTime}</div>}
                {inv.ceremonyVenue && <div style={{fontSize:'0.88rem',color:`${tc}cc`}}>📍 {inv.ceremonyVenue}</div>}
              </div>
            )}

            {(inv.receptionTime||inv.receptionVenue) && (
              <div style={{background:`${accent}08`,border:`1px solid ${accent}20`,borderRadius:12,
                padding:'1rem 1.25rem',marginBottom:'0.75rem',textAlign:'left'}}>
                <div style={{fontSize:'0.68rem',letterSpacing:'0.15em',textTransform:'uppercase',
                  color:accent,marginBottom:'0.4rem',opacity:0.9}}>Reception</div>
                {inv.receptionTime  && <div style={{fontSize:'0.95rem',color:tc,marginBottom:'0.2rem'}}>⏰ {inv.receptionTime}</div>}
                {inv.receptionVenue && <div style={{fontSize:'0.88rem',color:`${tc}cc`}}>📍 {inv.receptionVenue}</div>}
              </div>
            )}

            {inv.dressCode && (
              <p style={{fontSize:'0.85rem',color:`${tc}bb`,marginBottom:'0.75rem',fontStyle:'italic'}}>
                👗 Dress Code: {inv.dressCode}
              </p>
            )}

            {inv.invitationNote && (
              <>
                <div style={{width:80,height:1,background:accent,opacity:0.3,margin:'1.25rem auto'}}/>
                <p style={{fontSize:'0.95rem',lineHeight:1.7,color:`${tc}cc`,
                  fontStyle:'italic',maxWidth:380,margin:'0 auto 1.25rem'}}>
                  "{inv.invitationNote}"
                </p>
              </>
            )}

            {inv.mapUrl && (
              <a href={inv.mapUrl} target="_blank" rel="noopener noreferrer"
                style={{display:'inline-flex',alignItems:'center',gap:'0.4rem',color:accent,
                  fontSize:'0.82rem',marginBottom:'1.25rem',textDecoration:'none',
                  borderBottom:`1px solid ${accent}44`,paddingBottom:'0.1rem'}}>
                🗺 View on Map
              </a>
            )}

            <div style={{width:80,height:1,background:accent,opacity:0.3,margin:'1.25rem auto'}}/>

            {inv.qrDataUrl && (
              <div style={{marginBottom:'1.25rem'}}>
                <div style={{fontSize:'0.68rem',letterSpacing:'0.15em',textTransform:'uppercase',
                  color:accent,marginBottom:'0.75rem',opacity:0.8}}>Scan to View Our Wedding Album</div>
                <div style={{display:'inline-block',background:'#fff',borderRadius:12,padding:'0.75rem',
                  boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>
                  <img src={inv.qrDataUrl} alt="QR Code" style={{width:160,height:160,display:'block'}}/>
                </div>
                <div style={{fontSize:'0.72rem',color:`${tc}55`,marginTop:'0.5rem'}}>
                  hriatrengna.in/wedding/{slug}
                </div>
              </div>
            )}

            <a href={inv.albumUrl} target="_blank" rel="noopener noreferrer"
              style={{display:'inline-flex',alignItems:'center',gap:'0.4rem',
                background:`${accent}22`,border:`1px solid ${accent}55`,color:accent,
                borderRadius:100,padding:'0.5rem 1.25rem',fontSize:'0.82rem',
                textDecoration:'none',fontWeight:600}}>
              💍 View Wedding Album →
            </a>

            <div style={{marginTop:'2rem',paddingTop:'1rem',borderTop:`1px solid ${accent}22`,
              fontSize:'0.65rem',color:`${tc}44`,letterSpacing:'0.1em',textTransform:'uppercase'}}>
              Hriatrengna · Preserve &amp; Honour
            </div>
          </div>
        </div>

        {/* RSVP section */}
        {inv.rsvpEnabled && (
          <div style={{width:'100%',maxWidth:560,marginTop:'1.5rem',
            background:`${theme.bgColor||'#1A0A10'}ee`,border:`1px solid ${accent}30`,
            borderRadius:16,padding:'1.5rem',color:tc}}>
            {rsvpDone ? (
              <div style={{textAlign:'center',padding:'1rem'}}>
                <div style={{fontSize:'2rem',marginBottom:'0.5rem'}}>
                  {attending==='yes'?'🎉':attending==='no'?'🙏':'💭'}
                </div>
                <p style={{color:accent,fontWeight:600}}>{rsvpMsg}</p>
              </div>
            ) : (
              <>
                <h2 style={{fontSize:'1.1rem',marginBottom:'0.75rem',color:tc}}>RSVP</h2>
                <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
                  {[{id:'yes',label:'✓ Accept',color:'#22c55e'},{id:'no',label:'✗ Decline',color:'#ef4444'},{id:'maybe',label:'◎ Maybe',color:accent}].map(o=>(
                    <button key={o.id} onClick={()=>setAttending(o.id)}
                      style={{flex:1,padding:'0.5rem 0.25rem',border:`1.5px solid ${attending===o.id?o.color:`${tc}22`}`,
                        borderRadius:8,background:attending===o.id?`${o.color}18`:'transparent',
                        color:attending===o.id?o.color:`${tc}88`,fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div style={{display:'grid',gap:'0.6rem'}}>
                  <input placeholder="Your name *" value={rsvpName} onChange={e=>setRsvpName(e.target.value)}
                    style={{width:'100%',padding:'0.6rem 0.85rem',background:`${tc}08`,
                      border:`1px solid ${tc}20`,borderRadius:8,color:tc,fontSize:'0.88rem',outline:'none'}}/>
                  <input type="email" placeholder="Email (optional)" value={rsvpEmail} onChange={e=>setRsvpEmail(e.target.value)}
                    style={{width:'100%',padding:'0.6rem 0.85rem',background:`${tc}08`,
                      border:`1px solid ${tc}20`,borderRadius:8,color:tc,fontSize:'0.88rem',outline:'none'}}/>
                  {attending==='yes' && (
                    <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                      <label style={{fontSize:'0.8rem',color:`${tc}88`,flexShrink:0}}>Guests:</label>
                      <select value={guestCount} onChange={e=>setGuestCount(e.target.value)}
                        style={{padding:'0.5rem 0.75rem',background:`${tc}08`,border:`1px solid ${tc}20`,
                          borderRadius:8,color:tc,fontSize:'0.88rem',outline:'none'}}>
                        {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}
                  <textarea placeholder="Message (optional)" value={rsvpNote} onChange={e=>setRsvpNote(e.target.value)}
                    rows={2} maxLength={500}
                    style={{width:'100%',padding:'0.6rem 0.85rem',background:`${tc}08`,
                      border:`1px solid ${tc}20`,borderRadius:8,color:tc,fontSize:'0.88rem',
                      outline:'none',resize:'vertical'}}/>
                </div>
                {rsvpErr && <p style={{color:'#ef4444',fontSize:'0.8rem',marginTop:'0.5rem'}}>{rsvpErr}</p>}
                <button onClick={submitRsvp} disabled={submitting}
                  style={{width:'100%',marginTop:'0.75rem',padding:'0.75rem',
                    background:submitting?`${accent}66`:accent,color:'#1a1a1a',border:'none',
                    borderRadius:100,fontWeight:700,fontSize:'0.9rem',
                    cursor:submitting?'not-allowed':'pointer'}}>
                  {submitting?'Sending…':'Send RSVP'}
                </button>
              </>
            )}
          </div>
        )}

        <a href="/" style={{marginTop:'2rem',color:`${tc}33`,fontSize:'0.7rem',textDecoration:'none'}}>
          Powered by Hriatrengna
        </a>
      </div>
    </>
  );
}
