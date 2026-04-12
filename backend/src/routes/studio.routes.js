'use strict';
const express   = require('express');
const router    = express.Router();
const studio    = require('../controllers/studio.controller');
const billing   = require('../controllers/studio.billing.controller');
const invite    = require('../controllers/studio.invite.controller');
const studioMw  = require('../middleware/studio.middleware');
const authMw    = require('../middleware/auth.middleware');
const upload    = require('../middleware/upload.middleware');
const { requireStudioEntitlement } = require('../utils/studio-entitlement');

// ─────────────────────────────────────────────────────────────
// PUBLIC (no auth)
// ─────────────────────────────────────────────────────────────

// Client claim flow
router.get( '/claim/:token',  studio.checkClaim);
router.post('/claim/:token',  studio.claimAlbum);

// Studio invite acceptance
router.get( '/studio-invite/:token', invite.checkInvite);
router.post('/studio-invite/:token', invite.acceptInvite);

// Studio pricing plans (public — shown on pricing/landing pages)
router.get('/billing/plans', billing.getStudioPlans);

// ─────────────────────────────────────────────────────────────
// AUTH ONLY (no studio required yet — for studio creation)
// ─────────────────────────────────────────────────────────────
router.post('/', authMw, studio.createStudio);

// ─────────────────────────────────────────────────────────────
// STUDIO MEMBERS (requires valid JWT + studio membership)
// ─────────────────────────────────────────────────────────────
router.use(studioMw);

// ── Studio profile ──────────────────────────────────────────
router.get( '/me',               studio.getStudio);
router.put( '/me',               studio.updateStudio);
router.post('/me/logo', upload.single('file'), studio.uploadLogo);
router.get( '/me/stats',         studio.getStats);

// ── Multi-studio switcher ───────────────────────────────────
// Returns all studios the user belongs to (already on req.userStudios from middleware)
router.get('/switch', (req, res) => res.json({ studios: req.userStudios }));

// ── Billing (studio subscription) ──────────────────────────
router.get( '/billing/status',    billing.getBillingStatus);
router.post('/billing/subscribe', billing.createSubscription);
router.post('/billing/verify',    billing.verifyPayment);
router.post('/billing/cancel',    billing.cancelSubscription);

// ── Team invites ────────────────────────────────────────────
router.get(   '/invites',      invite.listInvites);
router.post(  '/invites',      invite.sendInvite);
router.delete('/invites/:id',  invite.revokeInvite);

// ── Features below require active studio subscription ───────
router.use(requireStudioEntitlement);

// ── Client albums ───────────────────────────────────────────
router.get(   '/albums',                   studio.listClientAlbums);
router.post(  '/albums',                   studio.createClientAlbum);
router.get(   '/albums/qr-sheet',          studio.bulkQrSheet);
router.get(   '/albums/:albumId',          studio.getClientAlbum);
router.delete('/albums/:albumId',          studio.deleteClientAlbum);
router.post(  '/albums/:albumId/send',     studio.sendClaimLink);
router.get(   '/albums/:albumId/customize', studio.getAlbumCustomization);
router.put(   '/albums/:albumId/customize', studio.customizeAlbum);

// ── Team members ────────────────────────────────────────────
router.get(   '/members',           studio.listMembers);
router.post(  '/members',           studio.inviteMember);   // proxies to invite flow
router.delete('/members/:userId',   studio.removeMember);

// ── Upsell alerts ───────────────────────────────────────────
router.get('/upsells',              studio.getUpsellAlerts);
router.put('/upsells/:id/resolve',  studio.resolveUpsell);

module.exports = router;
