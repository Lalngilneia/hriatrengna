const express            = require('express');
const router             = express.Router();
const affiliate          = require('../controllers/affiliate.controller');
const affiliateMiddleware = require('../middleware/affiliate.middleware');
const adminMiddleware    = require('../middleware/admin.middleware');

// ── PUBLIC: VALIDATE REFERRAL CODE ───────────────────────────
router.get('/validate/:code', affiliate.validateCode);

// ── AFFILIATE SELF-AUTH (email/password, no Google) ───────────
router.post('/auth/register',                affiliate.authRegister);
router.get('/auth/verify-email',             affiliate.verifyEmail);
router.post('/auth/login',                   affiliate.authLogin);
router.post('/auth/forgot-password',         affiliate.forgotPassword);
router.post('/auth/reset-password',          affiliate.resetPassword);
router.post('/auth/resend-verification',     affiliate.resendVerification);

// ── AFFILIATE DASHBOARD (requires affiliate JWT) ──────────────
router.get('/me',                 affiliateMiddleware, affiliate.getMe);
router.put('/me',                 affiliateMiddleware, affiliate.updateMe);
router.get('/me/commissions',     affiliateMiddleware, affiliate.myCommissions);

// ── SUBSCRIBER: VIEW OWN AFFILIATE DATA ──────────────────────
const subscriberAuth = require('../middleware/auth.middleware');
router.get('/me/subscriber', subscriberAuth, affiliate.getUserAffiliateData);

// ── ADMIN-ONLY ROUTES ─────────────────────────────────────────
router.get('/',                                  adminMiddleware, affiliate.listAffiliates);
router.get('/:affiliateId',                      adminMiddleware, affiliate.getAffiliate);
router.put('/:affiliateId',                      adminMiddleware, affiliate.updateAffiliate);
router.delete('/:affiliateId',                   adminMiddleware, affiliate.deleteAffiliate);
router.post('/:affiliateId/commissions/pay',     adminMiddleware, affiliate.markCommissionsPaid);
router.post('/:affiliateId/verify-email',        adminMiddleware, affiliate.adminVerifyAffiliate);

module.exports = router;
