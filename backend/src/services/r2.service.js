const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 }   = require('uuid');
const fs               = require('fs/promises');
const os               = require('os');
const path             = require('path');
const { spawn, spawnSync } = require('child_process');
const sharp            = require('sharp');

const r2 = new S3Client({
  region:   'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

// ── IMAGE COMPRESSION SETTINGS ───────────────────────────────────
const MAX_IMAGE_DIMENSION = 2048;  // Max width/height in pixels
const COMPRESSION_QUALITY = 80;    // JPEG/WebP quality (0-100)
const VIDEO_TARGET_LONG_EDGE = 1920; // 1080p landscape / 1080x1920 portrait

let ffmpegAvailableCache;

function hasFfmpeg() {
  if (ffmpegAvailableCache !== undefined) return ffmpegAvailableCache;
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  ffmpegAvailableCache = probe.status === 0;
  if (!ffmpegAvailableCache) {
    console.warn('[VIDEO] ffmpeg not found. Videos will upload without 1080p compression.');
  }
  return ffmpegAvailableCache;
}

// ── COMPRESS IMAGE ──────────────────────────────────────────────
async function compressImage(buffer, mimetype) {
  const image = sharp(buffer, { failOn: 'none' });
  const metadata = await image.metadata();

  // Check if already smaller than max dimension
  const needsResize = metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION;
  
  let processed = image;

  // Resize if too large
  if (needsResize) {
    processed = processed.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Auto-orient based on EXIF so portrait photos keep the expected display orientation.
  processed = processed.rotate();

  // Convert to WebP for better compression (widely supported)
  // WebP typically gives 25-35% smaller files than JPEG at same quality
  processed = processed.webp({ quality: COMPRESSION_QUALITY });

  const compressedBuffer = await processed.toBuffer();
  
  return {
    buffer: compressedBuffer,
    size: compressedBuffer.length,
    savedPercent: Math.round((1 - compressedBuffer.length / buffer.length) * 100),
  };
}

async function compressVideo(buffer, originalname, mimetype) {
  if (!hasFfmpeg()) {
    return {
      buffer,
      mimetype,
      size: buffer.length,
      savedPercent: 0,
      transcoded: false,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mqr-video-'));
  const inputExt = path.extname(originalname || '') || '.bin';
  const inputPath = path.join(tempDir, `input${inputExt}`);
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    await fs.writeFile(inputPath, buffer);

    await new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', inputPath,
        '-vf', `scale='if(gte(iw,ih),min(${VIDEO_TARGET_LONG_EDGE},iw),-2)':'if(gte(iw,ih),-2,min(${VIDEO_TARGET_LONG_EDGE},ih))'`,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', '128k',
        outputPath,
      ];

      const child = spawn('ffmpeg', args, { windowsHide: true });
      let stderr = '';

      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0) return resolve();
        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      });
    });

    const compressedBuffer = await fs.readFile(outputPath);
    return {
      buffer: compressedBuffer,
      mimetype: 'video/mp4',
      size: compressedBuffer.length,
      savedPercent: Math.round((1 - compressedBuffer.length / buffer.length) * 100),
      transcoded: true,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── ALLOWED MIME TYPES ────────────────────────────────────────
const ALLOWED = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac'],
};

const MAX_SIZE = {
  photo: 20  * 1024 * 1024,  // 20 MB
  video: 500 * 1024 * 1024,  // 500 MB
  audio: 50  * 1024 * 1024,  // 50 MB
};

// ── SAFE KEY GENERATION ───────────────────────────────────────
const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav',
  'audio/ogg': 'ogg', 'audio/aac': 'aac',
};

function generateKey(albumId, type, originalName, mimetype) {
  // Photos are re-encoded to webp. Videos keep their final post-processing extension.
  const ext = type === 'photo' ? 'webp' : (MIME_EXT[mimetype] || 'bin');
  return `albums/${albumId}/${type}s/${uuidv4()}.${ext}`;
}

// ── UPLOAD FILE BUFFER ────────────────────────────────────────
async function uploadFile({ buffer, mimetype, originalname, albumId, type }) {
  if (!ALLOWED[type] || !ALLOWED[type].includes(mimetype)) {
    throw Object.assign(
      new Error(`File type ${mimetype} not allowed for ${type}`), { status: 400 }
    );
  }
  if (buffer.length > MAX_SIZE[type]) {
    const mb = Math.round(MAX_SIZE[type] / 1024 / 1024);
    throw Object.assign(
      new Error(`File too large. Max ${mb}MB for ${type}s.`), { status: 400 }
    );
  }

  let uploadBuffer = buffer;
  let contentType = mimetype;
  let savedSize = 0;
  let transcoded = false;

  // Compress images (JPEG, PNG, WebP, GIF) before upload
  if (type === 'photo' && mimetype.startsWith('image/')) {
    try {
      const compressed = await compressImage(buffer, mimetype);
      uploadBuffer = compressed.buffer;
      savedSize = compressed.savedPercent;
      contentType = 'image/webp'; // Always use WebP after compression
      console.log(`[IMAGE] Compressed ${originalname}: ${compressed.savedPercent}% smaller (${Math.round(buffer.length/1024)}KB → ${Math.round(compressed.buffer.length/1024)}KB)`);
    } catch (err) {
      console.error('[IMAGE] Compression failed, uploading original:', err.message);
      // Upload original if compression fails
    }
  }

  if (type === 'video' && mimetype.startsWith('video/')) {
    try {
      const compressed = await compressVideo(buffer, originalname, mimetype);
      uploadBuffer = compressed.buffer;
      contentType = compressed.mimetype;
      savedSize = compressed.savedPercent;
      transcoded = compressed.transcoded;
      if (compressed.transcoded) {
        console.log(`[VIDEO] Compressed ${originalname} to 1080p MP4: ${compressed.savedPercent}% smaller (${Math.round(buffer.length / 1024 / 1024)}MB -> ${Math.round(compressed.buffer.length / 1024 / 1024)}MB)`);
      }
    } catch (err) {
      console.error('[VIDEO] Compression failed, uploading original:', err.message);
    }
  }

  const key = generateKey(albumId, type, originalname, contentType);

  await r2.send(new PutObjectCommand({
    Bucket:       BUCKET,
    Key:          key,
    Body:         uploadBuffer,
    ContentType:  contentType,
    CacheControl: 'public, max-age=31536000',  // 1 year
    // Disable public ACL — we use CDN domain (R2_PUBLIC_URL) instead
  }));

  return {
    key,
    url:  `${process.env.R2_PUBLIC_URL}/${key}`,
    size: uploadBuffer.length,
    contentType,
    savedPercent: savedSize,
    transcoded,
  };
}

// ── DELETE FILE ───────────────────────────────────────────────
async function deleteFile(key) {
  if (!key) return;
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    // Log but don't throw — file may already be deleted
    console.error('[R2] Delete failed:', err.message);
  }
}

// ── SIGNED URL (for private files if needed) ─────────────────
async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
}

// ── PUBLIC URL ────────────────────────────────────────────────
function getPublicUrl(key) {
  if (!key) return null;
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

module.exports = { uploadFile, deleteFile, getSignedDownloadUrl, getPublicUrl, ALLOWED, MAX_SIZE };
