const multer = require('multer');
const { ALLOWED, MAX_SIZE } = require('../services/r2.service');

// Store in memory — we stream directly to R2
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allAllowed = [...ALLOWED.photo, ...ALLOWED.video, ...ALLOWED.audio];
  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error(`File type not supported: ${file.mimetype}`), { status: 400 }), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE.video, // Use highest limit; per-type validation happens in R2 service
    files: 1,
  },
});

module.exports = upload;
