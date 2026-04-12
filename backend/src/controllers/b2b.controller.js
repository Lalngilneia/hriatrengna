'use strict';
const db  = require('../utils/db');
const bcrypt = require('bcryptjs');

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ── ADMIN: LIST BUSINESSES ────────────────────────────────────
exports.listBusinesses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const params = [];
    const conds  = [];

    if (status) { params.push(status); conds.push(`b.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(b.name ILIKE $${params.length} OR b.email ILIKE $${params.length})`);
    }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const cp    = [...params];
    params.push(limit, offset);

    const [rows, total] = await Promise.all([
      db.query(`
        SELECT b.*, COUNT(u.id)::int AS user_count
        FROM businesses b
        LEFT JOIN users u ON u.business_id = b.id
        ${where}
        GROUP BY b.id
        ORDER BY b.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      db.query(`SELECT COUNT(*) FROM businesses b ${where}`, cp),
    ]);

    res.json({
      businesses: rows.rows,
      total: parseInt(total.rows[0].count),
      page: +page, limit: +limit,
    });
  } catch (err) { next(err); }
};

// ── ADMIN: CREATE BUSINESS ────────────────────────────────────
exports.createBusiness = async (req, res, next) => {
  try {
    const { name, contactName, email, phone, address, gstin, albumQuota, notes } = req.body;

    if (!name?.trim() || !email)
      return res.status(400).json({ error: 'Business name and email are required.' });
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Invalid email address.' });

    const exists = await db.query('SELECT id FROM businesses WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rows.length)
      return res.status(409).json({ error: 'A business account with this email already exists.' });

    const result = await db.query(
      `INSERT INTO businesses (name, contact_name, email, phone, address, gstin, album_quota, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [name.trim(), contactName?.trim() || null, email.toLowerCase().trim(),
       phone?.trim() || null, address?.trim() || null, gstin?.trim() || null,
       albumQuota || 10, notes?.trim() || null]
    );
    res.status(201).json({ business: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: GET BUSINESS ───────────────────────────────────────
exports.getBusiness = async (req, res, next) => {
  try {
    const [biz, users] = await Promise.all([
      db.query('SELECT * FROM businesses WHERE id = $1', [req.params.businessId]),
      db.query(`
        SELECT u.id, u.name, u.email, u.subscription_status, u.created_at,
               COUNT(a.id)::int AS album_count
        FROM users u
        LEFT JOIN albums a ON a.user_id = u.id
        WHERE u.business_id = $1
        GROUP BY u.id ORDER BY u.created_at DESC
      `, [req.params.businessId]),
    ]);
    if (!biz.rows.length) return res.status(404).json({ error: 'Business not found.' });
    res.json({ business: biz.rows[0], users: users.rows });
  } catch (err) { next(err); }
};

// ── ADMIN: UPDATE BUSINESS ────────────────────────────────────
exports.updateBusiness = async (req, res, next) => {
  try {
    const { name, contactName, phone, address, gstin, albumQuota, status, notes } = req.body;

    const result = await db.query(
      `UPDATE businesses SET
         name         = COALESCE($1, name),
         contact_name = COALESCE($2, contact_name),
         phone        = COALESCE($3, phone),
         address      = COALESCE($4, address),
         gstin        = COALESCE($5, gstin),
         album_quota  = COALESCE($6, album_quota),
         status       = COALESCE($7, status),
         notes        = COALESCE($8, notes),
         updated_at   = NOW()
       WHERE id = $9 RETURNING *`,
      [name?.trim() || null, contactName?.trim() || null, phone?.trim() || null,
       address?.trim() || null, gstin?.trim() || null,
       albumQuota ?? null, status || null, notes ?? null,
       req.params.businessId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Business not found.' });
    res.json({ business: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: CREATE CLIENT USER UNDER BUSINESS ─────────────────
exports.createClientUser = async (req, res, next) => {
  try {
    const { name, email, password, albumQuotaOverride } = req.body;

    const bizRes = await db.query('SELECT * FROM businesses WHERE id = $1', [req.params.businessId]);
    if (!bizRes.rows.length) return res.status(404).json({ error: 'Business not found.' });
    const biz = bizRes.rows[0];

    if (biz.albums_used >= biz.album_quota)
      return res.status(400).json({
        error: `Business album quota (${biz.album_quota}) reached. Increase quota first.`,
      });

    if (!name?.trim() || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Invalid email address.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already in use.' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users
         (name, email, password_hash, is_email_verified, subscription_status, subscription_plan, business_id)
       VALUES ($1,$2,$3,true,'active','b2b',$4)
       RETURNING id, name, email, subscription_status, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash, biz.id]
    );

    // Increment business album usage
    await db.query(
      'UPDATE businesses SET albums_used = albums_used + 1, updated_at = NOW() WHERE id = $1',
      [biz.id]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: DELETE BUSINESS ────────────────────────────────────
exports.deleteBusiness = async (req, res, next) => {
  try {
    const bizRes = await db.query('SELECT name FROM businesses WHERE id = $1', [req.params.businessId]);
    if (!bizRes.rows.length) return res.status(404).json({ error: 'Business not found.' });

    // Unlink users (don't delete them — just remove business association)
    await db.query('UPDATE users SET business_id = NULL WHERE business_id = $1', [req.params.businessId]);
    await db.query('DELETE FROM businesses WHERE id = $1', [req.params.businessId]);
    res.json({ message: 'Business deleted. Client users are preserved.' });
  } catch (err) { next(err); }
};
