const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Load push controller gracefully (may fail if Firebase not configured)
let push = null;
try { push = require('../controllers/push.controller'); } catch (e) { console.warn('[ROUTES] Push controller not loaded:', e.message); }

router.post('/register',            auth.register);
router.post('/login',               auth.login);
router.post('/refresh',             auth.refreshToken); // Silent token renewal
router.get('/verify-email',         auth.verifyEmail);   // GET ?token= (email link)
router.post('/verify-email',        auth.verifyEmail);   // POST { token } (frontend JS)
router.post('/resend-verification', auth.resendVerification);
router.post('/forgot-password',     auth.forgotPassword);
router.post('/reset-password',      auth.resetPassword);
router.get('/me',                   authMiddleware, auth.me);
router.put('/change-password',      authMiddleware, auth.changePassword);
router.put('/profile',              authMiddleware, auth.updateProfile);
router.post('/profile-photo',       authMiddleware, upload.single('file'), auth.uploadProfilePhoto);
router.post('/cover-photo',         authMiddleware, upload.single('file'), auth.uploadCoverPhoto);

// Google OAuth
router.get('/google/url',          auth.googleAuthUrl);
router.post('/google',              auth.googleAuth);

// Push notifications (user)
if (push) router.post('/push/subscribe', authMiddleware, push.subscribeUser);

// Demo account — public, rate-limited
router.post('/demo', auth.registerDemo);

module.exports = router;
