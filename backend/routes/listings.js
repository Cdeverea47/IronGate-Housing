const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

function ownsUnit(unitId, userId) {
  return db
    .prepare(`SELECT u.* FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = ? AND p.owner_id = ?`)
    .get(unitId, userId);
}

function ownsListing(listingId, userId) {
  return db
    .prepare(
      `SELECT lst.* FROM listings lst
       JOIN units u ON u.id = lst.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE lst.id = ? AND p.owner_id = ?`
    )
    .get(listingId, userId);
}

// Validates that every id in the array belongs to a document owned by this user.
function validDocumentIds(ids, userId) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id FROM documents WHERE owner_id = ? AND id IN (${placeholders})`)
    .all(userId, ...ids);
  const validIds = new Set(rows.map((r) => r.id));
  return ids.filter((id) => validIds.has(Number(id)));
}

function serialize(row) {
  return {
    ...row,
    photo_document_ids: row.photo_document_ids
      ? row.photo_document_ids.split(',').map(Number).filter(Boolean)
      : [],
  };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT lst.*, u.unit_number, u.bedrooms, u.bathrooms, p.name AS property_name,
        p.address_line1, p.city, p.state, p.zip
       FROM listings lst
       JOIN units u ON u.id = lst.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ?
       ORDER BY lst.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows.map(serialize));
});

router.post('/', (req, res) => {
  const {
    unit_id,
    title,
    description,
    rent_amount,
    available_date,
    pet_policy,
    amenities,
    contact_name,
    contact_email,
    contact_phone,
    status,
    photo_document_ids,
  } = req.body;

  if (!unit_id || !title) return res.status(400).json({ error: 'unit_id and title are required' });
  if (!ownsUnit(unit_id, req.user.id)) return res.status(404).json({ error: 'Unit not found' });

  const validPhotoIds = validDocumentIds(photo_document_ids, req.user.id);

  const info = db
    .prepare(
      `INSERT INTO listings
        (unit_id, title, description, rent_amount, available_date, pet_policy, amenities,
         contact_name, contact_email, contact_phone, status, photo_document_ids)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      unit_id,
      title,
      description || null,
      rent_amount || null,
      available_date || null,
      pet_policy || null,
      amenities || null,
      contact_name || null,
      contact_email || null,
      contact_phone || null,
      status || 'draft',
      validPhotoIds.join(',') || null
    );

  res.status(201).json(serialize(db.prepare('SELECT * FROM listings WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const existing = ownsListing(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });

  const {
    title,
    description,
    rent_amount,
    available_date,
    pet_policy,
    amenities,
    contact_name,
    contact_email,
    contact_phone,
    status,
    photo_document_ids,
  } = req.body;

  const photoIds =
    photo_document_ids !== undefined ? validDocumentIds(photo_document_ids, req.user.id).join(',') || null : existing.photo_document_ids;

  db.prepare(
    `UPDATE listings SET
       title = ?, description = ?, rent_amount = ?, available_date = ?, pet_policy = ?, amenities = ?,
       contact_name = ?, contact_email = ?, contact_phone = ?, status = ?, photo_document_ids = ?
     WHERE id = ?`
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    rent_amount ?? existing.rent_amount,
    available_date ?? existing.available_date,
    pet_policy ?? existing.pet_policy,
    amenities ?? existing.amenities,
    contact_name ?? existing.contact_name,
    contact_email ?? existing.contact_email,
    contact_phone ?? existing.contact_phone,
    status ?? existing.status,
    photoIds,
    req.params.id
  );

  res.json(serialize(db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  const existing = ownsListing(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });
  db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
