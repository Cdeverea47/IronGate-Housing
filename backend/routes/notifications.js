const express = require('express');
const db = require('../db');
const { unitLabel } = require('../lib/labels');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

router.get('/', (req, res) => {
  const ownerId = req.user.id;
  const items = [];

  const overduePayments = db
    .prepare(
      `SELECT pay.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE p.owner_id = ? AND pay.status = 'pending' AND pay.due_date < date('now')
       ORDER BY pay.due_date ASC LIMIT 10`
    )
    .all(ownerId);
  overduePayments.forEach((p) => {
    items.push({
      id: `overdue-${p.id}`,
      tone: 'red',
      message: `Rent overdue — ${p.first_name} ${p.last_name}, ${p.property_name} Unit ${p.unit_number}`,
      link: '/payments',
      timestamp: p.due_date,
    });
  });

  const recentlyPaid = db
    .prepare(
      `SELECT pay.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE p.owner_id = ? AND pay.status = 'paid' AND pay.paid_date >= date('now', '-3 days')
       ORDER BY pay.paid_date DESC LIMIT 10`
    )
    .all(ownerId);
  recentlyPaid.forEach((p) => {
    items.push({
      id: `paid-${p.id}`,
      tone: 'green',
      message: `Payment received — ${p.first_name} ${p.last_name}, $${p.amount} (${p.property_name} Unit ${p.unit_number})`,
      link: '/payments',
      timestamp: p.paid_date,
    });
  });

  const highPriorityMaintenance = db
    .prepare(
      `SELECT m.*, u.unit_number, u.is_default AS unit_is_default, p.name AS property_name
       FROM maintenance_requests m
       JOIN units u ON u.id = m.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND m.status != 'resolved' AND m.priority = 'high'
       ORDER BY m.created_at DESC LIMIT 10`
    )
    .all(ownerId);
  highPriorityMaintenance.forEach((m) => {
    items.push({
      id: `maint-${m.id}`,
      tone: 'red',
      message: `High-priority maintenance — ${m.title} — ${unitLabel(m.unit_number, m.property_name, m.unit_is_default)}`,
      link: '/maintenance',
      timestamp: m.created_at,
    });
  });

  const recentMaintenance = db
    .prepare(
      `SELECT m.*, u.unit_number, u.is_default AS unit_is_default, p.name AS property_name
       FROM maintenance_requests m
       JOIN units u ON u.id = m.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND m.priority != 'high' AND m.created_at >= datetime('now', '-3 days')
       ORDER BY m.created_at DESC LIMIT 10`
    )
    .all(ownerId);
  recentMaintenance.forEach((m) => {
    items.push({
      id: `maint-new-${m.id}`,
      tone: 'amber',
      message: `New maintenance request — ${m.title} — ${unitLabel(m.unit_number, m.property_name, m.unit_is_default)}`,
      link: '/maintenance',
      timestamp: m.created_at,
    });
  });

  // Every other still-open maintenance request (older than the 3-day "new" window).
  const olderOpenMaintenance = db
    .prepare(
      `SELECT m.*, u.unit_number, u.is_default AS unit_is_default, p.name AS property_name
       FROM maintenance_requests m
       JOIN units u ON u.id = m.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE p.owner_id = ? AND m.status != 'resolved' AND m.priority != 'high' AND m.created_at < datetime('now', '-3 days')
       ORDER BY m.created_at DESC LIMIT 10`
    )
    .all(ownerId);
  olderOpenMaintenance.forEach((m) => {
    items.push({
      id: `maint-open-${m.id}`,
      tone: 'amber',
      message: `Open maintenance request — ${m.title} — ${unitLabel(m.unit_number, m.property_name, m.unit_is_default)}`,
      link: '/maintenance',
      timestamp: m.created_at,
    });
  });

  // Tenant payment-plan requests waiting for a decision.
  const planRequests = db
    .prepare(
      `SELECT r.*, t.first_name, t.last_name
       FROM payment_plan_requests r JOIN tenants t ON t.id = r.tenant_id
       WHERE t.owner_id = ? AND r.status = 'pending' AND r.initiated_by = 'tenant'
       ORDER BY r.created_at DESC LIMIT 10`
    )
    .all(ownerId);
  planRequests.forEach((r) => {
    items.push({
      id: `plan-${r.id}`,
      tone: 'amber',
      message: `Payment plan request — ${r.first_name} ${r.last_name} is waiting for your decision`,
      link: '/payment-plans',
      timestamp: r.created_at,
    });
  });

  const expiringInsurance = db
    .prepare(
      `SELECT ip.*, p.name AS property_name
       FROM insurance_policies ip
       JOIN properties p ON p.id = ip.property_id
       WHERE p.owner_id = ? AND ip.coverage_end IS NOT NULL AND ip.coverage_end <= date('now', '+30 days')
       ORDER BY ip.coverage_end ASC LIMIT 10`
    )
    .all(ownerId);
  expiringInsurance.forEach((ip) => {
    const expired = ip.coverage_end < new Date().toISOString().slice(0, 10);
    items.push({
      id: `ins-${ip.id}`,
      tone: 'amber',
      message: `${ip.property_name} — ${ip.policy_type === 'homeowner' ? "homeowner's" : 'rental'} insurance ${
        expired ? 'expired' : 'renews soon'
      } (${ip.coverage_end})`,
      link: '/insurance',
      timestamp: ip.coverage_end,
    });
  });

  const endingLeases = db
    .prepare(
      `SELECT l.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE p.owner_id = ? AND l.status = 'active' AND l.end_date IS NOT NULL AND l.end_date <= date('now', '+30 days')
       ORDER BY l.end_date ASC LIMIT 10`
    )
    .all(ownerId);
  endingLeases.forEach((l) => {
    const expired = l.end_date < new Date().toISOString().slice(0, 10);
    items.push({
      id: `lease-${l.id}`,
      tone: 'red',
      message: `${expired ? 'Lease ended' : 'Lease ending soon'} — ${l.first_name} ${l.last_name}, ${l.property_name} Unit ${l.unit_number} (${l.end_date}). Renew or confirm move-out.`,
      link: '/leases',
      timestamp: l.end_date,
    });
  });

  const acked = new Set(
    db.prepare('SELECT notification_id FROM notification_acks WHERE user_id = ?').all(ownerId).map((r) => r.notification_id)
  );
  const unacknowledged = items.filter((item) => !acked.has(item.id));

  unacknowledged.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  res.json(unacknowledged.slice(0, 30));
});

// Marks one notification as seen so it won't show up again — until the
// underlying data changes and produces a fresh notification id.
router.post('/:id/ack', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO notification_acks (user_id, notification_id) VALUES (?, ?)').run(
    req.user.id,
    req.params.id
  );
  res.status(204).end();
});

module.exports = router;
