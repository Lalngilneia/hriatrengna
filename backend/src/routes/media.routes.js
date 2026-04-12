const express = require('express');
const router = express.Router();
const media = require('../controllers/media.controller');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(authMiddleware);
router.get('/:albumId',               media.list);
router.post('/:albumId/upload',       upload.single('file'), media.upload);
router.post('/:albumId/tribute',      media.addTribute);
router.put('/:albumId/:mediaId',     media.update);
router.delete('/:albumId/:mediaId',   media.delete);

module.exports = router;
