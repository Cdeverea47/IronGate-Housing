const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

function ownsProperty(propertyId, userId) {
  return db.prepare('SELECT id FROM properties WHERE id = ? AND owner_id = ?').get(propertyId, userId);
}

function ownsPolicy(policyId, userId) {
  return db
    .prepare(
      `SELECT ip.* FROM insurance_policies ip
       JOIN properties p ON p.id = ip.property_id
       WHERE ip.id = ? AND p.owner_id = ?`
    )
    .get(policyId, userId);
}

function ownsDocument(documentId, userId) {
  return db.prepare('SELECT id FROM documents WHERE id = ? AND owner_id = ?').get(documentId, userId);
}

router.get('/', (req, res) => {
  const { property_id } = req.query;
  let sql = `SELECT ip.*, p.name AS property_name, d.original_name AS document_name
             FROM insurance_policies ip
             JOIN properties p ON p.id = ip.property_id
             LEFT JOIN documents d ON d.id = ip.document_id
             WHERE p.owner_id = ?`;
  const params = [req.user.id];
  if (property_id) {
    sql += ' AND ip.property_id = ?';
    params.push(property_id);
  }
  sql += ' ORDER BY ip.coverage_end IS NULL, ip.coverage_end ASC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const {
    property_id,
    policy_type,
    provider,
    policy_number,
    premium_amount,
    premium_frequency,
    coverage_start,
    coverage_end,
    notes,
    document_id,
  } = req.body;

  if (!property_id || !provider) return res.status(400).json({ error: 'property_id and provider are required' });
  if (!ownsProperty(property_id, req.user.id)) return res.status(404).json({ error: 'Property not found' });
  if (document_id && !ownsDocument(document_id, req.user.id)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const info = db
    .prepare(
      `INSERT INTO insurance_policies
        (property_id, policy_type, provider, policy_number, premium_amount, premium_frequency, coverage_start, coverage_end, notes, document_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      property_id,
      policy_type || 'rental',
      provider,
      policy_number || null,
      premium_amount || null,
      premium_frequency || 'annual',
      coverage_start || null,
      coverage_end || null,
      notes || null,
      document_id || null
    );

  res.status(201).json(db.prepare('SELECT * FROM insurance_policies WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = ownsPolicy(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Insurance policy not found' });

  const {
    policy_type,
    provider,
    policy_number,
    premium_amount,
    premium_frequency,
    coverage_start,
    coverage_end,
    notes,
    document_id,
  } = req.body;

  if (document_id !== undefined && document_id !== null && !ownsDocument(document_id, req.user.id)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  db.prepare(
    `UPDATE insurance_policies SET
       policy_type = ?, provider = ?, policy_number = ?, premium_amount = ?, premium_frequency = ?,
       coverage_start = ?, coverage_end = ?, notes = ?, document_id = ?
     WHERE id = ?`
  ).run(
    policy_type ?? existing.policy_type,
    provider ?? existing.provider,
    policy_number ?? existing.policy_number,
    premium_amount ?? existing.premium_amount,
    premium_frequency ?? existing.premium_frequency,
    coverage_start ?? existing.coverage_start,
    coverage_end ?? existing.coverage_end,
    notes ?? existing.notes,
    document_id !== undefined ? document_id : existing.document_id,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM insurance_policies WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = ownsPolicy(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Insurance policy not found' });
  db.prepare('DELETE FROM insurance_policies WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
