const express = require('express');
const router  = express.Router();
const pub     = require('../controllers/public.controller');
const wishes  = require('../controllers/wishes.controller');
const inv     = require('../controllers/invitation.controller');

router.get('/album/:slug',            pub.getAlbum);
router.post('/album/:slug/verify',    pub.verifyAlbumPassword);
router.post('/album/:slug/wishes',    wishes.submit);
router.get('/album/:slug/wishes',     wishes.listPublic);
router.get('/wedding/:slug',          pub.getWeddingCollection);

// Invitation
router.get('/invitation/:slug',       inv.getInvitation);
router.get('/invitation/:slug/image', inv.generateImage);   // ← server-side PNG
router.post('/invitation/:slug/rsvp', inv.submitRsvp);

module.exports = router;
