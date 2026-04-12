'use strict';
const db = require('../utils/db');

// ── ACCESS HELPER ─────────────────────────────────────────────
// Returns true if userId owns the album OR has album_client_access with
// at minimum client_viewer role (for reads) or client_editor (for writes).
async function hasAlbumAccess(albumId, userId, requireEditor = false) {
  // Owner check
  const own = await db.query(
    'SELECT id FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]
  );
  if (own.rows.length) return true;

  // Client access check
  const req = await db.query(
    'SELECT role FROM album_client_access WHERE album_id = $1 AND user_id = $2',
    [albumId, userId]
  );
  if (!req.rows.length) return false;
  if (requireEditor) return req.rows[0].role === 'client_editor';
  return true; // client_viewer or client_editor both OK for reads
}

// ── CREATE LIFE EVENT ─────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const { title, description, eventDate, eventYear, icon, displayOrder } = req.body;

    const VALID_ICONS = ['star','heart','education','work','wedding','travel','award','home','music','baby','flag','gift','camera','book','globe'];

    if (!title?.trim())
      return res.status(400).json({ error: 'Event title is required.' });
    if (title.trim().length > 255)
      return res.status(400).json({ error: 'Title must be 255 characters or less.' });
    if (description && description.length > 2000)
      return res.status(400).json({ error: 'Description must be 2000 characters or less.' });
    if (icon && !VALID_ICONS.includes(icon))
      return res.status(400).json({ error: `Invalid icon. Choose from: ${VALID_ICONS.join(', ')}` });

    const safeOrder = Math.min(Math.max(0, parseInt(displayOrder) || 0), 9999);

    // Allow owner OR client_editor
    if (!(await hasAlbumAccess(albumId, req.userId, true)))
      return res.status(404).json({ error: 'Album not found.' });

    const ed = eventDate ? String(eventDate).substring(0, 10) : null;
    const ey = ed ? new Date(ed).getFullYear() : (eventYear ? Math.min(Math.max(1800, parseInt(eventYear)), new Date().getFullYear()) : null);

    const result = await db.query(
      `INSERT INTO life_events (album_id, title, description, event_date, event_year, icon, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [albumId, title.trim(), description?.trim() || null, ed, ey, icon || 'star', safeOrder]
    );
    res.status(201).json({ event: result.rows[0] });
  } catch (err) { next(err); }
};

// ── LIST LIFE EVENTS ──────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { albumId } = req.params;

    // Allow owner OR any client (viewer or editor can read events)
    if (!(await hasAlbumAccess(albumId, req.userId, false)))
      return res.status(404).json({ error: 'Album not found.' });

    const result = await db.query(
      'SELECT * FROM life_events WHERE album_id = $1 ORDER BY event_date ASC NULLS LAST, display_order ASC',
      [albumId]
    );
    res.json({ events: result.rows });
  } catch (err) { next(err); }
};

// ── UPDATE LIFE EVENT ─────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { title, description, eventDate, eventYear, icon, displayOrder } = req.body;

    // Fetch the event first to get its album_id
    const eventRow = await db.query(
      'SELECT * FROM life_events WHERE id = $1', [req.params.eventId]
    );
    if (!eventRow.rows.length)
      return res.status(404).json({ error: 'Event not found.' });

    // Allow owner OR client_editor
    if (!(await hasAlbumAccess(eventRow.rows[0].album_id, req.userId, true)))
      return res.status(404).json({ error: 'Event not found.' });

    // Build SET clause dynamically to avoid COALESCE wiping optional fields
    const setParts = [];
    const params   = [];
    let   pi       = 1;
    const add = (col, val) => { setParts.push(col + ' = $' + pi++); params.push(val); };

    if (title        !== undefined) add('title',         title.trim() || null);
    if (description  !== undefined) add('description',   description?.trim() || null);
    if (icon         !== undefined) add('icon',          icon || 'star');
    if (displayOrder !== undefined) add('display_order', Math.min(Math.max(0, parseInt(displayOrder) || 0), 9999));

    if (eventDate !== undefined) {
      const ed = eventDate || null;
      const ey = ed ? new Date(ed).getFullYear() : null;
      add('event_date', ed);
      add('event_year', ey);
    } else if (eventYear !== undefined) {
      add('event_year', eventYear ? parseInt(eventYear) : null);
    }

    if (!setParts.length)
      return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.eventId);
    const result = await db.query(
      'UPDATE life_events SET ' + setParts.join(', ') + ' WHERE id = $' + pi + ' RETURNING *',
      params
    );
    res.json({ event: result.rows[0] });
  } catch (err) { next(err); }
};

// ── DELETE LIFE EVENT ─────────────────────────────────────────
exports.delete = async (req, res, next) => {
  try {
    // Fetch event to get album_id
    const eventRow = await db.query(
      'SELECT * FROM life_events WHERE id = $1', [req.params.eventId]
    );
    if (!eventRow.rows.length)
      return res.status(404).json({ error: 'Event not found.' });

    // Allow owner OR client_editor
    if (!(await hasAlbumAccess(eventRow.rows[0].album_id, req.userId, true)))
      return res.status(404).json({ error: 'Event not found.' });

    await db.query('DELETE FROM life_events WHERE id = $1', [req.params.eventId]);
    res.json({ message: 'Event deleted.' });
  } catch (err) { next(err); }
};
