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
function ownsTenant(tenantId, userId) {
  return db.prepare('SELECT id FROM tenants WHERE id = ? AND owner_id = ?').get(tenantId, userId);
}
function ownsLease(leaseId, userId) {
  return db
    .prepare(
      `SELECT l.* FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE l.id = ? AND p.owner_id = ?`
    )
    .get(leaseId, userId);
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE p.owner_id = ? ORDER BY l.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const lease = ownsLease(req.params.id, req.user.id);
  if (!lease) return res.status(404).json({ error: 'Lease not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE lease_id = ? ORDER BY due_date DESC').all(lease.id);
  res.json({ ...lease, payments });
});

router.post('/', (req, res) => {
  const { unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status } = req.body;
  if (!unit_id || !tenant_id || !start_date || !rent_amount) {
    return res.status(400).json({ error: 'unit_id, tenant_id, start_date and rent_amount are required' });
  }
  if (!ownsUnit(unit_id, req.user.id)) return res.status(404).json({ error: 'Unit not found' });
  if (!ownsTenant(tenant_id, req.user.id)) return res.status(404).json({ error: 'Tenant not found' });

  const info = db
    .prepare(
      `INSERT INTO leases (unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(unit_id, tenant_id, start_date, end_date || null, rent_amount, deposit_amount || 0, status || 'active');

  db.prepare('UPDATE units SET status = ? WHERE id = ?').run('occupied', unit_id);
  res.status(201).json(db.prepare('SELECT * FROM leases WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = ownsLease(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Lease not found' });
  const { start_date, end_date, rent_amount, deposit_amount, status } = req.body;
  const resolvedEndDate = end_date ?? existing.end_date;
  // A changed end_date means the lease was renewed (or the term changed) —
  // clear the "already reminded" flag so the automatic renewal check can
  // send a fresh reminder as the new end date approaches.
  const endDateChanged = resolvedEndDate !== existing.end_date;

  db.prepare(
    `UPDATE leases SET start_date = ?, end_date = ?, rent_amount = ?, deposit_amount = ?, status = ?,
     renewal_reminder_sent_at = ? WHERE id = ?`
  ).run(
    start_date ?? existing.start_date,
    resolvedEndDate,
    rent_amount ?? existing.rent_amount,
    deposit_amount ?? existing.deposit_amount,
    status ?? existing.status,
    endDateChanged ? null : existing.renewal_reminder_sent_at,
    req.params.id
  );
  if (status === 'ended' || status === 'terminated') {
    db.prepare('UPDATE units SET status = ? WHERE id = ?').run('vacant', existing.unit_id);
  }
  res.json(db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = ownsLease(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Lease not found' });
  db.prepare('DELETE FROM leases WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
