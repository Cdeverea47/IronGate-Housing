const express = require('express');
const db = require('../db');
const { regenerateForLease, scheduleLeaseTerm, cancelUpcomingCharges, monthsThroughEnd } = require('../lib/rentCharges');
const { requireAuth, requireRole } = require('../middleware/auth');
const { syncUnitStatus } = require('../lib/unitStatus');

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
  if ((status || 'active') === 'active') {
    const taken = db.prepare("SELECT 1 FROM leases WHERE unit_id = ? AND status = 'active'").get(unit_id);
    if (taken) return res.status(409).json({ error: 'This unit already has an active lease — end it first.' });
  }

  const info = db
    .prepare(
      `INSERT INTO leases (unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(unit_id, tenant_id, start_date, end_date || null, rent_amount, deposit_amount || 0, status || 'active');

  syncUnitStatus(unit_id);
  // An end date automatically schedules the whole term's rent charges.
  const chargesCreated = scheduleLeaseTerm(info.lastInsertRowid);
  res.status(201).json({ ...db.prepare('SELECT * FROM leases WHERE id = ?').get(info.lastInsertRowid), charges_created: chargesCreated });
});

// Rent setup: amount, due day of month, and whether the app creates each
// month's charge automatically. Also creates the upcoming charges right away.
router.put('/:id/rent', (req, res) => {
  const existing = ownsLease(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Lease not found' });
  const { rent_amount, due_day, autogenerate, generate_months } = req.body;
  const amount = Number(rent_amount);
  const day = Number(due_day);
  if (!(amount > 0)) return res.status(400).json({ error: 'rent_amount must be greater than 0' });
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return res.status(400).json({ error: 'due_day must be a whole number from 1 to 28' });
  }
  const months = Math.min(12, Math.max(0, parseInt(generate_months, 10) || 0));
  const auto = autogenerate ? 1 : 0;

  db.prepare('UPDATE leases SET rent_amount = ?, rent_due_day = ?, rent_autogenerate = ? WHERE id = ?').run(
    amount,
    day,
    auto,
    existing.id
  );
  db.prepare('UPDATE units SET rent_amount = ? WHERE id = ?').run(amount, existing.unit_id);

  // Rebuild upcoming unpaid auto-charges with the new terms, then create the
  // requested number of months (at least this + next month when auto is on).
  const toEnd = monthsThroughEnd(existing.end_date);
  const created = regenerateForLease(existing.id, auto ? Math.max(2, months, toEnd) : months);
  res.json({ lease: db.prepare('SELECT * FROM leases WHERE id = ?').get(existing.id), charges_created: created });
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
  let chargesCreated = 0;
  syncUnitStatus(existing.unit_id);
  if (status === 'ended' || status === 'terminated') {
    cancelUpcomingCharges(existing.id);
  } else if (resolvedEndDate && (endDateChanged || (rent_amount !== undefined && Number(rent_amount) !== existing.rent_amount))) {
    // New/changed end date (or rent) → rebuild the term's upcoming charges.
    chargesCreated = scheduleLeaseTerm(existing.id);
  } else if (endDateChanged && !resolvedEndDate) {
    chargesCreated = regenerateForLease(existing.id, 2);
  }
  res.json({ ...db.prepare('SELECT * FROM leases WHERE id = ?').get(req.params.id), charges_created: chargesCreated });
});

router.delete('/:id', (req, res) => {
  const existing = ownsLease(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Lease not found' });
  db.prepare('DELETE FROM leases WHERE id = ?').run(req.params.id);
  syncUnitStatus(existing.unit_id);
  res.status(204).end();
});

module.exports = router;
