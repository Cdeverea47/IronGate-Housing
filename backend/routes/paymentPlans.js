const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendNotificationEmail } = require('../emailClient');
const { regenerateForTenant } = require('../lib/rentCharges');

const PLAN_LABELS = {
  full: 'pay in full',
  split2: 'split into 2 payments',
  split4: 'split into 4 payments',
};

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

// Landlord sets a plan directly — no tenant request needed. Takes effect
// immediately; recorded in the same history as requests (initiated_by =
// 'landlord'). Setting "full" clears a split plan.
router.post('/assign', (req, res) => {
  const { tenant_id, installment_plan, duration, temporary_end_date, note } = req.body;
  if (!tenant_id || !PLAN_LABELS[installment_plan]) {
    return res.status(400).json({ error: 'tenant_id and a valid installment_plan are required' });
  }
  const tenant = db
    .prepare('SELECT id, first_name, last_name, user_id FROM tenants WHERE id = ? AND owner_id = ?')
    .get(tenant_id, req.user.id);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const resolvedDuration = duration === 'permanent' ? 'permanent' : 'temporary';
  const until = resolvedDuration === 'temporary' ? temporary_end_date || null : null;
  if (resolvedDuration === 'temporary' && !until) {
    return res.status(400).json({ error: 'Choose an end date for a temporary plan' });
  }

  const info = db
    .prepare(
      `INSERT INTO payment_plan_requests
         (tenant_id, requested_by_user_id, installment_plan, duration, temporary_end_date, note, status, decided_at, initiated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), 'landlord')`
    )
    .run(tenant.id, req.user.id, installment_plan, resolvedDuration, until, note || null);

  db.prepare('UPDATE tenants SET active_installment_plan = ?, active_installment_plan_until = ? WHERE id = ?').run(
    installment_plan,
    until,
    tenant.id
  );
  regenerateForTenant(tenant.id);

  if (tenant.user_id) {
    const tenantUser = db.prepare('SELECT id, email FROM users WHERE id = ?').get(tenant.user_id);
    if (tenantUser) {
      sendNotificationEmail({
        userId: tenantUser.id,
        to: tenantUser.email,
        subject: 'Your landlord set up a payment plan',
        html: `<p>Hi ${tenant.first_name},</p>
          <p>Your landlord set your rent payment plan to <strong>${PLAN_LABELS[installment_plan]}</strong>
          (${resolvedDuration}${until ? ` until ${until}` : ''}).</p>
          ${note ? `<p>Note: "${note}"</p>` : ''}`,
      }).catch(() => {});
    }
  }

  res.status(201).json(db.prepare('SELECT * FROM payment_plan_requests WHERE id = ?').get(info.lastInsertRowid));
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
    regenerateForTenant(request.tenant_id);
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
