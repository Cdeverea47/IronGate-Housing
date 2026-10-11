const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { linkRecordToExistingUser } = require('../lib/tenantLink');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tenants WHERE owner_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  const leases = db
    .prepare(
      `SELECT l.*, u.unit_number, p.name AS property_name FROM leases l
       JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE l.tenant_id = ? ORDER BY l.start_date DESC`
    )
    .all(tenant.id);
  res.json({ ...tenant, leases });
});

router.post('/', (req, res) => {
  const { first_name, last_name, email, phone, notes } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'first_name and last_name are required' });
  const info = db
    .prepare('INSERT INTO tenants (owner_id, first_name, last_name, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, first_name, last_name, email || null, phone || null, notes || null);
  if (email) linkRecordToExistingUser(info.lastInsertRowid, email);
  res.status(201).json(db.prepare('SELECT * FROM tenants WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tenants WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Tenant not found' });
  const { first_name, last_name, email, phone, notes } = req.body;
  db.prepare('UPDATE tenants SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?').run(
    first_name ?? existing.first_name,
    last_name ?? existing.last_name,
    email ?? existing.email,
    phone ?? existing.phone,
    notes ?? existing.notes,
    req.params.id
  );
  const newEmail = email ?? existing.email;
  if (newEmail && !existing.user_id) linkRecordToExistingUser(req.params.id, newEmail);
  res.json(db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tenants WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Tenant not found' });
  db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
