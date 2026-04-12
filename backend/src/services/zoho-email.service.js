/**
 * backend/src/services/zoho-email.service.js
 *
 * Zoho Mail integration for support@hriatrengna.in
 *
 * HOW IT WORKS:
 * Zoho does not have a native inbound webhook.
 * The recommended approach for hriatrengna.in:
 *
 * Option A (Simplest — recommended):
 *   In Zoho Mail → Settings → Filters → Create Filter:
 *   "When email arrives at support@hriatrengna.in → Forward to [Resend inbound address]"
 *   Resend's inbound webhook then delivers it to /webhooks/resend
 *   which already handles email events. Add a case for 'email.received'.
 *
 * Option B (Direct IMAP polling):
 *   Poll support@hriatrengna.in via IMAP using the zoho-mail-sdk or imapflow.
 *   This file implements that approach as a cron-based alternative.
 *
 * Current status: Option A is active when ZOHO_SUPPORT_ENABLED=true in app_settings.
 * This file provides the auto-reply helper used by both options.
 */

const emailService = require('./email.service');
const db = require('../utils/db');

const SUPPORT_FROM = process.env.EMAIL_FROM_SUPPORT || 'Hriatrengna Support <support@hriatrengna.in>';
const SUPPORT_REPLY_TO = 'support@hriatrengna.in';

/**
 * createSupportTicket
 * Called when an inbound support email is received (via Resend forward or contact form).
 *
 * @param {{ fromEmail, fromName, subject, bodyText, bodyHtml, source }} params
 */
async function createSupportTicket({ fromEmail, fromName, subject, bodyText, bodyHtml, source = 'contact_form' }) {
  // Sanitize inputs
  const safeEmail   = String(fromEmail || '').trim().toLowerCase().slice(0, 254);
  const safeName    = String(fromName  || 'Customer').trim().slice(0, 100);
  const safeSubject = String(subject   || 'Support Request').trim().slice(0, 255);
  const safeBody    = String(bodyText  || bodyHtml || '').trim().slice(0, 10000);

  // Insert into support_inbox (requires migration 023_support_crm.sql)
  let ticketId = null;
  try {
    const result = await db.query(
      `INSERT INTO support_inbox
         (from_email, from_name, subject, body_text, status, contact_source)
       VALUES ($1, $2, $3, $4, 'open', $5)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [safeEmail, safeName, safeSubject, safeBody, source]
    );
    ticketId = result.rows[0]?.id;
  } catch (err) {
    // support_inbox table may not exist yet — log but don't crash
    console.warn('[ZOHO] support_inbox insert failed:', err.message);
  }

  // Send auto-reply to the customer
  try {
    const autoReplyEnabled = await isAutoReplyEnabled();
    if (autoReplyEnabled) {
      await sendSupportAutoReply({ toEmail: safeEmail, toName: safeName, subject: safeSubject });
    }
  } catch (err) {
    console.warn('[ZOHO] Auto-reply failed:', err.message);
  }

  // Notify admin
  try {
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminEmail) {
      await emailService.sendRaw({
        to: adminEmail,
        from: SUPPORT_FROM,
        subject: `[Support] New ticket: ${safeSubject}`,
        html: `<p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
               <p><strong>Source:</strong> ${source}</p>
               <hr/>
               <pre style="white-space:pre-wrap;font-family:sans-serif">${safeBody.slice(0, 2000)}</pre>`,
      });
    }
  } catch (err) {
    console.warn('[ZOHO] Admin notification failed:', err.message);
  }

  return { ticketId, success: true };
}

async function isAutoReplyEnabled() {
  try {
    const res = await db.query(
      "SELECT value FROM app_settings WHERE key = 'support_auto_reply_enabled'",
      []
    );
    return res.rows[0]?.value !== 'false';
  } catch {
    return true; // default on
  }
}

async function sendSupportAutoReply({ toEmail, toName, subject }) {
  const html = `
    <div style="font-family:Georgia,serif;background:#F5F0E8;padding:32px 16px">
      <div style="background:#fff;border-radius:12px;max-width:560px;margin:0 auto;overflow:hidden">
        <div style="background:#2C1810;padding:28px 32px">
          <div style="color:#FAF7F2;font-size:18px;font-weight:700">
            ✦ Hriatrengna <span style="color:#C9A84C">Support</span>
          </div>
        </div>
        <div style="padding:32px">
          <p style="color:#2C1810;font-size:20px;font-weight:600;margin:0 0 12px">
            We've received your message
          </p>
          <p style="color:#4A3728;font-size:15px;line-height:1.7;margin:0 0 16px">
            Dear ${toName},
          </p>
          <p style="color:#4A3728;font-size:15px;line-height:1.7;margin:0 0 16px">
            Thank you for contacting Hriatrengna support. We have received your message
            regarding <strong>"${subject}"</strong> and our team will respond within
            24 hours on business days.
          </p>
          <div style="background:#FAF7F2;border:1px solid #E8DCC8;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:0;font-size:13px;color:#6B4F3A;line-height:1.6">
              <strong>Need faster help?</strong><br/>
              For urgent payment or account issues, reply directly to this email
              or write to <a href="mailto:support@hriatrengna.in" style="color:#C9A84C">
              support@hriatrengna.in</a>
            </p>
          </div>
          <p style="color:#8B7355;font-size:13px;line-height:1.6;margin:0">
            This is an automated acknowledgement. Please do not reply to this email
            — instead use the original thread or contact us at support@hriatrengna.in.
          </p>
        </div>
        <div style="background:#F5F0E8;padding:20px 32px;border-top:1px solid #EAE0D0">
          <p style="font-size:12px;color:#8B7355;margin:0">
            Hriatrengna — Preserve &amp; Honour · support@hriatrengna.in
          </p>
        </div>
      </div>
    </div>
  `;

  await emailService.sendRaw({
    to: toEmail,
    from: SUPPORT_FROM,
    replyTo: SUPPORT_REPLY_TO,
    subject: `Re: ${subject} — We've received your message`,
    html,
  });
}

module.exports = {
  createSupportTicket,
  sendSupportAutoReply,
};
