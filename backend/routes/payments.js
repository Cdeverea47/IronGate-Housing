const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { friendlyStripeError } = require('../stripeClient');
const { ownerForPayment, createRentCheckout } = require('../lib/connect');
const { sendEmail, sendNotificationEmail } = require('../emailClient');

const router = express.Router();
router.use(requireAuth);

const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

function ownsLease(leaseId, userId) {
  return db
    .prepare(
      `SELECT l.* FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
       WHERE l.id = ? AND p.owner_id = ?`
    )
    .get(leaseId, userId);
}
function ownsPayment(paymentId, userId) {
  return db
    .prepare(
      `SELECT pay.* FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE pay.id = ? AND p.owner_id = ?`
    )
    .get(paymentId, userId);
}

function paymentWithContext(paymentId, userId) {
  return db
    .prepare(
      `SELECT pay.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE pay.id = ? AND p.owner_id = ?`
    )
    .get(paymentId, userId);
}

router.get('/', (req, res) => {
  const { lease_id, status } = req.query;
  let sql = `SELECT pay.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
             FROM payments pay
             JOIN leases l ON l.id = pay.lease_id
             JOIN units u ON u.id = l.unit_id
             JOIN properties p ON p.id = u.property_id
             JOIN tenants t ON t.id = l.tenant_id
             WHERE p.owner_id = ?`;
  const params = [req.user.id];
  if (lease_id) {
    sql += ' AND pay.lease_id = ?';
    params.push(lease_id);
  }
  if (status) {
    sql += ' AND pay.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY pay.due_date DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { lease_id, amount, due_date, paid_date, method, status, notes } = req.body;
  if (!lease_id || !amount || !due_date) return res.status(400).json({ error: 'lease_id, amount and due_date are required' });
  if (!ownsLease(lease_id, req.user.id)) return res.status(404).json({ error: 'Lease not found' });
  const info = db
    .prepare(
      `INSERT INTO payments (lease_id, amount, due_date, paid_date, method, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(lease_id, amount, due_date, paid_date || null, method || null, status || (paid_date ? 'paid' : 'pending'), notes || null);
  res.status(201).json(db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid));
});

// Schedule one or more FUTURE payments at once (rent, a fee, a utility bill...).
// They show up for the tenant right away under "Upcoming" and can be paid at
// any time — before or on the due date — from their Payments page.
function addMonthsClamped(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
function addDaysStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

router.post('/schedule', (req, res) => {
  const { lease_id, label, amount, first_due_date, repeat, count } = req.body;
  if (!lease_id || !first_due_date) return res.status(400).json({ error: 'lease_id and first_due_date are required' });
  const amt = Number(amount);
  if (!(amt > 0)) return res.status(400).json({ error: 'amount must be greater than 0' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first_due_date) || Number.isNaN(Date.parse(first_due_date))) {
    return res.status(400).json({ error: 'first_due_date must be a valid date' });
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  if (first_due_date < todayStr) return res.status(400).json({ error: 'Choose a due date that is today or later' });
  const lease = ownsLease(lease_id, req.user.id);
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const mode = ['once', 'weekly', 'monthly'].includes(repeat) ? repeat : 'once';
  const total = mode === 'once' ? 1 : Math.min(24, Math.max(1, parseInt(count, 10) || 1));
  const note = label ? String(label).trim().slice(0, 80) : null;

  const insert = db.prepare('INSERT INTO payments (lease_id, amount, due_date, status, notes) VALUES (?, ?, ?, ?, ?)');
  const created = [];
  for (let i = 0; i < total; i += 1) {
    const due = mode === 'monthly' ? addMonthsClamped(first_due_date, i) : addDaysStr(first_due_date, mode === 'weekly' ? i * 7 : 0);
    const info = insert.run(lease.id, amt, due, 'pending', note);
    created.push(db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid));
  }

  // Let the tenant know (respects their notification preference).
  const tenant = db
    .prepare('SELECT t.first_name, t.user_id, u.email FROM tenants t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = ?')
    .get(lease.tenant_id);
  if (tenant && tenant.user_id && tenant.email) {
    sendNotificationEmail({
      userId: tenant.user_id,
      to: tenant.email,
      subject: `New upcoming payment${created.length > 1 ? 's' : ''} scheduled`,
      html: `<p>Hi ${tenant.first_name},</p>
        <p>Your landlord scheduled ${created.length} upcoming payment${created.length > 1 ? 's' : ''} of
        <strong>$${amt.toFixed(2)}</strong>${note ? ` (${note})` : ''}, starting ${created[0].due_date}.</p>
        <p>You can pay any of them at any time from the Payments page in IronGate Housing.</p>`,
    }).catch(() => {});
  }

  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const existing = ownsPayment(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  const { amount, due_date, paid_date, method, status, notes } = req.body;
  const becamePaid = existing.status !== 'paid' && (status ?? existing.status) === 'paid';
  db.prepare(
    `UPDATE payments SET amount = ?, due_date = ?, paid_date = ?, method = ?, status = ?, notes = ? WHERE id = ?`
  ).run(
    amount ?? existing.amount,
    due_date ?? existing.due_date,
    paid_date ?? existing.paid_date,
    method ?? existing.method,
    status ?? existing.status,
    notes ?? existing.notes,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  res.json(updated);

  if (becamePaid) {
    const details = paymentWithContext(req.params.id, req.user.id);
    const owner = db.prepare('SELECT email, name FROM users WHERE id = ?').get(req.user.id);
    if (details && owner) {
      const methodLabel = { cash: 'cash', check: 'check', zelle: 'Zelle', bank_transfer: 'bank transfer', card: 'card', other: 'other' }[
        details.method
      ] || details.method || 'an unspecified method';
      sendEmail({
        to: owner.email,
        subject: `Payment received — $${details.amount} (${details.property_name} Unit ${details.unit_number})`,
        html: `<p>Hi ${owner.name || ''},</p>
          <p>${details.first_name} ${details.last_name}'s payment of <strong>$${details.amount}</strong> for
          <strong>${details.property_name} Unit ${details.unit_number}</strong> was marked paid via ${methodLabel}.</p>`,
      }).catch(() => {});
    }
  }
});

router.delete('/:id', (req, res) => {
  const existing = ownsPayment(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Creates a Stripe-hosted Checkout page for this payment and returns its URL.
// Card details never touch our server — Stripe collects and processes them directly.
router.post('/:id/checkout', async (req, res, next) => {
  const payment = paymentWithContext(req.params.id, req.user.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status === 'paid') return res.status(400).json({ error: 'This payment is already marked paid' });

  try {
    // Charged directly on this landlord's connected account (their own bank).
    const owner = ownerForPayment(payment.id);
    const session = await createRentCheckout({ payment, owner, tenantUser: null });
    res.status(201).json({ url: session.url });
  } catch (err) {
    const friendly = friendlyStripeError(err);
    if (friendly.statusCode) return res.status(friendly.statusCode).json({ error: friendly.message });
    next(friendly);
  }
});

module.exports = router;
