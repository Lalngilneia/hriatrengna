'use strict';
const PDFDocument = require('pdfkit');
const db          = require('../utils/db');
const path = require('path');

// ── COLOUR PALETTE (matches Hriatrengna brand) ─────────────────
const BROWN  = '#2C1810';
const GOLD   = '#C9A84C';
const TAN    = '#FAF7F2';
const MUTED  = '#6B4F3A';

// ── FORMAT INR ───────────────────────────────────────────────
const fmtINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

// ── FORMAT DATE ──────────────────────────────────────────────
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
//---------LOGO
const logoPath = path.join(__dirname, '../../../frontend/public/icons/icon-192.png');


// ── CREATE INVOICE RECORD IN DB ──────────────────────────────
// Derive human-readable plan description from slug
function planDescription(plan) {
  const map = {
    'lifetime':         'Memorial Lifetime Plan',
    'wedding-lifetime': 'Wedding Lifetime Plan',
    'wedding-premium':  'Wedding Premium Plan',
    'wedding-classic':  'Wedding Classic Plan',
    'wedding-basic':    'Wedding Basic Plan',
    'yearly':           'Memorial Yearly Plan',
    'monthly':          'Memorial Monthly Plan',
  };
  return map[plan] || 'Hriatrengna Subscription';
}

async function createInvoiceRecord({ userId, transactionId, amountInr, plan, userName, userEmail }) {
  const description = planDescription(plan);
  const result = await db.query(
    `INSERT INTO invoices
       (user_id, transaction_id, amount_inr, plan, description, user_name, user_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (transaction_id) DO UPDATE SET
       amount_inr  = EXCLUDED.amount_inr,
       plan        = EXCLUDED.plan,
       description = EXCLUDED.description,
       user_name   = EXCLUDED.user_name,
       user_email  = EXCLUDED.user_email
     RETURNING *`,
    [userId, transactionId, amountInr, plan, description, userName, userEmail]
  ).catch(async () => {
    // Fallback: plain insert without ON CONFLICT (if unique index not yet created)
    return db.query(
      `INSERT INTO invoices (user_id, transaction_id, amount_inr, plan, description, user_name, user_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, transactionId, amountInr, plan, description, userName, userEmail]
    ).catch(() => ({ rows: [] }));
  });
  return result.rows[0];
}

// ── GENERATE PDF BUFFER ──────────────────────────────────────
function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW  = doc.page.width;
    const margin = 50;
    const contentW = pageW - margin * 2;

    // ── HEADER BACKGROUND ─────────────────────────────────
    doc.rect(0, 0, pageW, 110).fill(BROWN);

    // Brand name
    doc.fontSize(22).fillColor(TAN).font('Helvetica-Bold')
       .text('Hriatrengna', margin, 35, { align: 'left' });

    doc.image(logoPath, (pageW - 60) / 2, 25, { width: 60 });

    // "INVOICE" label top-right
    doc.fontSize(12).fillColor(GOLD).font('Helvetica-Bold')
       .text('INVOICE', margin, 40, { align: 'right' });

    // Invoice number & date
    doc.fontSize(9).fillColor(TAN).font('Helvetica')
       .text(`Invoice #${invoice.invoice_number}`, margin, 60, { align: 'right' })
       .text(`Date: ${fmtDate(invoice.issued_at || invoice.created_at)}`, margin, 74, { align: 'right' });

    // Tagline
    doc.fontSize(9).fillColor(GOLD).font('Helvetica')
       .text('Preserving legacies, one QR code at a time.', margin, 82, { align: 'left' });

    // ── GOLD DIVIDER ──────────────────────────────────────
    doc.moveDown(0.5);
    const divY = 118;
    doc.moveTo(margin, divY).lineTo(pageW - margin, divY).strokeColor(GOLD).lineWidth(1.5).stroke();

    // ── BILL TO ───────────────────────────────────────────
    doc.moveDown(1);
    doc.fontSize(9).fillColor(MUTED).font('Helvetica-Bold').text('BILL TO', margin, 135);
    doc.fontSize(13).fillColor(BROWN).font('Helvetica-Bold')
       .text(invoice.user_name || 'Subscriber', margin, 150);
    doc.fontSize(10).fillColor(MUTED).font('Helvetica')
       .text(invoice.user_email || '', margin, 168);

    // ── STATUS BADGE ──────────────────────────────────────
    const badgeX = pageW - margin - 80;
    doc.rect(badgeX, 150, 80, 22).fill('#D1FAE5'); // light green
    doc.fontSize(9).fillColor('#065F46').font('Helvetica-Bold')
       .text('PAID', badgeX, 157, { width: 80, align: 'center' });

    // ── ITEM TABLE ────────────────────────────────────────
    const tableY  = 210;
    const colDesc = margin;
    const colAmt  = pageW - margin - 100;

    // Table header
    doc.rect(margin, tableY, contentW, 26).fill(BROWN);
    doc.fontSize(9).fillColor(TAN).font('Helvetica-Bold')
       .text('DESCRIPTION', colDesc + 8, tableY + 9)
       .text('AMOUNT', colAmt, tableY + 9, { width: 100, align: 'right' });

    // Table row
    const rowY = tableY + 26;
    doc.rect(margin, rowY, contentW, 36).fill('#FFF8F0');
    doc.fontSize(10).fillColor(BROWN).font('Helvetica-Bold')
       .text(planDescription(invoice.plan), colDesc + 8, rowY + 8);
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text(`Plan: ${invoice.plan === 'yearly' ? '₹6,999/year' : '₹749/month'}`, colDesc + 8, rowY + 22);
    doc.fontSize(11).fillColor(BROWN).font('Helvetica-Bold')
       .text(fmtINR(invoice.amount_inr), colAmt, rowY + 12, { width: 100, align: 'right' });

    // ── TOTALS ────────────────────────────────────────────
    const totalY = rowY + 36 + 10;
    doc.moveTo(margin, totalY).lineTo(pageW - margin, totalY).strokeColor('#E8DCC8').lineWidth(0.5).stroke();

    const totalsX = pageW - margin - 200;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text('Subtotal:', totalsX, totalY + 12)
       .text(fmtINR(invoice.amount_inr), totalsX + 130, totalY + 12, { width: 70, align: 'right' });

    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text('GST (included):', totalsX, totalY + 28)
       .text('—', totalsX + 130, totalY + 28, { width: 70, align: 'right' });

    // Total row
    const grandY = totalY + 46;
    doc.rect(totalsX - 10, grandY, 210 + 10, 28).fill(BROWN);
    doc.fontSize(11).fillColor(TAN).font('Helvetica-Bold')
       .text('TOTAL:', totalsX, grandY + 8)
       .text(fmtINR(invoice.amount_inr), totalsX + 130, grandY + 8, { width: 70, align: 'right' });

    // ── PAYMENT METHOD / NOTES ────────────────────────────
    const notesY = grandY + 50;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text('Payment processed via Razorpay. This is a computer-generated invoice and does not require a signature.', margin, notesY, { width: contentW, align: 'left' });

    // ── FOOTER ────────────────────────────────────────────
    const footerY = doc.page.height - 160;
    doc.moveTo(margin, footerY).lineTo(pageW - margin, footerY).strokeColor(GOLD).lineWidth(0.8).stroke();
    doc.fontSize(8).fillColor(MUTED).font('Helvetica')
       .text(
         `Hriatrengna  ·  hriatrengna.in  ·  billing@hriatrengna.in  ·  Invoice ${invoice.invoice_number}`,
         margin, footerY + 10, { align: 'center', width: contentW }
       );

    doc.end();
  });
}

// ── GET OR CREATE INVOICE FOR A TRANSACTION ──────────────────
async function getOrCreateInvoice(transactionId) {
  // Check if already exists
  const existing = await db.query(
    `SELECT i.*, u.name AS user_name, u.email AS user_email
     FROM invoices i
     LEFT JOIN users u ON u.id = i.user_id
     WHERE i.transaction_id = $1`,
    [transactionId]
  );
  if (existing.rows.length) return existing.rows[0];

  // Create from transaction
  const txRes = await db.query(
    `SELECT t.*, u.name, u.email FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.id = $1`,
    [transactionId]
  );
  if (!txRes.rows.length) throw new Error('Transaction not found.');
  const tx = txRes.rows[0];

  return createInvoiceRecord({
    userId:       tx.user_id,
    transactionId: tx.id,
    amountInr:    tx.amount_inr,
    plan:         tx.plan,
    userName:     tx.name,
    userEmail:    tx.email,
  });
}

module.exports = { createInvoiceRecord, generateInvoicePDF, getOrCreateInvoice };
