'use strict';
const db      = require('../utils/db');
const qrcode  = require('qrcode');
const https   = require('https');
const http    = require('http');
const r2      = require('../services/r2.service');
const { sanitizePlainText } = require('../utils/content-sanitizer');
const { getPublicAccessState } = require('../utils/public-access');

const APP_URL = process.env.APP_URL       || 'https://hriatrengna.in';
const CDN     = process.env.R2_PUBLIC_URL || 'https://cdn.hriatrengna.in';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const clamp   = (n, a, b) => Math.min(Math.max(parseInt(n)||a, a), b);

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    (url.startsWith('https') ? https : http).get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generateQrDataUrl(url) {
  return qrcode.toDataURL(url, { errorCorrectionLevel:'M', margin:2, width:300,
    color:{ dark:'#1a1a1a', light:'#ffffff' } });
}

function buildInv(album, qrDataUrl) {
  const t = album.invitation_theme || {};
  return {
    id: album.id, slug: album.slug,
    partner1Name: album.partner1_name, partner2Name: album.partner2_name,
    weddingDate: album.wedding_date,
    ceremonyTime: album.ceremony_time,   receptionTime: album.reception_time,
    ceremonyVenue: album.ceremony_venue || album.venue_name,
    receptionVenue: album.reception_venue,
    dressCode: album.dress_code,  mapUrl: album.map_url,
    invitationNote: album.invitation_note,
    rsvpEnabled: album.rsvp_enabled || false, rsvpDeadline: album.rsvp_deadline,
    avatarKey: album.avatar_key || null,   coverKey: album.cover_key || null,
    avatarUrl: album.avatar_key ? `${CDN}/${album.avatar_key}` : null,
    coverUrl:  album.cover_key  ? `${CDN}/${album.cover_key}`  : null,
    albumUrl:  `${APP_URL}/wedding/${album.slug}`, qrDataUrl,
    theme: {
      bgColor:     t.bgColor     || '#1A0A10', bgType:  t.bgType      || 'solid',
      bgColor2:    t.bgColor2    || '#2D1020', textColor: t.textColor || '#FAF7F2',
      accentColor: t.accentColor || '#C9A84C', fontFamily:t.fontFamily||'Playfair Display',
      pattern:     t.pattern     || 'none',
    },
  };
}

// ── PUBLIC: GET INVITATION ────────────────────────────────────
exports.getInvitation = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(404).json({ error:'Not found.' });
    const r = await db.query(
      `SELECT a.*, u.subscription_status, u.grace_period_until
       FROM albums a JOIN users u ON u.id=a.user_id
       WHERE a.slug=$1 AND a.type='wedding'
         AND a.invitation_enabled=TRUE AND a.is_published=TRUE`, [slug]);
    const album = r.rows[0];
    if (!album) return res.status(404).json({ error:'Invitation not found.' });
    const access = await getPublicAccessState({
      ownerStatus: album.subscription_status,
      ownerGracePeriodUntil: album.grace_period_until,
      studioId: album.studio_id,
    });
    if (!access.hasAccess)
      return res.status(403).json({ error:'Invitation unavailable.' });
    const qr = await generateQrDataUrl(`${APP_URL}/wedding/${slug}`);
    const rsvpCounts = { yes:0, no:0, maybe:0, total:0 };
    if (album.rsvp_enabled) {
      const cr = await db.query(
        `SELECT attending, COUNT(*)::int AS c, SUM(guest_count)::int AS g
         FROM rsvps WHERE album_id=$1 GROUP BY attending`, [album.id]);
      for (const row of cr.rows) { rsvpCounts[row.attending]=row.c; rsvpCounts.total+=row.g||row.c; }
    }
    res.json({ invitation: buildInv(album, qr), rsvpCounts });
  } catch(err){ next(err); }
};

// ── PUBLIC: GENERATE IMAGE (server-side canvas — no CORS issues) ──────────────
exports.generateImage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(404).json({ error:'Not found.' });
    const r = await db.query(
      `SELECT a.*, u.subscription_status, u.grace_period_until FROM albums a JOIN users u ON u.id=a.user_id
       WHERE a.slug=$1 AND a.type='wedding'
         AND a.invitation_enabled=TRUE AND a.is_published=TRUE`, [slug]);
    const album = r.rows[0];
    if (!album) return res.status(404).json({ error:'Invitation not found.' });
    const access = await getPublicAccessState({
      ownerStatus: album.subscription_status,
      ownerGracePeriodUntil: album.grace_period_until,
      studioId: album.studio_id,
    });
    if (!access.hasAccess) return res.status(403).json({ error:'Invitation unavailable.' });

    let createCanvas, loadImage;
    try { ({ createCanvas, loadImage } = require('canvas')); }
    catch { return res.status(503).json({ error:'Image generation unavailable.' }); }

    const t = album.invitation_theme || {};
    const bg      = t.bgColor     || '#1A0A10';
    const bg2     = t.bgColor2    || '#2D1020';
    const tc      = t.textColor   || '#FAF7F2';
    const accent  = t.accentColor || '#C9A84C';
    const isGrad  = t.bgType === 'gradient';
    const W=1080, H=1920;
    const canvas  = createCanvas(W, H);
    const ctx     = canvas.getContext('2d');

    // Background
    if (isGrad) {
      const g = ctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0,bg); g.addColorStop(1,bg2); ctx.fillStyle=g;
    } else { ctx.fillStyle=bg; }
    ctx.fillRect(0,0,W,H);

    let y = 80;

    // Cover photo
    if (album.cover_key) {
      try {
        const img = await loadImage(await fetchBuffer(`${CDN}/${album.cover_key}`));
        const bH=400; ctx.drawImage(img,0,0,W,bH);
        const fade=ctx.createLinearGradient(0,bH-120,0,bH);
        fade.addColorStop(0,'rgba(0,0,0,0)'); fade.addColorStop(1,bg);
        ctx.fillStyle=fade; ctx.fillRect(0,bH-120,W,120);
        y = bH - 60;
      } catch { y = 80; }
    }

    // Avatar
    const aR=110, aX=W/2, aY=y+aR+20;
    if (album.avatar_key) {
      try {
        const img = await loadImage(await fetchBuffer(`${CDN}/${album.avatar_key}`));
        ctx.save(); ctx.beginPath(); ctx.arc(aX,aY,aR,0,Math.PI*2); ctx.clip();
        ctx.drawImage(img,aX-aR,aY-aR,aR*2,aR*2); ctx.restore();
        ctx.beginPath(); ctx.arc(aX,aY,aR+4,0,Math.PI*2);
        ctx.strokeStyle=accent+'cc'; ctx.lineWidth=4; ctx.stroke();
      } catch {
        ctx.beginPath(); ctx.arc(aX,aY,aR,0,Math.PI*2);
        ctx.fillStyle=accent+'22'; ctx.fill();
        ctx.strokeStyle=accent+'88'; ctx.lineWidth=3; ctx.stroke();
      }
    }
    y = aY + aR + 60;

    ctx.textAlign='center';
    ctx.fillStyle=accent;
    ctx.font='600 30px serif';
    ctx.fillText('✦  Together We Begin  ✦', W/2, y); y+=65;

    const p1=album.partner1_name||'', p2=album.partner2_name||'';
    ctx.fillStyle=tc; ctx.font='bold 80px serif';
    if ((p1+p2).length < 20) {
      ctx.fillText(`${p1}  &  ${p2}`, W/2, y); y+=90;
    } else {
      ctx.fillText(p1, W/2, y); y+=90;
      ctx.fillStyle=accent; ctx.font='italic bold 72px serif';
      ctx.fillText('&', W/2, y); y+=80;
      ctx.fillStyle=tc; ctx.font='bold 80px serif';
      ctx.fillText(p2, W/2, y); y+=90;
    }

    ctx.fillStyle=tc+'99'; ctx.font='34px serif';
    ctx.fillText('request the pleasure of your company', W/2, y); y+=60;

    ctx.strokeStyle=accent+'55'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(W/2-90,y); ctx.lineTo(W/2+90,y); ctx.stroke(); y+=50;

    if (album.wedding_date) {
      const ds = new Date(album.wedding_date).toLocaleDateString('en-IN',
        {weekday:'long',day:'numeric',month:'long',year:'numeric'});
      ctx.fillStyle=tc; ctx.font='600 40px serif';
      ctx.fillText('📅  '+ds, W/2, y); y+=65;
    }

    // Box helper
    const box = (label, line1, line2) => {
      if (!line1 && !line2) return;
      const bH = line1 && line2 ? 155 : 100;
      ctx.fillStyle=accent+'14'; ctx.strokeStyle=accent+'33'; ctx.lineWidth=1.5;
      rr(ctx,110,y,W-220,bH,18); ctx.fill(); ctx.stroke();
      ctx.fillStyle=accent; ctx.font='600 26px serif'; ctx.textAlign='left';
      ctx.fillText(label, 146, y+36);
      ctx.fillStyle=tc; ctx.font='36px serif';
      if (line1) ctx.fillText(line1, 146, y+80);
      if (line2) ctx.fillText(line2.slice(0,42), 146, line1?y+124:y+80);
      ctx.textAlign='center'; y+=bH+30;
    };
    box('CEREMONY',
      album.ceremony_time  ? '⏰  '+album.ceremony_time  : '',
      album.ceremony_venue ? '📍  '+album.ceremony_venue : '');
    box('RECEPTION',
      album.reception_time  ? '⏰  '+album.reception_time  : '',
      album.reception_venue ? '📍  '+album.reception_venue : '');

    if (album.dress_code) {
      ctx.fillStyle=tc+'aa'; ctx.font='italic 34px serif';
      ctx.fillText('👗  Dress Code: '+album.dress_code, W/2, y); y+=55;
    }
    if (album.invitation_note) {
      ctx.fillStyle=tc+'bb'; ctx.font='italic 34px serif';
      wt(ctx,`"${album.invitation_note}"`, W/2, y, W-260, 48); y+=55;
    }

    // QR code
    const qrDU = await generateQrDataUrl(`${APP_URL}/wedding/${slug}`);
    const qrImg = await loadImage(Buffer.from(qrDU.split(',')[1],'base64'));
    const qS=220, qX=W/2-qS/2;
    ctx.fillStyle='#ffffff'; ctx.strokeStyle=accent+'44'; ctx.lineWidth=2;
    rr(ctx,qX-16,y-8,qS+32,qS+70,16); ctx.fill(); ctx.stroke();
    ctx.drawImage(qrImg,qX,y,qS,qS);
    ctx.fillStyle='#777'; ctx.font='24px sans-serif';
    ctx.fillText('Scan to view our wedding album', W/2, y+qS+44); y+=qS+90;

    ctx.fillStyle=tc+'33'; ctx.font='24px sans-serif';
    ctx.fillText('Hriatrengna · Preserve & Honour', W/2, Math.max(y+20, H-60));

    const names = `${p1}-${p2}`.replace(/\s+/g,'-').toLowerCase()||'invitation';
    res.setHeader('Content-Type','image/png');
    res.setHeader('Content-Disposition',`attachment; filename="invitation-${names}.png"`);
    res.setHeader('Cache-Control','public, max-age=300');
    canvas.createPNGStream({ compressionLevel:6 }).pipe(res);
  } catch(err){ next(err); }
};

function rr(ctx,x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
function wt(ctx,text,x,y,mw,lh){
  const words=text.split(' '); let line='', ly=y;
  for(const w of words){ const t=line+w+' ';
    if(ctx.measureText(t).width>mw&&line!==''){ctx.fillText(line.trim(),x,ly);line=w+' ';ly+=lh;}
    else line=t; }
  if(line.trim()) ctx.fillText(line.trim(),x,ly);
}

// ── AUTHENTICATED: UPLOAD AVATAR ──────────────────────────────
exports.uploadInvitationAvatar = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error:'No file uploaded.' });
    const ar = await db.query(
      'SELECT id, avatar_key, type FROM albums WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!ar.rows.length) return res.status(404).json({ error:'Album not found.' });
    if (ar.rows[0].type !== 'wedding') return res.status(400).json({ error:'Wedding albums only.' });
    if (ar.rows[0].avatar_key) await r2.deleteFile(ar.rows[0].avatar_key).catch(()=>{});
    const { key, url } = await r2.uploadFile({
      buffer:req.file.buffer, mimetype:req.file.mimetype,
      originalname:req.file.originalname, albumId:id, type:'photo' });
    await db.query('UPDATE albums SET avatar_key=$1 WHERE id=$2', [key, id]);
    res.json({ key, url, message:'Profile photo updated.' });
  } catch(err){ next(err); }
};

// ── AUTHENTICATED: UPLOAD COVER ───────────────────────────────
exports.uploadInvitationCover = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error:'No file uploaded.' });
    const ar = await db.query(
      'SELECT id, cover_key, type FROM albums WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!ar.rows.length) return res.status(404).json({ error:'Album not found.' });
    if (ar.rows[0].type !== 'wedding') return res.status(400).json({ error:'Wedding albums only.' });
    if (ar.rows[0].cover_key) await r2.deleteFile(ar.rows[0].cover_key).catch(()=>{});
    const { key, url } = await r2.uploadFile({
      buffer:req.file.buffer, mimetype:req.file.mimetype,
      originalname:req.file.originalname, albumId:id, type:'photo' });
    await db.query('UPDATE albums SET cover_key=$1 WHERE id=$2', [key, id]);
    res.json({ key, url, message:'Cover photo updated.' });
  } catch(err){ next(err); }
};

// ── PUBLIC: SUBMIT RSVP ───────────────────────────────────────
exports.submitRsvp = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { guestName, guestEmail, attending, guestCount, message } = req.body;
    if (!guestName?.trim()) return res.status(400).json({ error:'Your name is required.' });
    if (!['yes','no','maybe'].includes(attending))
      return res.status(400).json({ error:'Please select attending status.' });
    if (guestEmail && !isEmail(guestEmail))
      return res.status(400).json({ error:'Invalid email address.' });
    const ar = await db.query(
      `SELECT a.id, a.rsvp_enabled, a.rsvp_deadline, a.studio_id,
              u.subscription_status, u.grace_period_until
       FROM albums a
       JOIN users u ON u.id = a.user_id
       WHERE a.slug=$1 AND a.type='wedding' AND a.is_published=TRUE`, [slug]);
    const album = ar.rows[0];
    if (!album) return res.status(404).json({ error:'Invitation not found.' });
    const access = await getPublicAccessState({
      ownerStatus: album.subscription_status,
      ownerGracePeriodUntil: album.grace_period_until,
      studioId: album.studio_id,
    });
    if (!access.hasAccess) return res.status(403).json({ error:'Invitation unavailable.' });
    if (!album.rsvp_enabled) return res.status(403).json({ error:'RSVPs not enabled.' });
    if (album.rsvp_deadline && new Date(album.rsvp_deadline) < new Date())
      return res.status(400).json({ error:'RSVP deadline has passed.' });
    await db.query(
      `INSERT INTO rsvps (album_id,guest_name,guest_email,attending,guest_count,message,ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (album_id,guest_email) WHERE guest_email IS NOT NULL
       DO UPDATE SET attending=EXCLUDED.attending,guest_count=EXCLUDED.guest_count,
                     message=EXCLUDED.message,created_at=NOW()`,
      [album.id, sanitizePlainText(guestName,100),
       guestEmail?guestEmail.toLowerCase().trim():null,
       attending, clamp(guestCount,1,20),
       message?sanitizePlainText(message,500):null, req.ip]);
    const labels={yes:'See you there! 🎉',no:'Thank you for letting us know.',maybe:'We hope to see you!'};
    res.json({ message: labels[attending] });
  } catch(err){ next(err); }
};

// ── AUTHENTICATED: UPDATE INVITATION ─────────────────────────
exports.updateInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { invitationEnabled,rsvpEnabled,rsvpDeadline,
            ceremonyTime,receptionTime,ceremonyVenue,receptionVenue,
            dressCode,mapUrl,invitationNote,theme } = req.body;
    const ar = await db.query(
      'SELECT id,type FROM albums WHERE id=$1 AND user_id=$2',[id,req.userId]);
    if (!ar.rows.length) return res.status(404).json({ error:'Album not found.' });
    if (ar.rows[0].type!=='wedding')
      return res.status(400).json({ error:'Wedding albums only.' });
    const s=(v,m)=>v!==undefined?sanitizePlainText(String(v),m):undefined;
    let safeTheme;
    if (theme&&typeof theme==='object') {
      const h=/^#[0-9A-Fa-f]{6}$/;
      const fFonts=['Playfair Display','Lora','Crimson Pro','Inter','Great Vibes'];
      const fPat=['none','floral','geometric','dots','waves'];
      safeTheme={
        bgColor:h.test(theme.bgColor)?theme.bgColor:'#1A0A10',
        bgType:['solid','gradient'].includes(theme.bgType)?theme.bgType:'solid',
        bgColor2:h.test(theme.bgColor2)?theme.bgColor2:'#2D1020',
        textColor:h.test(theme.textColor)?theme.textColor:'#FAF7F2',
        accentColor:h.test(theme.accentColor)?theme.accentColor:'#C9A84C',
        fontFamily:fFonts.includes(theme.fontFamily)?theme.fontFamily:'Playfair Display',
        pattern:fPat.includes(theme.pattern)?theme.pattern:'none',
      };
    }
    const fields=[
      {col:'invitation_enabled',val:typeof invitationEnabled==='boolean'?invitationEnabled:undefined},
      {col:'rsvp_enabled',val:typeof rsvpEnabled==='boolean'?rsvpEnabled:undefined},
      {col:'rsvp_deadline',val:rsvpDeadline||null},
      {col:'ceremony_time',val:s(ceremonyTime,20)},
      {col:'reception_time',val:s(receptionTime,20)},
      {col:'ceremony_venue',val:s(ceremonyVenue,300)},
      {col:'reception_venue',val:s(receptionVenue,300)},
      {col:'dress_code',val:s(dressCode,150)},
      {col:'map_url',val:mapUrl?s(mapUrl,500):null},
      {col:'invitation_note',val:s(invitationNote,1000)},
      {col:'invitation_theme',val:safeTheme?JSON.stringify(safeTheme):undefined},
    ].filter(f=>f.val!==undefined);
    if (!fields.length) return res.status(400).json({ error:'No fields to update.' });
    const sc=fields.map((f,i)=>`${f.col}=$${i+1}`).join(', ');
    const vals=[...fields.map(f=>f.val),id];
    const upd=await db.query(`UPDATE albums SET ${sc},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals);
    const u=upd.rows[0];
    res.json({message:'Saved.',invitation:{invitationEnabled:u.invitation_enabled,
      invitationUrl:`${APP_URL}/invitation/${u.slug}`}});
  } catch(err){ next(err); }
};

// ── AUTHENTICATED: LIST RSVPs ─────────────────────────────────
exports.listRsvps = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ar = await db.query('SELECT id FROM albums WHERE id=$1 AND user_id=$2',[id,req.userId]);
    if (!ar.rows.length) return res.status(404).json({ error:'Album not found.' });
    const result = await db.query(
      `SELECT id,guest_name,guest_email,attending,guest_count,message,created_at
       FROM rsvps WHERE album_id=$1 ORDER BY created_at DESC`,[id]);
    const rows=result.rows;
    const att=rows.filter(r=>r.attending==='yes');
    res.json({ rsvps:rows, summary:{
      total:rows.length, attending:att.length,
      declined:rows.filter(r=>r.attending==='no').length,
      maybe:rows.filter(r=>r.attending==='maybe').length,
      totalGuests:att.reduce((s,r)=>s+(r.guest_count||1),0),
    }});
  } catch(err){ next(err); }
};

// ── AUTHENTICATED: DELETE RSVP ────────────────────────────────
exports.deleteRsvp = async (req, res, next) => {
  try {
    const { id, rsvpId } = req.params;
    const ar = await db.query(
      `SELECT a.id FROM albums a JOIN rsvps r ON r.album_id=a.id
       WHERE a.id=$1 AND a.user_id=$2 AND r.id=$3`,[id,req.userId,rsvpId]);
    if (!ar.rows.length) return res.status(404).json({ error:'RSVP not found.' });
    await db.query('DELETE FROM rsvps WHERE id=$1',[rsvpId]);
    res.json({ message:'Removed.' });
  } catch(err){ next(err); }
};
