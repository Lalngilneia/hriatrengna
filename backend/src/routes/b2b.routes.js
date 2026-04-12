const express = require('express');
const router  = express.Router();
const b2b     = require('../controllers/b2b.controller');
const adminAuth = require('../middleware/admin.middleware');

router.use(adminAuth);

router.get('/',                               b2b.listBusinesses);
router.post('/',                              b2b.createBusiness);
router.get('/:businessId',                    b2b.getBusiness);
router.put('/:businessId',                    b2b.updateBusiness);
router.delete('/:businessId',                 b2b.deleteBusiness);
router.post('/:businessId/clients',           b2b.createClientUser);

module.exports = router;
