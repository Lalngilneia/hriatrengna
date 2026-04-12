'use strict';

// Try to load firebase-admin, but don't crash if it fails
let admin = null;
try { admin = require('firebase-admin'); } catch (e) { console.warn('[PUSH] firebase-admin not available:', e.message); }

const db    = require('../utils/db');

let initialised = false;
let messaging = null;
const ICON = '/icons/icon-192.png';
const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function stringifyData(data) {
  return Object.fromEntries(
    Object.entries(data || {})
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, typeof value === 'string' ? value : String(value)])
  );
}

function buildMulticastMessage(payload, tokens) {
  const data = stringifyData(payload.data);
  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    android: {
      notification: {
        icon: payload.icon || 'ic_notification',
        color: '#8D7B6F',
        tag: payload.tag || 'default',
      },
      priority: 'high',
    },
    apns: {
      payload: {
        aps: {
          badge: 1,
          sound: 'default',
        },
      },
    },
    data,
    tokens,
  };

  const link = payload.link || data.url;
  if (link) {
    message.webpush = {
      notification: {
        icon: payload.icon || ICON,
        tag: payload.tag || 'default',
      },
      fcmOptions: {
        link,
      },
    };
  }

  return message;
}

function getFailedTokens(response, tokens) {
  const failedTokens = [];

  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const errorCode = resp.error?.code || 'unknown';
      console.error(`[PUSH] Failed for token ${idx}:`, resp.error?.message);
      if (INVALID_TOKEN_ERROR_CODES.has(errorCode)) {
        failedTokens.push(tokens[idx]);
      }
    }
  });

  return failedTokens;
}

function init() {
  if (initialised) return { ok: true };
  
  if (!admin) {
    console.warn('[PUSH] firebase-admin not installed — push notifications disabled.');
    return { ok: false, reason: 'firebase-admin not installed' };
  }
  
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[PUSH] Firebase credentials not set — push notifications disabled.');
    console.warn('[PUSH] Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env');
    return { ok: false, reason: 'firebase credentials not configured' };
  }
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    
    messaging = admin.messaging();
    initialised = true;
    console.log('[PUSH] Firebase Cloud Messaging initialised.');
    return { ok: true };
  } catch (err) {
    console.error('[PUSH] Failed to initialise Firebase:', err.message);
    return { ok: false, reason: err.message };
  }
}

async function sendToAdmins(payload) {
  const initState = init();
  if (!initState?.ok || !initialised || !messaging) {
    return { ok: false, reason: initState?.reason || 'push service not initialised' };
  }
  
  let tokens;
  try {
    const res = await db.query(
      'SELECT id, fcm_token FROM fcm_tokens WHERE admin_id IS NOT NULL AND active = TRUE'
    );
    tokens = res.rows.map(r => r.fcm_token).filter(Boolean);
  } catch (err) {
    console.error('[PUSH] Failed to fetch tokens:', err.message);
    return { ok: false, reason: err.message };
  }
  
  if (!tokens.length) return { ok: false, reason: 'no active admin devices registered', successCount: 0, failureCount: 0 };

  const message = buildMulticastMessage(payload, tokens);
  
  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[PUSH] Sent to ${response.successCount} devices, ${response.failureCount} failed`);
    
    if (response.failureCount > 0) {
      const failedTokens = getFailedTokens(response, tokens);
      if (failedTokens.length > 0) {
        await db.query(
          'UPDATE fcm_tokens SET active = FALSE WHERE fcm_token = ANY($1)',
          [failedTokens]
        ).catch(() => {});
        console.log(`[PUSH] Marked ${failedTokens.length} tokens as inactive`);
      }
    }
    
    await db.query(
      'UPDATE fcm_tokens SET last_used_at = NOW() WHERE admin_id IS NOT NULL AND active = TRUE'
    ).catch(() => {});
    return {
      ok: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      reason: response.successCount > 0 ? null : 'all device sends failed',
    };
  } catch (err) {
    console.error('[PUSH] Send error:', err.message);
    return { ok: false, reason: err.message };
  }
}

async function sendToUser(userId, payload) {
  const initState = init();
  if (!initState?.ok || !initialised || !messaging) return { ok: false, reason: initState?.reason || 'push service not initialised' };
  
  let tokens;
  try {
    const res = await db.query(
      'SELECT fcm_token FROM fcm_tokens WHERE user_id = $1 AND active = TRUE',
      [userId]
    );
    tokens = res.rows.map(r => r.fcm_token).filter(Boolean);
  } catch (err) {
    console.error('[PUSH] Failed to fetch user tokens:', err.message);
    return { ok: false, reason: err.message };
  }
  
  if (!tokens.length) return { ok: false, reason: 'no active user devices registered' };

  const message = buildMulticastMessage(payload, tokens);
  
  try {
    const response = await messaging.sendEachForMulticast(message);
    return {
      ok: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      reason: response.successCount > 0 ? null : 'all device sends failed',
    };
  } catch (err) {
    console.error('[PUSH] User send error:', err.message);
    return { ok: false, reason: err.message };
  }
}

const notify = {
  newSubscriber: (user, plan) => sendToAdmins({
    title: '🎉 New Subscriber',
    body:  `${user.name} subscribed to the ${plan} plan`,
    icon:  ICON,
    tag:   'new-subscriber',
    data:  { url: `/pwa?tab=activity&activityType=subscriber&userId=${encodeURIComponent(user.id)}`, type: 'subscriber', userId: user.id },
  }),

  newUser: (user) => sendToAdmins({
    title: '👤 New Registration',
    body:  `${user.name} (${user.email}) just signed up`,
    icon:  ICON,
    tag:   'new-user',
    data:  { url: `/pwa?tab=activity&activityType=subscriber&userId=${encodeURIComponent(user.id)}`, type: 'user', userId: user.id },
  }),

  paymentReceived: (user, amount, plan, paymentId = null) => sendToAdmins({
    title: '💰 Payment Received',
    body:  `₹${parseFloat(amount).toLocaleString('en-IN')} from ${user.name} — ${plan} plan`,
    icon:  ICON,
    tag:   'payment',
    data:  {
      url: `/pwa?tab=activity&activityType=payment&userId=${encodeURIComponent(user.id)}${paymentId ? `&paymentId=${encodeURIComponent(paymentId)}` : ''}`,
      type: 'payment',
      userId: user.id,
      paymentId,
    },
  }),

  paymentFailed: (email, amount) => sendToAdmins({
    title: '⚠️ Payment Failed',
    body:  `Payment of ₹${amount} failed for ${email}`,
    icon:  ICON,
    tag:   'payment-failed',
    data:  { url: '/pwa?tab=dashboard', type: 'payment-failed' },
  }),

  newAffiliateApplication: (affiliate) => sendToAdmins({
    title: '🤝 New Affiliate Application',
    body:  `${affiliate.name} applied to the affiliate programme`,
    icon:  ICON,
    tag:   'affiliate-application',
    data:  { url: `/pwa?tab=activity&activityType=affiliate&affiliateId=${encodeURIComponent(affiliate.id)}`, type: 'affiliate', affiliateId: affiliate.id },
  }),

  albumPublished: (albumName, ownerName) => sendToAdmins({
    title: '📚 Album Published',
    body:  `"${albumName}" by ${ownerName} is now live`,
    icon:  ICON,
    tag:   'album-published',
    data:  { url: '/pwa?tab=dashboard', type: 'album' },
  }),

  supportEmail: (fromName, fromEmail, subject, ticketId = null) => sendToAdmins({
    title: '📧 Support Message',
    body:  `${fromName} (${fromEmail}): ${subject}`,
    icon:  ICON,
    tag:   'support',
    data:  {
      url: `/pwa?tab=activity&activityType=support${ticketId ? `&ticketId=${encodeURIComponent(ticketId)}` : ''}`,
      type: 'support',
      ticketId,
    },
  }),

  custom: (title, body, tag = 'custom') => sendToAdmins({
    title, body, icon: ICON, tag,
    data: { url: '/pwa?tab=dashboard', type: tag },
  }),
  
  newTribute: (albumName, albumOwner, tributeName) => sendToUser(albumOwner.id, {
    title: '💬 New Tribute',
    body:  `${tributeName} left a tribute on "${albumName}"`,
    icon:  ICON,
    tag:   'new-tribute',
    data:  { url: '/dashboard', type: 'tribute', albumName },
  }),
};

module.exports = { notify, sendToAdmins, sendToUser, init };
