const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) AS unit_count
       FROM properties p WHERE p.owner_id = ? ORDER BY p.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const property = db
    .prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?')
    .get(req.params.id, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  const units = db.prepare('SELECT * FROM units WHERE property_id = ? ORDER BY unit_number').all(property.id);
  res.json({ ...property, units });
});

router.post('/', (req, res) => {
  const { name, address_line1, address_line2, city, state, zip, notes, property_type } = req.body;
  if (!name || !address_line1) return res.status(400).json({ error: 'name and address_line1 are required' });
  const info = db
    .prepare(
      `INSERT INTO properties (owner_id, name, address_line1, address_line2, city, state, zip, notes, property_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      name,
      address_line1,
      address_line2 || null,
      city || null,
      state || null,
      zip || null,
      notes || null,
      property_type || null
    );
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(property);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });
  const { name, address_line1, address_line2, city, state, zip, notes, property_type } = req.body;
  db.prepare(
    `UPDATE properties SET name = ?, address_line1 = ?, address_line2 = ?, city = ?, state = ?, zip = ?, notes = ?,
     property_type = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    address_line1 ?? existing.address_line1,
    address_line2 ?? existing.address_line2,
    city ?? existing.city,
    state ?? existing.state,
    zip ?? existing.zip,
    notes ?? existing.notes,
    property_type ?? existing.property_type,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM properties WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
