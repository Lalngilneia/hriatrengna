'use strict';
const archiver = require('archiver');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const db = require('../utils/db');

const r2Client = new S3Client({
  region:   'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// ── STREAM R2 OBJECT ─────────────────────────────────────────
async function getR2Stream(key) {
  const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key });
  const response = await r2Client.send(cmd);
  return response.Body; // Node.js Readable stream
}

// ── GENERATE BACKUP ZIP ───────────────────────────────────────
// Returns a Promise that resolves when the archive is fully piped to res.
// Call as: await generateBackupZip(userId, res);
async function generateBackupZip(userId, outputStream) {
  // 1. Fetch all user data
  const [userRes, albumRes] = await Promise.all([
    db.query(
      `SELECT id, name, email, phone, subscription_status, subscription_plan,
              current_period_end, is_email_verified, created_at
       FROM users WHERE id = $1`,
      [userId]
    ),
    db.query(
      `SELECT a.*, json_agg(
         json_build_object(
           'id',            m.id,
           'type',          m.type,
           'r2_key',        m.r2_key,
           'file_name',     m.file_name,
           'caption',       m.caption,
           'tribute_text',  m.tribute_text,
           'tribute_from',  m.tribute_from,
           'created_at',    m.created_at
         ) ORDER BY m.display_order, m.created_at
       ) FILTER (WHERE m.id IS NOT NULL) AS media
       FROM albums a
       LEFT JOIN media m ON m.album_id = a.id
       WHERE a.user_id = $1
       GROUP BY a.id
       ORDER BY a.created_at`,
      [userId]
    ),
  ]);

  if (!userRes.rows.length) throw new Error('User not found.');
  const user   = userRes.rows[0];
  const albums = albumRes.rows;

  // 2. Create archive
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(outputStream);

  // 3. Add account JSON
  const accountData = {
    exported_at: new Date().toISOString(),
    account: user,
    albums: albums.map(a => ({
      id:          a.id,
      name:        a.name,
      slug:        a.slug,
      biography:   a.biography,
      birth_date:  a.birth_date,
      death_date:  a.death_date,
      is_published: a.is_published,
      view_count:  a.view_count,
      created_at:  a.created_at,
      media_count: (a.media || []).length,
      album_url:   `${process.env.APP_URL}/album/${a.slug}`,
    })),
  };
  archive.append(JSON.stringify(accountData, null, 2), { name: 'account-data.json' });

  // 4. Collect all R2 keys to download
  const downloads = [];
  for (const album of albums) {
    const safeName = album.name.replace(/[^a-z0-9]/gi, '_').substring(0, 40);

    // Album cover / avatar
    if (album.cover_key)  downloads.push({ key: album.cover_key,  path: `${safeName}/cover${extFrom(album.cover_key)}` });
    if (album.avatar_key) downloads.push({ key: album.avatar_key, path: `${safeName}/avatar${extFrom(album.avatar_key)}` });

    // Media files
    for (const item of (album.media || [])) {
      if (!item.r2_key) continue;
      const origName = item.file_name || `file${extFrom(item.r2_key)}`;
      const safeOrig = origName.replace(/[^a-z0-9._-]/gi, '_');
      downloads.push({ key: item.r2_key, path: `${safeName}/${item.type}s/${safeOrig}` });
    }

    // Per-album data JSON (includes tributes)
    const albumJson = {
      ...album,
      media: (album.media || []).map(m => ({
        ...m,
        file_url: m.r2_key ? `${process.env.R2_PUBLIC_URL}/${m.r2_key}` : null,
      })),
    };
    archive.append(JSON.stringify(albumJson, null, 2), { name: `${safeName}/album-data.json` });
  }

  // 5. Stream each R2 file into the archive
  for (const { key, path } of downloads) {
    try {
      const stream = await getR2Stream(key);
      archive.append(stream, { name: path });
    } catch (err) {
      console.error(`[BACKUP] Failed to fetch R2 key ${key}:`, err.message);
      // Add error placeholder so user knows the file was missing
      archive.append(`File unavailable: ${key}`, { name: `${path}.error.txt` });
    }
  }

  // 6. Finalize
  archive.finalize();

  return new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
    archive.on('error', reject);
  });
}

function extFrom(key) {
  const parts = key.split('.');
  return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
}

module.exports = { generateBackupZip };
