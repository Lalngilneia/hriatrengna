'use strict';
const crypto = require('crypto');
const { Resend } = require('resend');
const db = require('../utils/db');
const subscriptionService = require('../services/subscription.service');
const studioWebhook = require('./studio.webhook.controller');

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
let resendClient = null;

function getHeader(req, name) {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function timingSafeMatch(expected, candidates) {
  const expectedBuffer = Buffer.from(expected);

  return candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    if (candidateBuffer.length !== expectedBuffer.length) {
      console.log('[TIMING SAFE MATCH] Length mismatch:', expectedBuffer.length, 'vs', candidateBuffer.length);
      return false;
    }
    try {
      return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch (err) {
      console.error('[TIMING SAFE MATCH] Error:', err.message);
      return false;
    }
  });
}

function verifyRazorpayWebhookSignature(rawPayload, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[RAZORPAY WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not configured!');
    const err = new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
    err.status = 503;
    throw err;
  }

  if (!signature) {
    console.error('[RAZORPAY WEBHOOK] Missing signature header');
    const err = new Error('Missing Razorpay webhook signature.');
    err.status = 400;
    throw err;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawPayload)
    .digest('hex');

  console.log('[RAZORPAY WEBHOOK] Expected signature:', expected.substring(0, 20) + '...');
  console.log('[RAZORPAY WEBHOOK] Received signature:', String(signature).substring(0, 20) + '...');
  console.log('[RAZORPAY WEBHOOK] Secret length:', secret.length);

  if (!timingSafeMatch(expected, [String(signature)])) {
    console.error('[RAZORPAY WEBHOOK] Signature mismatch!');
    const err = new Error('Invalid Razorpay webhook signature.');
    err.status = 400;
    throw err;
  }

  console.log('[RAZORPAY WEBHOOK] Signature verified successfully');
}

function verifyResendWebhook({ payload, headers, secret }) {
  if (!secret) {
    const err = new Error('RESEND_WEBHOOK_SECRET is not configured.');
    err.status = 503;
    throw err;
  }

  const id = headers.id;
  const timestamp = headers.timestamp;
  const signature = headers.signature;

  if (!id || !timestamp || !signature) {
    const err = new Error('Missing Resend webhook signature headers.');
    err.status = 400;
    throw err;
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    const err = new Error('Invalid Resend webhook timestamp.');
    err.status = 400;
    throw err;
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    const err = new Error('Resend webhook timestamp is outside the allowed window.');
    err.status = 400;
    throw err;
  }

  const secretValue = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const secretBytes = Buffer.from(secretValue, 'base64');
  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  const signatures = String(signature)
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(','))
    .filter(([version, value]) => version === 'v1' && value)
    .map(([, value]) => value);

  if (!signatures.length || !timingSafeMatch(expected, signatures)) {
    const err = new Error('Invalid Resend webhook signature.');
    err.status = 400;
    throw err;
  }
}

function parseAddress(value) {
  if (!value) return { email: null, name: null };

  const match = String(value).match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, '') || null,
      email: match[2].trim().toLowerCase(),
    };
  }

  return {
    email: String(value).trim().toLowerCase(),
    name: null,
  };
}

function firstRecipient(data) {
  const candidates = Array.isArray(data?.to) ? data.to : [];
  return candidates[0] ? String(candidates[0]).trim().toLowerCase() : null;
}

function getResendClient() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

async function getReceivedEmailContent(emailId) {
  if (!emailId) return null;

  const client = getResendClient();
  if (!client?.emails?.receiving?.get) return null;

  try {
    const response = await client.emails.receiving.get(emailId);
    return response?.data || response || null;
  } catch (err) {
    console.warn(`[RESEND WEBHOOK] Unable to fetch content for received email ${emailId}: ${err.message}`);
    return null;
  }
}

function normalizeHeaders(headers) {
  if (!headers) return {};

  if (Array.isArray(headers)) {
    return headers.reduce((acc, header) => {
      const key = String(header?.name || header?.key || '').trim().toLowerCase();
      if (!key) return acc;
      const value = String(header?.value || '').trim();
      if (!value) return acc;
      if (acc[key]) {
        acc[key] = Array.isArray(acc[key]) ? [...acc[key], value] : [acc[key], value];
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  return Object.entries(headers).reduce((acc, [key, value]) => {
    if (value == null) return acc;
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
}

function getNormalizedHeader(headers, name) {
  const value = headers[String(name || '').toLowerCase()];
  if (Array.isArray(value)) return value[0] || null;
  if (value == null) return null;
  return String(value).trim() || null;
}

function parseMessageIdList(value) {
  if (!value) return [];

  const text = String(value);
  const matches = text.match(/<[^>]+>/g);
  const tokens = matches?.length
    ? matches
    : text.split(/[\s,]+/).filter(Boolean);

  return [...new Set(tokens.map((token) => token.trim()).filter(Boolean))];
}

function getSupportAddressParts() {
  const supportEmail = (process.env.SUPPORT_EMAIL || 'support@hriatrengna.in').toLowerCase();
  const [local, domain] = supportEmail.split('@');
  return { supportEmail, local, domain };
}

function isSupportRecipient(email, parts = getSupportAddressParts()) {
  if (!email || !parts.local || !parts.domain) return false;
  return email === parts.supportEmail || (
    email.endsWith(`@${parts.domain}`) &&
    email.startsWith(`${parts.local}+`)
  );
}

function extractThreadToken(data) {
  const parts = getSupportAddressParts();
  const recipients = Array.isArray(data?.to) ? data.to : [];

  for (const value of recipients) {
    const parsed = parseAddress(value);
    if (!parsed.email) continue;
    if (!isSupportRecipient(parsed.email, parts) || parsed.email === parts.supportEmail) continue;
    return parsed.email
      .slice(0, parsed.email.indexOf('@'))
      .slice(parts.local.length + 1)
      .trim()
      .toLowerCase() || null;
  }

  return null;
}

async function findSupportTicketForInbound(client, { threadToken, inReplyTo, references }) {
  if (threadToken) {
    const byToken = await client.query(
      `SELECT id
       FROM support_inbox
       WHERE thread_token = $1
       LIMIT 1`,
      [threadToken]
    );
    if (byToken.rows.length) return byToken.rows[0].id;
  }

  if (inReplyTo) {
    const byReplyHeader = await client.query(
      `SELECT support_inbox_id AS id
       FROM support_messages
       WHERE message_id = $1
       UNION ALL
       SELECT id
       FROM support_inbox
       WHERE message_id = $1
       LIMIT 1`,
      [inReplyTo]
    );
    if (byReplyHeader.rows.length) return byReplyHeader.rows[0].id;
  }

  if (references.length) {
    const byReferences = await client.query(
      `SELECT id
       FROM (
         SELECT support_inbox_id AS id, received_at
         FROM support_messages
         WHERE message_id = ANY($1::text[])
         UNION ALL
         SELECT id, received_at
         FROM support_inbox
         WHERE message_id = ANY($1::text[])
       ) matches
       ORDER BY received_at DESC
       LIMIT 1`,
      [references]
    );
    if (byReferences.rows.length) return byReferences.rows[0].id;
  }

  return null;
}

function emailStatusForEvent(type) {
  return ({
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'delivery_delayed',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.failed': 'failed',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
  })[type] || null;
}

exports.resend = async (req, res, next) => {
  const rawPayload = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});

  const headers = {
    id: getHeader(req, 'svix-id'),
    timestamp: getHeader(req, 'svix-timestamp'),
    signature: getHeader(req, 'svix-signature'),
  };

  try {
    verifyResendWebhook({
      payload: rawPayload,
      headers,
      secret: process.env.RESEND_WEBHOOK_SECRET,
    });

    const event = JSON.parse(rawPayload);
    const data = event?.data || {};
    const webhookId = headers.id;
    const recipient = firstRecipient(data);
    const sender = parseAddress(data.from);
    const status = emailStatusForEvent(event.type);
    const receivedEmail = event.type === 'email.received'
      ? await getReceivedEmailContent(data.email_id || null)
      : null;
    const normalizedEmailHeaders = normalizeHeaders(receivedEmail?.headers);
    const messageId = getNormalizedHeader(normalizedEmailHeaders, 'message-id') || data.message_id || null;
    const inReplyTo = getNormalizedHeader(normalizedEmailHeaders, 'in-reply-to');
    const references = parseMessageIdList(getNormalizedHeader(normalizedEmailHeaders, 'references'));
    const threadToken = extractThreadToken(data);
    const supportParts = getSupportAddressParts();
    const toList = Array.isArray(data.to)
      ? data.to
        .map((value) => parseAddress(value).email || String(value).trim().toLowerCase())
        .filter(Boolean)
      : [];
    const isSupportInbound = event.type === 'email.received' && toList.some((email) => isSupportRecipient(email, supportParts));

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const inserted = await client.query(
        `INSERT INTO resend_webhook_events
           (webhook_id, event_type, email_id, recipient_email, sender_email, subject,
            event_created_at, status, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'received',$8::jsonb)
         ON CONFLICT (webhook_id) DO NOTHING
         RETURNING id`,
        [
          webhookId,
          event.type || 'unknown',
          data.email_id || null,
          recipient,
          sender.email,
          data.subject || null,
          event.created_at || data.created_at || null,
          rawPayload,
        ]
      );

      if (!inserted.rows.length) {
        await client.query('ROLLBACK');
        return res.status(200).json({ ok: true, duplicate: true, webhookId });
      }

      if (status && data.email_id) {
        await client.query(
          `UPDATE email_log
           SET status = $1
           WHERE resend_id = $2`,
          [status, data.email_id]
        ).catch(() => {});
      }

      if (isSupportInbound) {
        const receivedAt = event.created_at || data.created_at || new Date().toISOString();
        const bodyText = receivedEmail?.text || null;
        const bodyHtml = receivedEmail?.html || null;
        const headersJson = JSON.stringify(normalizedEmailHeaders);
        const ccJson = JSON.stringify(Array.isArray(data.cc) ? data.cc : []);
        const bccJson = JSON.stringify(Array.isArray(data.bcc) ? data.bcc : []);
        const ticketId = await findSupportTicketForInbound(client, {
          threadToken,
          inReplyTo,
          references,
        });

        if (ticketId) {
          await client.query(
            `INSERT INTO support_messages
               (support_inbox_id, webhook_id, email_id, message_id, in_reply_to, references_header,
                from_email, from_name, to_email, cc, bcc, subject, attachment_count,
                body_text, body_html, headers, payload, received_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,
                     $14,$15,$16::jsonb,$17::jsonb,$18)
             ON CONFLICT (webhook_id) DO NOTHING`,
            [
              ticketId,
              webhookId,
              data.email_id || null,
              messageId,
              inReplyTo,
              references.join(' '),
              sender.email,
              sender.name,
              recipient,
              ccJson,
              bccJson,
              data.subject || null,
              Array.isArray(data.attachments) ? data.attachments.length : 0,
              bodyText,
              bodyHtml,
              headersJson,
              rawPayload,
              receivedAt,
            ]
          );

          await client.query(
            `UPDATE support_inbox
             SET last_message_at = $2,
                 archived_at = NULL,
                 ticket_status = CASE
                   WHEN ticket_status IN ('waiting_customer', 'resolved', 'archived') THEN 'open'
                   ELSE ticket_status
                 END
             WHERE id = $1`,
            [ticketId, receivedAt]
          );
        } else {
          const newThreadToken = threadToken || crypto.randomBytes(12).toString('hex');

          await client.query(
            `INSERT INTO support_inbox
               (webhook_id, email_id, message_id, thread_token, from_email, from_name, to_email, cc, bcc,
                subject, attachment_count, body_text, body_html, headers, payload, last_message_at, received_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17)
             ON CONFLICT (webhook_id) DO NOTHING`,
            [
              webhookId,
              data.email_id || null,
              messageId,
              newThreadToken,
              sender.email,
              sender.name,
              recipient,
              ccJson,
              bccJson,
              data.subject || null,
              Array.isArray(data.attachments) ? data.attachments.length : 0,
              bodyText,
              bodyHtml,
              headersJson,
              rawPayload,
              receivedAt,
              receivedAt,
            ]
          );
        }
      }

      await client.query(
        `UPDATE resend_webhook_events
         SET status = 'processed', processed_at = NOW(), error_message = NULL
         WHERE webhook_id = $1`,
        [webhookId]
      );

      await client.query('COMMIT');
      return res.status(200).json({ ok: true, webhookId, type: event.type || 'unknown' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
};

exports.razorpay = async (req, res, next) => {
  const rawPayload = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));

  console.log('[RAZORPAY WEBHOOK] Received webhook request');
  console.log('[RAZORPAY WEBHOOK] Headers:', JSON.stringify(req.headers).substring(0, 200));

  try {
    verifyRazorpayWebhookSignature(rawPayload, req.headers['x-razorpay-signature']);
  } catch (err) {
    console.error('[RAZORPAY WEBHOOK] Signature verification failed:', err.message);
    return next(err);
  }

  let body;
  try {
    body = JSON.parse(rawPayload.toString('utf8'));
  } catch {
    console.error('[RAZORPAY WEBHOOK] Failed to parse JSON body');
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const { event, payload } = body;
  const paymentEntity = payload?.payment?.entity || null;
  const notes = paymentEntity?.notes || payload?.order?.entity?.notes || {};

  console.log('[RAZORPAY WEBHOOK] Event:', event);
  console.log('[RAZORPAY WEBHOOK] Payment ID:', paymentEntity?.id);
  console.log('[RAZORPAY WEBHOOK] Order ID:', paymentEntity?.order_id);
  console.log('[RAZORPAY WEBHOOK] Notes:', JSON.stringify(notes));

  try {
    switch (event) {
      case 'payment.captured': {
        if (!paymentEntity?.order_id) {
          console.log('[RAZORPAY WEBHOOK] payment.captured but no order_id, skipping');
          break;
        }

        if (notes.productType === 'studio_photographer' || notes.studioId) {
          console.log('[RAZORPAY WEBHOOK] Processing studio order');
          await studioWebhook.handleStudioOrderCaptured(paymentEntity);
        } else {
          console.log('[RAZORPAY WEBHOOK] Processing consumer subscription payment');
          await subscriptionService.confirmCapturedPayment({
            razorpayOrderId: paymentEntity.order_id,
            razorpayPaymentId: paymentEntity.id,
            paymentEntity,
          });
        }
        break;
      }

      case 'payment.failed': {
        if (!paymentEntity?.order_id) break;

        if (notes.productType === 'studio_photographer' || notes.studioId) {
          await studioWebhook.handleStudioPaymentFailed(paymentEntity);
        } else {
          await subscriptionService.markPaymentFailed({
            razorpayOrderId: paymentEntity.order_id,
            razorpayPaymentId: paymentEntity.id || null,
            paymentEntity,
          });
        }
        break;
      }

      default:
        console.log('[RAZORPAY WEBHOOK] Unhandled event:', event);
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[RAZORPAY WEBHOOK] Error processing webhook:', err.message);
    return next(err);
  }
};
