'use strict';
const jwt = require('jsonwebtoken');
const db  = require('../utils/db');

// Verifies a JWT issued to an affiliate (not a regular user)
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Affiliate authentication required.' });

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET || process.env.JWT_SECRET);

    if (!decoded.affiliateId)
      return res.status(401).json({ error: 'Invalid affiliate token.' });

    const result = await db.query(
      'SELECT id, status, token_version FROM affiliates WHERE id = $1',
      [decoded.affiliateId]
    );

    if (!result.rows.length)
      return res.status(401).json({ error: 'Affiliate account not found.' });

    const affiliate = result.rows[0];
    const tokenVersion = decoded.tokenVersion || 0;
    if (affiliate.token_version > tokenVersion)
      return res.status(401).json({ error: 'Session invalidated. Please sign in again.' });

    req.affiliateId = decoded.affiliateId;
    req.affiliate   = affiliate;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
};
