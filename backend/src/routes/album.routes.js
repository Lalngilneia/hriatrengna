const express   = require('express');
const router    = express.Router();
const album     = require('../controllers/album.controller');
const timeline  = require('../controllers/timeline.controller');
const analytics = require('../controllers/analytics.controller');
const auth      = require('../middleware/auth.middleware');
const upload    = require('../middleware/upload.middleware');

router.use(auth);

// ── STATIC ROUTES FIRST (must be before /:id dynamic param) ──
// Guest Wishes — subscriber moderation
// IMPORTANT: These MUST be above router.get('/:id', ...) or Express will
// match the literal string "wishes" as an album ID, returning 404.
const wishes = require('../controllers/wishes.controller');
router.get('/wishes',                wishes.list);
router.put('/wishes/:wishId',        wishes.moderate);
router.delete('/wishes/:wishId',     wishes.delete);

// CRUD
router.get('/',        album.list);
router.post('/',       album.create);
// Claimed albums — albums the user has access to via album_client_access
// MUST be before /:id to avoid Express matching 'claimed' as an album id
router.get('/claimed', album.listClaimed);
router.get('/:id',     album.getOne);
router.put('/:id',     album.update);
router.delete('/:id',  album.delete);

// QR Code
router.get('/:id/qr', album.getQR);

// QR Plaque Designer — ?format=png|pdf&theme=classic|dark|floral|traditional|minimal
router.get('/:id/plaque', album.downloadPlaque);

// Media uploads
router.post('/:id/avatar', upload.single('file'), album.uploadAvatar);
router.post('/:id/cover',  upload.single('file'), album.uploadCover);

// Background music
router.post('/:id/music',   upload.single('file'), album.uploadMusic);
router.delete('/:id/music', album.deleteMusic);

// Album settings
router.put('/:id/theme',    album.updateTheme);
router.put('/:id/password', album.setPassword);
router.put('/:id/heir',     album.setHeir);
router.put('/:id/nfc',      album.setNfc);

// Health score
router.get('/:id/health', album.healthScore);

// Analytics
router.get('/:albumId/analytics', analytics.getAlbumAnalytics);

// Life Events / Timeline
router.get('/:albumId/events',             timeline.list);
router.post('/:albumId/events',            timeline.create);
router.put('/:albumId/events/:eventId',    timeline.update);
router.delete('/:albumId/events/:eventId', timeline.delete);


// ── INVITATION ────────────────────────────────────────────────
const inv     = require('../controllers/invitation.controller');
const invUpload = upload.single('file');
router.put('/:id/invitation',              inv.updateInvitation);
router.post('/:id/invitation/avatar',      invUpload, inv.uploadInvitationAvatar);
router.post('/:id/invitation/cover',       invUpload, inv.uploadInvitationCover);
router.get('/:id/rsvps',                   inv.listRsvps);
router.delete('/:id/rsvps/:rsvpId',        inv.deleteRsvp);

module.exports = router;
