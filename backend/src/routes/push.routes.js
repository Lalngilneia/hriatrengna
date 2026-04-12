'use strict';
const express = require('express');
const router  = express.Router();
const push    = require('../controllers/push.controller');
const auth    = require('../middleware/auth.middleware');

// ── USER PUSH NOTIFICATION ROUTES ─────────────────────────────
// These allow subscriber PWA to register/unregister FCM tokens.

router.use(auth);

// Register FCM token for current user
router.post('/subscribe',   push.subscribeUser);

// Unsubscribe (delete token)
router.delete('/subscribe', async (req, res, next) => {
  try {
    const fcmToken = req.body.fcmToken || req.body.token;
    if (!fcmToken) return res.status(400).json({ error: 'FCM token required.' });
    const db = require('../utils/db');
    await db.query(
      'DELETE FROM fcm_tokens WHERE fcm_token = $1 AND user_id = $2',
      [fcmToken, req.userId]
    );
    res.json({ message: 'Unsubscribed.' });
  } catch (err) { next(err); }
});
module.exports = router;
