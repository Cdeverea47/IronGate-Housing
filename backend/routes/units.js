const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

function ownsProperty(propertyId, userId) {
  return db.prepare('SELECT id FROM properties WHERE id = ? AND owner_id = ?').get(propertyId, userId);
}

function ownsUnit(unitId, userId) {
  return db
    .prepare(
      `SELECT u.* FROM units u JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND p.owner_id = ?`
    )
    .get(unitId, userId);
}

// list units, optionally filtered by property
router.get('/', (req, res) => {
  const { property_id } = req.query;
  let rows;
  if (property_id) {
    if (!ownsProperty(property_id, req.user.id)) return res.status(404).json({ error: 'Property not found' });
    rows = db.prepare('SELECT * FROM units WHERE property_id = ? ORDER BY unit_number').all(property_id);
  } else {
    rows = db
      .prepare(
        `SELECT u.* FROM units u JOIN properties p ON p.id = u.property_id
         WHERE p.owner_id = ? ORDER BY u.created_at DESC`
      )
      .all(req.user.id);
  }
  res.json(rows);
});

router.post('/', (req, res) => {
  const { property_id, unit_number, bedrooms, bathrooms, rent_amount, status } = req.body;
  if (!property_id) return res.status(400).json({ error: 'property_id is required' });
  if (!ownsProperty(property_id, req.user.id)) return res.status(404).json({ error: 'Property not found' });

  // Unit number is optional — useful for a single-family home or any property
  // with just one unit. If left blank, number it based on how many units the
  // property already has (1, 2, 3, ...).
  let resolvedUnitNumber = unit_number && String(unit_number).trim();
  if (!resolvedUnitNumber) {
    const existingCount = db.prepare('SELECT COUNT(*) c FROM units WHERE property_id = ?').get(property_id).c;
    resolvedUnitNumber = String(existingCount + 1);
  }

  const info = db
    .prepare(
      `INSERT INTO units (property_id, unit_number, bedrooms, bathrooms, rent_amount, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(property_id, resolvedUnitNumber, bedrooms ?? null, bathrooms ?? null, rent_amount ?? null, status || 'vacant');
  res.status(201).json(db.prepare('SELECT * FROM units WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = ownsUnit(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Unit not found' });
  const { unit_number, bedrooms, bathrooms, rent_amount, status } = req.body;
  db.prepare(
    `UPDATE units SET unit_number = ?, bedrooms = ?, bathrooms = ?, rent_amount = ?, status = ? WHERE id = ?`
  ).run(
    unit_number ?? existing.unit_number,
    bedrooms ?? existing.bedrooms,
    bathrooms ?? existing.bathrooms,
    rent_amount ?? existing.rent_amount,
    status ?? existing.status,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = ownsUnit(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Unit not found' });
  db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
