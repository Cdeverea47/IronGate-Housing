const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

router.get('/summary', (req, res) => {
  const ownerId = req.user.id;

  const propertyCount = db.prepare('SELECT COUNT(*) c FROM properties WHERE owner_id = ?').get(ownerId).c;
  const unitStats = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
        SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) AS vacant
       FROM units u JOIN properties p ON p.id = u.property_id WHERE p.owner_id = ?`
    )
    .get(ownerId);
  const tenantCount = db.prepare('SELECT COUNT(*) c FROM tenants WHERE owner_id = ?').get(ownerId).c;
  const activeLeases = db
    .prepare(
      `SELECT COUNT(*) c FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND l.status = 'active'`
    )
    .get(ownerId).c;
  const overduePayments = db
    .prepare(
      `SELECT COUNT(*) c, COALESCE(SUM(pay.amount), 0) total FROM payments pay
       JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND pay.status = 'pending' AND pay.due_date < date('now')`
    )
    .get(ownerId);
  const openMaintenance = db
    .prepare(
      `SELECT COUNT(*) c FROM maintenance_requests m JOIN units u ON u.id = m.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND m.status != 'resolved'`
    )
    .get(ownerId).c;
  const monthToDateCollected = db
    .prepare(
      `SELECT COALESCE(SUM(pay.amount), 0) total FROM payments pay
       JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND pay.status = 'paid' AND strftime('%Y-%m', pay.paid_date) = strftime('%Y-%m', 'now')`
    )
    .get(ownerId).total;
  const monthRent = db
    .prepare(
      `SELECT
        COALESCE(SUM(pay.amount), 0) AS due,
        COALESCE(SUM(CASE WHEN pay.status = 'paid' THEN pay.amount ELSE 0 END), 0) AS collected
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND strftime('%Y-%m', pay.due_date) = strftime('%Y-%m', 'now')`
    )
    .get(ownerId);
  // The rental insurance box on the dashboard can show more than one policy
  // (one per property) — soonest-expiring (or no end date yet) first, since
  // that's the most actionable one to look at first.
  const rentalInsurancePolicies = db
    .prepare(
      `SELECT ip.provider, ip.coverage_start, ip.coverage_end, p.name AS property_name, p.property_type
       FROM insurance_policies ip
       JOIN properties p ON p.id = ip.property_id
       WHERE p.owner_id = ? AND ip.policy_type = 'rental'
       ORDER BY (ip.coverage_end IS NULL) ASC, ip.coverage_end ASC`
    )
    .all(ownerId);

  res.json({
    propertyCount,
    unitTotal: unitStats.total || 0,
    unitOccupied: unitStats.occupied || 0,
    unitVacant: unitStats.vacant || 0,
    tenantCount,
    activeLeases,
    overdueCount: overduePayments.c,
    overdueTotal: overduePayments.total,
    openMaintenance,
    monthToDateCollected,
    monthRentDue: monthRent.due,
    monthRentCollected: monthRent.collected,
    monthRentRemaining: Math.max(0, monthRent.due - monthRent.collected),
    rentalInsurancePolicies,
  });
});

module.exports = router;
