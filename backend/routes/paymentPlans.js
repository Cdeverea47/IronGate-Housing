const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendNotificationEmail } = require('../emailClient');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, t.first_name, t.last_name, t.email AS tenant_email
       FROM payment_plan_requests r
       JOIN tenants t ON t.id = r.tenant_id
       WHERE t.owner_id = ?
       ORDER BY (r.status = 'pending') DESC, r.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.put('/:id', (req, res) => {
  const { status } = req.body;
  if (status !== 'approved' && status !== 'denied') {
    return res.status(400).json({ error: 'status must be "approved" or "denied"' });
  }

  const request = db
    .prepare(
      `SELECT r.*, t.owner_id, t.first_name, t.last_name
       FROM payment_plan_requests r JOIN tenants t ON t.id = r.tenant_id
       WHERE r.id = ? AND t.owner_id = ?`
    )
    .get(req.params.id, req.user.id);
  if (!request) return res.status(404).json({ error: 'Payment plan request not found' });

  db.prepare("UPDATE payment_plan_requests SET status = ?, decided_at = datetime('now') WHERE id = ?").run(
    status,
    req.params.id
  );

  if (status === 'approved') {
    db.prepare('UPDATE tenants SET active_installment_plan = ?, active_installment_plan_until = ? WHERE id = ?').run(
      request.installment_plan,
      request.duration === 'temporary' ? request.temporary_end_date : null,
      request.tenant_id
    );
  }

  const requester = db.prepare('SELECT id, email FROM users WHERE id = ?').get(request.requested_by_user_id);
  if (requester) {
    const planLabel =
      request.installment_plan === 'full'
        ? 'pay in full'
        : request.installment_plan === 'split2'
        ? 'split into 2 payments'
        : 'split into 4 payments';
    sendNotificationEmail({
      userId: requester.id,
      to: requester.email,
      subject: `Your payment plan request was ${status}`,
      html: `<p>Hi ${request.first_name},</p>
        <p>Your landlord has <strong>${status}</strong> your request to ${planLabel} (${request.duration}).</p>`,
    }).catch(() => {});
  }

  const row = db.prepare('SELECT * FROM payment_plan_requests WHERE id = ?').get(req.params.id);
  res.json(row);
});

module.exports = router;
