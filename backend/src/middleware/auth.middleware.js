const jwt = require('jsonwebtoken');
const db = require('../utils/db');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists
    const result = await db.query(
      'SELECT id, subscription_status, token_version FROM users WHERE id = $1', [decoded.userId]
    );
    if (!result.rows.length)
      return res.status(401).json({ error: 'User no longer exists.' });

    // Check token_version to invalidate sessions after password reset
    const user = result.rows[0];
    const tokenVersion = decoded.tokenVersion || 0;
    if (user.token_version > tokenVersion)
      return res.status(401).json({ error: 'Session invalidated. Please sign in again.' });

    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
};
