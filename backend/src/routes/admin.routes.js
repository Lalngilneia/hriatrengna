const express   = require('express');
const router    = express.Router();
const admin     = require('../controllers/admin.controller');
const affiliate = require('../controllers/affiliate.controller');
const push      = require('../controllers/push.controller');
const adminAuth = require('../middleware/admin.middleware');
const upload    = require('../middleware/upload.middleware');

// ── Public ────────────────────────────────────────────────────
router.post('/auth/login',     admin.login);
router.get('/sample-albums',   admin.getSampleAlbums); // Public — homepage QR display

// Public push key endpoint (needed before login)
router.get('/push/vapid-key',  push.getVapidKey);

// ── Protected ─────────────────────────────────────────────────
router.use(adminAuth);

// Auth
router.get('/auth/me',               admin.me);
router.put('/auth/change-password',  admin.changePassword);

// Push Notifications
router.post('/push/subscribe',       push.subscribe);
router.delete('/push/subscribe',     push.unsubscribe);
router.get('/push/devices',          push.listDevices);
router.post('/push/test',            push.sendTest);

// Dashboard
router.get('/dashboard',             admin.dashboard);

// Users / Subscribers
router.get('/users',                 admin.listUsers);
router.post('/users',                admin.createUser);
router.get('/users/:userId',         admin.getUser);
router.put('/users/:userId',         admin.updateUser);
router.delete('/users/:userId',      admin.deleteUser);
router.get('/users/:userId/albums',  admin.getUserAlbums);
router.get('/users/:userId/backup',  admin.downloadBackup);

// ── NEW: User subscription config + limit override ────────────
router.get('/users/:userId/subscription-config',   admin.getUserSubscriptionConfig);
router.patch('/users/:userId/subscription-config', admin.overrideUserConfig);

// Albums
router.get('/albums',                admin.listAlbums);
router.post('/albums',               admin.createAlbum);
router.put('/albums/:albumId',       admin.updateAlbum);
router.delete('/albums/:albumId',    admin.deleteAlbum);

// Admin Media Management
router.get('/albums/:albumId/media',              admin.adminGetAlbumMedia);
router.post('/albums/:albumId/media',             upload.single('file'), admin.adminUploadMedia);
router.post('/albums/:albumId/media/tribute',     admin.adminAddTribute);
router.delete('/albums/:albumId/media/:mediaId',  admin.adminDeleteMedia);

// Pricing Plans (legacy — kept for studio plans and historical records)
router.get('/plans',                 admin.listPlans);
router.put('/plans/:planId',         admin.updatePlan);

// ── NEW: Custom Addon Pricing (admin-editable) ────────────────
router.get('/addon-pricing',               admin.getAddonPricing);
router.patch('/addon-pricing/:key',        admin.updateAddonPrice);

// ── NEW: Custom Base Pricing (admin-editable) ─────────────────
router.get('/base-pricing',                         admin.getBasePricing);
router.patch('/base-pricing/:planType/:lengthMonths', admin.updateBasePricing);

// ── NEW: Physical Orders (QR print / NFC tag fulfillment) ─────
router.get('/physical-orders',             admin.getPhysicalOrders);
router.patch('/physical-orders/:orderId',  admin.updatePhysicalOrder);

// App Settings
router.get('/settings',              admin.getSettings);
router.put('/settings',              admin.updateSettings);

// Transactions
router.get('/transactions',          admin.listTransactions);
router.get('/refunds',               admin.listRefundRequests);
router.patch('/refunds/:refundId',   admin.updateRefundRequest);
router.post('/refunds/:refundId/process', admin.processRefundRequest);

// Invoices
router.get('/invoices',                         admin.listInvoices);
router.get('/invoices/:invoiceId/download',     admin.downloadInvoice);

// Support CRM
router.get('/support/inbox',                    admin.listSupportInbox);
router.get('/support/inbox/:ticketId',          admin.getSupportTicket);
router.put('/support/inbox/:ticketId',          admin.updateSupportTicket);
router.post('/support/inbox/:ticketId/reply',   admin.replyToSupportTicket);

// Affiliates
router.get('/affiliates',                                          affiliate.listAffiliates);
router.get('/affiliates/:affiliateId',                             affiliate.getAffiliate);
router.put('/affiliates/:affiliateId',                             affiliate.updateAffiliate);
router.post('/affiliates/:affiliateId/commissions/pay',            affiliate.markCommissionsPaid);

// Activity Log
router.get('/logs',                  admin.activityLog);

// Cron Manual Triggers
router.post('/cron/run/:job',        admin.runCronJob);

// Studio Management
router.get( '/studios',                              admin.listStudios);
router.get( '/studios/:studioId',                    admin.getStudioAdmin);
router.patch('/studios/:studioId',                   admin.updateStudioAdmin);
router.post('/studios/:studioId/grant-subscription', admin.grantStudioSubscription);

// Guest Wishes — admin moderation
const wishes = require('../controllers/wishes.controller');
router.get('/wishes',                    wishes.adminList);
router.put('/wishes/:wishId',            wishes.moderate);

// Chat Escalations
const chat = require('../controllers/chat.controller');
router.get('/chat/escalations',          chat.adminEscalations);

module.exports = router;
