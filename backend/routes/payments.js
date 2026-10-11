const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getStripe, friendlyStripeError } = require('../stripeClient');
const { sendEmail } = require('../emailClient');

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
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(payment.amount) * 100),
            product_data: {
              name: `Rent — ${payment.property_name}, Unit ${payment.unit_number}`,
              description: `${payment.first_name} ${payment.last_name} · due ${payment.due_date}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { payment_id: String(payment.id) },
      success_url: `${APP_URL}/pay/success?payment_id=${payment.id}`,
      cancel_url: `${APP_URL}/pay/cancel?payment_id=${payment.id}`,
    });

    db.prepare('UPDATE payments SET stripe_session_id = ? WHERE id = ?').run(session.id, payment.id);
    res.status(201).json({ url: session.url });
  } catch (err) {
    const friendly = friendlyStripeError(err);
    if (friendly.statusCode) return res.status(friendly.statusCode).json({ error: friendly.message });
    next(friendly);
  }
});

module.exports = router;
