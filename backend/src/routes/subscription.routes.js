'use strict';

const express = require('express');
const auth = require('../middleware/auth.middleware');
const payment = require('../controllers/payment.controller');

const router = express.Router();

router.use(auth);
router.post('/:id/renew', payment.renewSubscription);

module.exports = router;
