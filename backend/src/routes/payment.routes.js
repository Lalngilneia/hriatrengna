const express = require('express');
const router  = express.Router();
const payment = require('../controllers/payment.controller');
const webhook = require('../controllers/webhook.controller');
const auth    = require('../middleware/auth.middleware');

// ── Public ────────────────────────────────────────────────────
// Pricing configurator data (replaces GET /plans)
router.get('/pricing-options',              payment.getPricingOptions);

// Live price calculation — no payment created, no auth needed
router.post('/calculate',                   payment.calculatePrice);

// Razorpay Webhook — raw body parsing handled in app.js BEFORE express.json()
// so the HMAC is computed over the original byte stream. No auth middleware.
router.post('/webhook',                     webhook.razorpay);

// ── Protected ─────────────────────────────────────────────────
router.use(auth);

// Custom subscription (monthly recurring)
router.post('/create-subscription',         payment.createCustomSubscription);

// Custom order (upfront one-time payment)
router.post('/create-order',                payment.createCustomOrder);

// Verify payment — handles both monthly and upfront modes
router.post('/verify',                      payment.verifyCustomPayment);

// Subscription management
router.post('/cancel',                      payment.cancelSubscription);
router.get('/status',                       payment.status);

// Physical QR / NFC orders
router.post('/physical-order',              payment.createPhysicalOrder);
router.post('/verify-physical',             payment.verifyPhysicalPayment);
router.get('/physical-orders',              payment.getUserPhysicalOrders);

// Invoices
router.get('/invoices',                     payment.listInvoices);
router.get('/invoices/:invoiceId/download', payment.downloadInvoice);

// Refunds
router.get('/refunds',                      payment.listRefundRequests);
router.post('/refunds/request',             payment.requestRefund);

module.exports = router;
