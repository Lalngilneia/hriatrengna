'use strict';
/**
 * studio.middleware.js
 *
 * Authenticates the request and attaches studio context.
 * Does NOT enforce subscription entitlement here — call
 * requireStudioEntitlement() in routes that need it.
 *
 * Fixes:
 *  - Multi-studio support: studio is selected by explicit studioId
 *    query param or x-studio-id header; falls back to first found.
 *  - No longer accepts legacy business subscription_plan values as implicit studio auth.
 */

const jwt = require('jsonwebtoken');
const db  = require('../utils/db');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required.' });

    const token   = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError')
        return res.status(401).json({ error: 'Session expired.' });
      return res.status(401).json({ error: 'Invalid token.' });
    }

    const userRes = await db.query(
      'SELECT id, token_version FROM users WHERE id = $1', [decoded.userId]
    );
    if (!userRes.rows.length) return res.status(401).json({ error: 'User not found.' });

    const user = userRes.rows[0];
    if (user.token_version > (decoded.tokenVersion || 0))
      return res.status(401).json({ error: 'Session invalidated.' });

    req.userId = decoded.userId;

    // Optional explicit studio selection (multi-studio support)
    const requestedStudioId =
      req.headers['x-studio-id'] ||
      req.query.studioId         ||
      null;

    // Load all studios this user belongs to (owner or member)
    // Role sort keeps owners first when no explicit studio is requested.
    const studiosRes = await db.query(
      `SELECT s.*, 'owner' AS role
       FROM studios s
       WHERE s.owner_user_id = $1 AND s.is_active = TRUE
       UNION
       SELECT s.*, sm.role
       FROM studios s
       JOIN studio_members sm ON sm.studio_id = s.id
       WHERE sm.user_id = $1 AND s.is_active = TRUE
       ORDER BY role DESC`,
      [decoded.userId]
    );

    if (!studiosRes.rows.length)
      return res.status(403).json({ error: 'No studio account found.', code: 'NO_STUDIO' });

    // Pick the requested studio, or the first one
    let chosen;
    if (requestedStudioId) {
      chosen = studiosRes.rows.find(s => s.id === requestedStudioId);
      if (!chosen)
        return res.status(403).json({ error: 'Studio not found or access denied.', code: 'STUDIO_NOT_FOUND' });
    } else {
      chosen = studiosRes.rows[0];
    }

    req.studio     = chosen;
    req.studioId   = chosen.id;
    req.studioRole = chosen.role;

    // Expose all studio IDs for multi-studio switcher in the response
    req.userStudios = studiosRes.rows.map(s => ({ id: s.id, name: s.name, role: s.role }));

    next();
  } catch (err) {
    next(err);
  }
};
