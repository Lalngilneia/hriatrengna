'use strict';
const QRCode     = require('qrcode');
const PDFDocument = require('pdfkit');
const { createCanvas, loadImage } = require('canvas');

// ── COLOUR PRESETS ────────────────────────────────────────────
const THEMES = {
  classic:     { bg: '#FAF7F2', fg: '#2C1810', accent: '#C9A84C', qrDark: '#2C1810', qrLight: '#FAF7F2' },
  dark:        { bg: '#1A1A1A', fg: '#F4F4F4', accent: '#C9A84C', qrDark: '#F4F4F4', qrLight: '#1A1A1A' },
  floral:      { bg: '#FFF0F5', fg: '#5C2D4E', accent: '#E8A0BF', qrDark: '#5C2D4E', qrLight: '#FFF0F5' },
  traditional: { bg: '#FDF5E6', fg: '#4A2C0A', accent: '#8B4513', qrDark: '#4A2C0A', qrLight: '#FDF5E6' },
  minimal:     { bg: '#FFFFFF', fg: '#111111', accent: '#888888', qrDark: '#111111', qrLight: '#FFFFFF' },
};

// ── FORMAT DATE RANGE ─────────────────────────────────────────
function formatDates(birthDate, deathDate, birthYear, deathYear) {
  const fmt = (d, y) => {
    if (d) return new Date(d).getFullYear().toString();
    if (y) return y.toString();
    return null;
  };
  const b = fmt(birthDate, birthYear);
  const d = fmt(deathDate, deathYear);
  if (b && d) return `${b} – ${d}`;
  if (b)      return `Born ${b}`;
  if (d)      return `${d}`;
  return '';
}

// ── GENERATE QR PLAQUE AS PNG BUFFER ─────────────────────────
async function generatePlaquePNG({ albumUrl, name, dates, theme = 'classic', width = 800 }) {
  const t       = THEMES[theme] || THEMES.classic;
  const height  = Math.round(width * 1.25);   // portrait ratio
  const canvas  = createCanvas(width, height);
  const ctx     = canvas.getContext('2d');
  const pad     = Math.round(width * 0.06);

  // Background
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);

  // Top accent bar
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, width, Math.round(height * 0.007));

  // QR Code (centre of plaque)
  const qrSize   = Math.round(width * 0.55);
  const qrBuffer = await QRCode.toBuffer(albumUrl, {
    type:               'png',
    color:              { dark: t.qrDark, light: t.qrLight },
    margin:             2,
    width:              qrSize,
    errorCorrectionLevel: 'H',
  });

  const qrImg = await loadImage(qrBuffer);
  const qrX   = Math.round((width - qrSize) / 2);
  const qrY   = Math.round(height * 0.25);

  // QR border/frame
  const framePad = 16;
  roundedRect(ctx, qrX - framePad, qrY - framePad, qrSize + framePad * 2, qrSize + framePad * 2, 16, t.accent, null, 3);
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // ✦ decoration above name
  const headerY = Math.round(height * 0.1);
  ctx.fillStyle  = t.accent;
  ctx.font       = `${Math.round(width * 0.04)}px serif`;
  ctx.textAlign  = 'center';
  ctx.fillText('✦', width / 2, headerY);

  // "In Loving Memory" subtitle
  ctx.fillStyle = t.fg;
  ctx.font      = `italic ${Math.round(width * 0.035)}px serif`;
  ctx.fillText('In Loving Memory', width / 2, headerY + Math.round(width * 0.06));

  // Name
  ctx.fillStyle  = t.fg;
  const nameFontSize = Math.round(width * (name.length > 20 ? 0.055 : 0.07));
  ctx.font       = `bold ${nameFontSize}px serif`;
  wrapText(ctx, name, width / 2, headerY + Math.round(width * 0.13), width - pad * 2, nameFontSize * 1.3);

  // Dates
  if (dates) {
    const dateY = qrY + qrSize + framePad + Math.round(height * 0.04);
    ctx.fillStyle = t.accent;
    ctx.font      = `${Math.round(width * 0.04)}px serif`;
    ctx.fillText(dates, width / 2, dateY);
  }

  // URL hint at bottom
  const urlText = albumUrl.replace('https://', '');
  ctx.fillStyle  = t.fg + '99'; // semi-transparent
  ctx.font       = `${Math.round(width * 0.022)}px sans-serif`;
  ctx.fillText(urlText, width / 2, height - Math.round(height * 0.04));

  // Bottom accent bar
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, height - Math.round(height * 0.007), width, Math.round(height * 0.007));

  return canvas.toBuffer('image/png');
}

// ── GENERATE QR PLAQUE AS PDF (A5 print-ready) ───────────────
async function generatePlaquePDF({ albumUrl, name, dates, theme = 'classic' }) {
  const pngBuffer = await generatePlaquePNG({ albumUrl, name, dates, theme, width: 1200 });

  return new Promise((resolve, reject) => {
    // A5 size in points: 419.53 x 595.28
    const doc    = new PDFDocument({ size: 'A5', margin: 0 });
    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.image(pngBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
    doc.end();
  });
}

// ── CANVAS HELPERS ─────────────────────────────────────────────
function roundedRect(ctx, x, y, w, h, r, fillColor, strokeColor, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fillColor)  { ctx.fillStyle = fillColor; ctx.fill(); }
  if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line    = '';
  let posY    = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, posY);
      line  = word;
      posY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, posY);
}

module.exports = { generatePlaquePNG, generatePlaquePDF, formatDates, THEMES };
