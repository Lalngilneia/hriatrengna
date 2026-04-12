'use strict';
const express = require('express');
const webhook = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/resend', webhook.resend);
router.post('/razorpay', webhook.razorpay);

module.exports = router;
