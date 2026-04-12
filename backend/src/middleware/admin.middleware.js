const jwt = require('jsonwebtoken');
const db = require('../utils/db');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Admin authentication required.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    if (decoded.type !== 'admin')
      return res.status(403).json({ error: 'Access denied.' });

    const result = await db.query(
      'SELECT * FROM admins WHERE id = $1', [decoded.adminId]
    );
    const admin = result.rows[0];

    if (!admin || !admin.is_active)
      return res.status(403).json({ error: 'Admin account not found or disabled.' });

    // FIX: Validate token_version so password changes invalidate all existing sessions
    const tokenVersion = decoded.tokenVersion || 0;
    if (admin.token_version > tokenVersion)
      return res.status(401).json({ error: 'Session invalidated. Please sign in again.' });

    req.adminId = admin.id;
    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
    return res.status(401).json({ error: 'Invalid admin token.' });
  }
};
