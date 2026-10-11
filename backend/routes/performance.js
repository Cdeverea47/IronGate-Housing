const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

const MONTHS_BACK = 6;

// Returns the last `count` months (oldest first) as { key: 'YYYY-MM', label: 'Jan 2026', start, end } (YYYY-MM-DD).
function lastMonths(count) {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // last day of month
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${year}-${pad(month + 1)}`;
    const label = start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    months.push({
      key,
      label,
      start: `${year}-${pad(month + 1)}-01`,
      end: `${year}-${pad(month + 1)}-${pad(end.getDate())}`,
    });
  }
  return months;
}

router.get('/', (req, res) => {
  const ownerId = req.user.id;
  const months = lastMonths(MONTHS_BACK);
  const windowStart = months[0].start;
  const windowEnd = months[months.length - 1].end;

  const dueStmt = db.prepare(
    `SELECT COALESCE(SUM(pay.amount), 0) total FROM payments pay
     JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
     WHERE p.owner_id = ? AND pay.due_date BETWEEN ? AND ?`
  );
  const collectedStmt = db.prepare(
    `SELECT COALESCE(SUM(pay.amount), 0) total FROM payments pay
     JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
     WHERE p.owner_id = ? AND pay.status = 'paid' AND pay.paid_date BETWEEN ? AND ?`
  );

  const totalUnits = db
    .prepare(`SELECT COUNT(*) c FROM units u JOIN properties p ON p.id = u.property_id WHERE p.owner_id = ?`)
    .get(ownerId).c;

  const occupiedDuringStmt = db.prepare(
    `SELECT COUNT(DISTINCT u.id) c
     FROM units u
     JOIN properties p ON p.id = u.property_id
     JOIN leases l ON l.unit_id = u.id
     WHERE p.owner_id = ?
       AND l.start_date <= ?
       AND (l.end_date IS NULL OR l.end_date >= ?)`
  );

  const monthly = months.map((m) => {
    const due = dueStmt.get(ownerId, m.start, m.end).total;
    const collected = collectedStmt.get(ownerId, m.start, m.end).total;
    const occupied = occupiedDuringStmt.get(ownerId, m.end, m.start).c;
    return {
      month: m.key,
      label: m.label,
      due,
      collected,
      occupiedUnits: occupied,
      totalUnits,
      occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
    };
  });

  const windowDue = db
    .prepare(
      `SELECT COALESCE(SUM(pay.amount), 0) total FROM payments pay
       JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND pay.due_date BETWEEN ? AND ?`
    )
    .get(ownerId, windowStart, windowEnd).total;
  const windowCollected = db
    .prepare(
      `SELECT COALESCE(SUM(pay.amount), 0) total FROM payments pay
       JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND pay.status = 'paid' AND pay.paid_date BETWEEN ? AND ?`
    )
    .get(ownerId, windowStart, windowEnd).total;

  const properties = db
    .prepare(
      `SELECT p.id, p.name,
        (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) AS unit_count,
        (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id AND u.status = 'occupied') AS occupied_count,
        (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay
           JOIN leases l ON l.id = pay.lease_id JOIN units u ON u.id = l.unit_id
           WHERE u.property_id = p.id AND pay.status = 'paid') AS total_collected,
        (SELECT COUNT(*) FROM maintenance_requests m
           JOIN units u ON u.id = m.unit_id
           WHERE u.property_id = p.id AND m.status != 'resolved') AS open_maintenance
       FROM properties p
       WHERE p.owner_id = ?
       ORDER BY total_collected DESC`
    )
    .all(ownerId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      unitCount: p.unit_count,
      occupiedCount: p.occupied_count,
      occupancyRate: p.unit_count > 0 ? Math.round((p.occupied_count / p.unit_count) * 100) : 0,
      totalCollected: p.total_collected,
      openMaintenance: p.open_maintenance,
    }));

  res.json({
    monthly,
    collectionRate: windowDue > 0 ? Math.round((windowCollected / windowDue) * 100) : null,
    windowDue,
    windowCollected,
    properties,
  });
});

module.exports = router;
