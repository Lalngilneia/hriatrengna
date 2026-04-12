'use strict';
const db   = require('../utils/db');

// Load push service gracefully (may fail if Firebase not configured)
let push = null;
try { push = require('../services/push.service'); } catch (e) { console.warn('[PUSH CTRL] Push service not loaded:', e.message); }

// ── GET FIREBASE CONFIG ──────────────────────────────────────────
// GET /api/admin/push/vapid-key  (public — returns Firebase config for FCM)
exports.getVapidKey = (req, res) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const publicKey = process.env.FIREBASE_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!projectId || !publicKey) {
    return res.status(503).json({ error: 'Push notifications not configured.' });
  }
  
  res.json({ 
    publicKey,
    projectId: projectId,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  });
};
// ── SUBSCRIBE (Admin) ─────────────────────────────────────────────
// POST /api/admin/push/subscribe  (requires admin auth)
exports.subscribe = async (req, res, next) => {
  try {
    const fcmToken = req.body.fcmToken || req.body.token;
    const { deviceName } = req.body;
    if (!fcmToken)
      return res.status(400).json({ error: 'FCM token required.' });

    await db.query(
      `INSERT INTO fcm_tokens (admin_id, fcm_token, device_name, user_agent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [req.adminId, fcmToken, deviceName || null, req.headers['user-agent'] || null]
    );

    // Send a test notification to confirm it works (if push service available)
    if (push?.notify) push.notify.custom('✅ Notifications Active', 'You will now receive admin alerts on this device.', 'test').catch(() => {});

    res.json({ message: 'Subscribed successfully.' });
  } catch (err) { next(err); }
};

// ── SUBSCRIBE (User/PWA) ──────────────────────────────────────────
// POST /api/push/subscribe  (requires user auth)
exports.subscribeUser = async (req, res, next) => {
  try {
    const fcmToken = req.body.fcmToken || req.body.token;
    const { deviceName } = req.body;
    if (!fcmToken)
      return res.status(400).json({ error: 'FCM token required.' });

    await db.query(
      `INSERT INTO fcm_tokens (user_id, fcm_token, device_name, user_agent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [req.userId, fcmToken, deviceName || null, req.headers['user-agent'] || null]
    );

    res.json({ message: 'Subscribed successfully.' });
  } catch (err) { next(err); }
};

// ── UNSUBSCRIBE ─────────────────────────────────────────────────
// DELETE /api/admin/push/subscribe  (requires admin auth)
exports.unsubscribe = async (req, res, next) => {
  try {
    const fcmToken = req.body.fcmToken || req.body.token;
    if (!fcmToken) return res.status(400).json({ error: 'FCM token required.' });
    
    await db.query(
      'DELETE FROM fcm_tokens WHERE fcm_token = $1 AND (admin_id = $2 OR user_id = $2)',
      [fcmToken, req.adminId]
    );
    res.json({ message: 'Unsubscribed.' });
  } catch (err) { next(err); }
};

// ── LIST DEVICES ─────────────────────────────────────────────────
// GET /api/admin/push/devices
exports.listDevices = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, device_name, user_agent, created_at, last_used_at, active 
       FROM fcm_tokens WHERE admin_id = $1 ORDER BY last_used_at DESC`,
      [req.adminId]
    );
    res.json({ devices: result.rows });
  } catch (err) { next(err); }
};

// ── SEND TEST NOTIFICATION ───────────────────────────────────────
// POST /api/admin/push/test
exports.sendTest = async (req, res, next) => {
  try {
    if (push?.notify) {
      const result = await push.notify.custom('🔔 Test Notification', 'Push notifications are working correctly!', 'test');
      if (!result?.ok) {
        return res.status(503).json({ error: result?.reason || 'Push notification delivery failed.' });
      }
      return res.json({
        message: 'Test notification sent.',
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
      });
    }
    res.status(503).json({ error: 'Push service is not configured.' });
  } catch (err) { next(err); }
};
