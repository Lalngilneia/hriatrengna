const { Resend } = require('resend');
const db = require('../utils/db');

let _resend = null;
const getResend = () => {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) { console.warn('[EMAIL] RESEND_API_KEY not set.'); return null; }
    _resend = new Resend(key);
  }
  return _resend;
};

async function send({ to, subject, html, userId = null, type = 'general' }) {
  try {
    const resend = getResend();
    if (!resend) return null;
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Hriatrengna <noreply@hriatrengna.in>',
      to, subject, html,
    });
    db.query(
      `INSERT INTO email_log (user_id, email_to, type, resend_id, status) VALUES ($1,$2,$3,$4,'sent')`,
      [userId, to, type, result.data?.id || null]
    ).catch(() => {});
    return result;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err.message);
    throw err;
  }
}

const wrap = (content) => `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#F5F0E8;margin:0;padding:40px 20px">
<div style="max-width:580px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<div style="background:#2C1810;padding:28px 40px;text-align:center"><div style="color:#FAF7F2;font-size:20px;font-weight:700">Hriatrengna</div></div>
<div style="padding:40px">${content}</div>
<div style="background:#F5F0E8;padding:20px 40px;text-align:center;border-top:1px solid #EAE0D0"><p style="font-size:12px;color:#8B7355;margin:0">© ${new Date().getFullYear()} Hriatrengna · Aizawl, Mizoram, India</p></div>
</div></body></html>`;

module.exports = {
  sendWelcome: (user) => send({
    to: user.email, userId: user.id, type: 'welcome',
    subject: `Welcome to Hriatrengna, ${user.name?.split(' ')[0]} ✦`,
    html: wrap(`<h2 style="color:#2C1810">Welcome, ${user.name?.split(' ')[0]}.</h2><p style="color:#4A3728;line-height:1.7">You've taken a meaningful step toward preserving someone's legacy. Create your first album from your dashboard.</p><div style="text-align:center;margin:32px 0"><a href="${process.env.APP_URL}" style="background:#C9A84C;color:#2C1810;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">Go to Dashboard →</a></div>`),
  }),

  sendVerifyEmail: (user, verifyUrl) => send({
    to: user.email, userId: user.id, type: 'verifyEmail',
    subject: 'Please verify your email — Hriatrengna',
    html: wrap(`<h2 style="color:#2C1810">Verify your email</h2><p style="color:#4A3728;line-height:1.7">Hi ${user.name?.split(' ')[0]}, please verify your email to activate your account. This link expires in 24 hours.</p><div style="text-align:center;margin:32px 0"><a href="${verifyUrl}" style="background:#2C1810;color:#FAF7F2;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">Verify Email Address</a></div><p style="font-size:13px;color:#8B7355">Or copy: ${verifyUrl}</p>`),
  }),

  sendPasswordReset: (user, resetUrl) => send({
    to: user.email, userId: user.id, type: 'resetPassword',
    subject: 'Reset your Hriatrengna password',
    html: wrap(`<h2 style="color:#2C1810">Reset your password</h2><p style="color:#4A3728;line-height:1.7">Hi ${user.name?.split(' ')[0]}, click below to reset your password. This link expires in 1 hour.</p><div style="text-align:center;margin:32px 0"><a href="${resetUrl}" style="background:#2C1810;color:#FAF7F2;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">Reset Password</a></div>`),
  }),

  sendAlbumCreated: (user, album) => send({
    to: user.email, userId: user.id, type: 'albumCreated',
    subject: `Your album for ${album.name} is ready ✦`,
    html: wrap(`<h2 style="color:#2C1810">Your album is live.</h2><p style="color:#4A3728;line-height:1.7">Hi ${user.name?.split(' ')[0]}, your album <strong>${album.name}</strong> has been published and is ready to share.</p><div style="text-align:center;margin:32px 0"><a href="${process.env.APP_URL}" style="background:#C9A84C;color:#2C1810;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">Download QR Code →</a></div>`),
  }),

  sendAlbumUpdated: (user, album) => send({
    to: user.email, userId: user.id, type: 'albumUpdated',
    subject: `Album updated: ${album?.name || 'Your album'}`,
    html: wrap(`<h2 style="color:#2C1810">Album updated.</h2><p style="color:#4A3728;line-height:1.7">Your album <strong>${album?.name || ''}</strong> has been updated successfully.</p>`),
  }),

  sendRenewalReminder: (user) => send({
    to: user.email, userId: user.id, type: 'renewalReminder',
    subject: 'Your Hriatrengna subscription renews in 7 days',
    html: wrap(`<h2 style="color:#2C1810">Renewal in 7 days</h2><p style="color:#4A3728;line-height:1.7">Hi ${user.name?.split(' ')[0]}, your subscription renews on <strong>${new Date(user.current_period_end).toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric'})}</strong>.</p><div style="text-align:center;margin:32px 0"><a href="${process.env.APP_URL}/account" style="background:#2C1810;color:#FAF7F2;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">Manage Subscription</a></div>`),
  }),

  sendExpiryWarning: (user) => send({
    to: user.email, userId: user.id, type: 'expiryWarning',
    subject: 'Important: Your Hriatrengna subscription is ending',
    html: wrap(`<h2 style="color:#2C1810">Your subscription ends soon</h2><p style="color:#4A3728;line-height:1.7">Hi ${user.name?.split(' ')[0]}, your subscription ends on <strong>${new Date(user.current_period_end).toLocaleDateString('en-IN',{year:'numeric',month:'long',day:'numeric'})}</strong>. After this date your albums will be in a 30-day grace period.</p><div style="text-align:center;margin:32px 0"><a href="${process.env.APP_URL}/payment" style="background:#C9A84C;color:#2C1810;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">Reactivate Subscription</a></div>`),
  }),

  sendAdminNotification: ({ to, subject, html }) => send({ to, subject, html, type: 'admin' }),

  // ── ALBUM DELETED ────────────────────────────────────────────
  // Called in album.controller.js after a subscriber deletes an album.
  // albumName is a plain string (not an album object).
  sendAlbumDeleted: (user, albumName) => send({
    to: user.email, userId: user.id, type: 'albumDeleted',
    subject: `Album removed: ${albumName}`,
    html: wrap(`
      <h2 style="color:#2C1810">Album removed</h2>
      <p style="color:#4A3728;line-height:1.7">
        Hi ${user.name?.split(' ')[0] || 'there'}, your album
        <strong>${albumName}</strong> has been permanently deleted along with all
        its media and QR codes.
      </p>
      <p style="color:#4A3728;line-height:1.7">
        If this was a mistake, please contact our support team as soon as possible —
        recovery may be possible within 30 days.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${process.env.APP_URL}" style="background:#2C1810;color:#FAF7F2;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">
          Go to Dashboard →
        </a>
      </div>
    `),
  }),

  // ── STUDIO INVITE EMAIL ─────────────────────────────────────
  // Called in studio.invite.controller.js when an owner invites a team member.
  // The invite link lets the invitee create an account and join the studio.
  sendStudioInvite: ({ toEmail, studioName, role, inviteUrl, expiresAt }) => send({
    to: toEmail, userId: null, type: 'studioInvite',
    subject: `You've been invited to join ${studioName} on Hriatrengna`,
    html: wrap(`
      <h2 style="color:#2C1810">Studio Invitation</h2>
      <p style="color:#4A3728;line-height:1.7">
        You've been invited to join <strong>${studioName}</strong> as a
        <strong>${role}</strong>.
      </p>
      <p style="color:#4A3728;line-height:1.7">
        Click the button below to accept the invite and set up your account.
        This link expires on
        ${expiresAt ? new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'in 7 days'}.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${inviteUrl}" style="background:#C9A84C;color:#2C1810;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">
          Accept Invitation →
        </a>
      </div>
      <p style="font-size:12px;color:#8B7355;text-align:center">
        Or copy this link: <a href="${inviteUrl}" style="color:#C9A84C">${inviteUrl}</a>
      </p>
      <p style="font-size:12px;color:#8B7355;text-align:center;margin-top:16px">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    `),
  }),

  // ── STUDIO CLAIM LINK ────────────────────────────────────────
  // Called in studio.controller.js when a photographer sends a claim link
  // to their client so the client can take ownership of the album.
  sendStudioClaimLink: ({ toEmail, clientName, studioName, albumName, claimUrl, albumUrl, qrDataUrl }) => send({
    to: toEmail, userId: null, type: 'studioClaimLink',
    subject: `Your wedding album is ready — ${albumName}`,
    html: wrap(`
      <h2 style="color:#2C1810">Your album is ready, ${clientName.split(' ')[0]}.</h2>
      <p style="color:#4A3728;line-height:1.7">
        <strong>${studioName}</strong> has prepared a digital wedding album for you:
        <strong>${albumName}</strong>.
      </p>
      <p style="color:#4A3728;line-height:1.7">
        Click the button below to claim your album and take full ownership —
        you'll be able to add photos, share the link, and download your QR code.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${claimUrl}" style="background:#C9A84C;color:#2C1810;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">
          Claim My Album →
        </a>
      </div>
      ${qrDataUrl ? `
        <div style="text-align:center;margin:24px 0">
          <p style="color:#8B7355;font-size:13px;margin-bottom:8px">Your album QR code</p>
          <img src="${qrDataUrl}" alt="Album QR Code" style="width:160px;height:160px;border:4px solid #EAE0D0;border-radius:12px" />
          <p style="color:#8B7355;font-size:12px;margin-top:8px">
            Or visit: <a href="${albumUrl}" style="color:#C9A84C">${albumUrl}</a>
          </p>
        </div>
      ` : ''}
      <p style="font-size:12px;color:#8B7355;text-align:center;margin-top:24px">
        This claim link expires in 30 days. If you did not expect this email, you can safely ignore it.
      </p>
    `),
  }),

  // ── SUPPORT REPLY ────────────────────────────────────────────
  // Called in admin.controller.js when an admin replies to a support ticket.
  // Accepts an object with threading headers for proper email thread grouping.
  sendSupportReply: async ({ to, subject, bodyText, inReplyTo, references, replyTo }) => {
    const bodyHtml = wrap(`
      <h2 style="color:#2C1810">Support Reply</h2>
      <div style="color:#4A3728;line-height:1.8;white-space:pre-wrap">${
        bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }</div>
      <hr style="border:none;border-top:1px solid #EAE0D0;margin:28px 0" />
      <p style="font-size:12px;color:#8B7355">
        Reply to this email to continue the conversation with our support team.
      </p>
    `);
    const resend = (() => {
      const key = process.env.RESEND_API_KEY;
      if (!key) { console.warn('[EMAIL] RESEND_API_KEY not set.'); return null; }
      const { Resend: R } = require('resend');
      return new R(key);
    })();
    if (!resend) return null;

    const headers = {};
    if (inReplyTo)  headers['In-Reply-To'] = inReplyTo;
    if (references) headers['References']   = references;

    const result = await resend.emails.send({
      from:     process.env.EMAIL_FROM || 'Hriatrengna Support <support@hriatrengna.in>',
      reply_to: replyTo || 'support@hriatrengna.in',
      to,
      subject,
      html:     bodyHtml,
      headers,
    });
    db.query(
      `INSERT INTO email_log (user_id, email_to, type, resend_id, status) VALUES ($1,$2,$3,$4,'sent')`,
      [null, to, 'supportReply', result.data?.id || null]
    ).catch(() => {});
    return result;
  },

  // ── INVOICE EMAIL ────────────────────────────────────────────
  // Called in payment.controller.js after a subscription is activated.
  // pdf is a Buffer containing the generated invoice PDF.
  sendInvoice: async (user, invoice, pdf) => {
    const resend = (() => {
      const key = process.env.RESEND_API_KEY;
      if (!key) { console.warn('[EMAIL] RESEND_API_KEY not set.'); return null; }
      const { Resend: R } = require('resend');
      return new R(key);
    })();
    if (!resend) return null;

    const planLabel = invoice.plan === 'yearly' ? 'Yearly Plan — ₹6,999' : 'Monthly Plan — ₹749';
    const issuedOn  = new Date(invoice.issued_at || invoice.created_at)
      .toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = wrap(`
      <h2 style="color:#2C1810">Payment confirmed ✦</h2>
      <p style="color:#4A3728;line-height:1.7">
        Hi ${user.name?.split(' ')[0] || 'there'}, thank you for your payment.
        Your Hriatrengna subscription is now active.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <tr style="background:#F5F0E8">
          <td style="padding:10px 14px;color:#8B7355;font-size:13px">Invoice #</td>
          <td style="padding:10px 14px;color:#2C1810;font-weight:600">${invoice.invoice_number}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#8B7355;font-size:13px">Plan</td>
          <td style="padding:10px 14px;color:#2C1810">${planLabel}</td>
        </tr>
        <tr style="background:#F5F0E8">
          <td style="padding:10px 14px;color:#8B7355;font-size:13px">Date</td>
          <td style="padding:10px 14px;color:#2C1810">${issuedOn}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#8B7355;font-size:13px">Amount paid</td>
          <td style="padding:10px 14px;color:#2C1810;font-weight:700">₹${Number(invoice.amount_inr).toLocaleString('en-IN')}</td>
        </tr>
      </table>
      <p style="color:#4A3728;font-size:13px">Your invoice PDF is attached to this email.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${process.env.APP_URL}" style="background:#C9A84C;color:#2C1810;padding:14px 36px;border-radius:100px;text-decoration:none;font-weight:600">
          Go to Dashboard →
        </a>
      </div>
    `);

    const attachments = pdf ? [{
      filename: `Hriatrengna-Invoice-${invoice.invoice_number}.pdf`,
      content:  pdf.toString('base64'),
    }] : [];

    const result = await resend.emails.send({
      from:        process.env.EMAIL_FROM || 'Hriatrengna <noreply@hriatrengna.in>',
      to:          user.email,
      subject:     `Your Hriatrengna invoice #${invoice.invoice_number}`,
      html,
      attachments,
    });
    db.query(
      `INSERT INTO email_log (user_id, email_to, type, resend_id, status) VALUES ($1,$2,$3,$4,'sent')`,
      [user.id, user.email, 'invoice', result.data?.id || null]
    ).catch(() => {});
    return result;
  },

  sendRefundStatusUpdate: (user, refund) => {
    const amount = Number(
      refund.approved_amount_inr ??
      refund.requested_amount_inr ??
      0
    ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const statusMap = {
      requested: {
        subject: 'Refund request received — Hriatrengna',
        heading: 'Your refund request has been received',
        body: 'Our team has received your request and will review it shortly.',
      },
      approved: {
        subject: 'Refund approved — Hriatrengna',
        heading: 'Your refund request has been approved',
        body: 'Your refund has been approved and is ready for processing.',
      },
      rejected: {
        subject: 'Refund request update — Hriatrengna',
        heading: 'Your refund request was not approved',
        body: refund.admin_notes || 'Our support team reviewed the request and was unable to approve it.',
      },
      processing: {
        subject: 'Refund in progress — Hriatrengna',
        heading: 'Your refund is being processed',
        body: 'We have initiated the refund with our payment partner. It may take a few business days to reflect.',
      },
      processed: {
        subject: 'Refund completed — Hriatrengna',
        heading: 'Your refund has been processed',
        body: 'The refund has been completed successfully through our payment partner.',
      },
      failed: {
        subject: 'Refund processing issue — Hriatrengna',
        heading: 'There was a problem processing your refund',
        body: refund.admin_notes || 'Our team will review this manually and get back to you.',
      },
    };

    const content = statusMap[refund.status] || statusMap.requested;

    return send({
      to: user.email,
      userId: user.id,
      type: 'refund',
      subject: content.subject,
      html: wrap(`
        <h2 style="color:#2C1810">${content.heading}</h2>
        <p style="color:#4A3728;line-height:1.7">
          Hi ${user.name?.split(' ')[0] || 'there'}, ${content.body}
        </p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr style="background:#F5F0E8">
            <td style="padding:10px 14px;color:#8B7355;font-size:13px">Refund status</td>
            <td style="padding:10px 14px;color:#2C1810;font-weight:600;text-transform:capitalize">${refund.status}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#8B7355;font-size:13px">Amount</td>
            <td style="padding:10px 14px;color:#2C1810;font-weight:600">Rs ${amount}</td>
          </tr>
          ${refund.razorpay_refund_id ? `
            <tr style="background:#F5F0E8">
              <td style="padding:10px 14px;color:#8B7355;font-size:13px">Refund ID</td>
              <td style="padding:10px 14px;color:#2C1810;font-family:monospace">${refund.razorpay_refund_id}</td>
            </tr>
          ` : ''}
        </table>
        <p style="font-size:12px;color:#8B7355">
          If you need help, reply to this email or contact ${process.env.SUPPORT_EMAIL || 'support@hriatrengna.in'}.
        </p>
      `),
    });
  },
};
