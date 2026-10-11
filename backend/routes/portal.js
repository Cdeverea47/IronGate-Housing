// Tenant-facing portal: everything here is scoped to the tenant records linked
// to the logged-in user's account (tenants.user_id), never to a "owner_id"
// like the landlord-side routes. A tenant can be linked to more than one
// tenant record (e.g. leases at different properties/landlords over time).
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getStripe, friendlyStripeError } = require('../stripeClient');
const { sendEmail, sendNotificationEmail } = require('../emailClient');
const { getUploadsDir } = require('../lib/paths');

const router = express.Router();
router.use(requireAuth, requireRole('tenant'));

const uploadDir = getUploadsDir();
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

function linkedTenantIds(userId) {
  return db
    .prepare('SELECT id FROM tenants WHERE user_id = ?')
    .all(userId)
    .map((t) => t.id);
}

function linkedLeaseIds(tenantIds) {
  if (tenantIds.length === 0) return [];
  const placeholders = tenantIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT id FROM leases WHERE tenant_id IN (${placeholders})`)
    .all(...tenantIds)
    .map((l) => l.id);
}

router.get('/overview', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  if (tenantIds.length === 0) {
    return res.json({ linked: false, leases: [] });
  }
  const placeholders = tenantIds.map(() => '?').join(',');
  const leases = db
    .prepare(
      `SELECT l.*, u.unit_number, u.bedrooms, u.bathrooms, p.name AS property_name, p.address_line1, p.address_line2,
              p.city, p.state, p.zip, owner.name AS landlord_name, owner.email AS landlord_email, owner.zelle_contact,
              t.active_installment_plan, t.active_installment_plan_until
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN users owner ON owner.id = p.owner_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.tenant_id IN (${placeholders})
       ORDER BY (l.status = 'active') DESC, l.start_date DESC`
    )
    .all(...tenantIds);
  res.json({ linked: true, leases });
});

router.get('/payments', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  if (leaseIds.length === 0) return res.json([]);
  const placeholders = leaseIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT pay.*, u.unit_number, p.name AS property_name
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE pay.lease_id IN (${placeholders})
       ORDER BY pay.due_date DESC`
    )
    .all(...leaseIds);
  res.json(rows);
});

router.post('/payments/:id/checkout', async (req, res, next) => {
  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  if (leaseIds.length === 0) return res.status(404).json({ error: 'Payment not found' });
  const placeholders = leaseIds.map(() => '?').join(',');
  const payment = db
    .prepare(
      `SELECT pay.*, u.unit_number, p.name AS property_name, t.first_name, t.last_name
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE pay.id = ? AND pay.lease_id IN (${placeholders})`
    )
    .get(req.params.id, ...leaseIds);
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

router.get('/maintenance', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  if (tenantIds.length === 0) return res.json([]);
  const placeholders = tenantIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT m.*, u.unit_number, p.name AS property_name
       FROM maintenance_requests m
       JOIN units u ON u.id = m.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE m.tenant_id IN (${placeholders})
       ORDER BY m.created_at DESC`
    )
    .all(...tenantIds);
  res.json(rows);
});

router.post('/maintenance', (req, res) => {
  const { unit_id, title, description, priority } = req.body;
  if (!unit_id || !title) return res.status(400).json({ error: 'unit_id and title are required' });

  const tenantIds = linkedTenantIds(req.user.id);
  if (tenantIds.length === 0) return res.status(403).json({ error: 'No lease on file for your account' });
  const placeholders = tenantIds.map(() => '?').join(',');
  const lease = db
    .prepare(`SELECT * FROM leases WHERE unit_id = ? AND tenant_id IN (${placeholders})`)
    .get(unit_id, ...tenantIds);
  if (!lease) return res.status(403).json({ error: "That unit isn't linked to your lease" });

  const info = db
    .prepare(
      `INSERT INTO maintenance_requests (unit_id, tenant_id, title, description, priority, status)
       VALUES (?, ?, ?, ?, ?, 'open')`
    )
    .run(unit_id, lease.tenant_id, title, description || null, priority || 'normal');
  const created = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);

  const owner = db
    .prepare(
      `SELECT owner.id, owner.email, owner.name, u.unit_number, p.name AS property_name
       FROM units u JOIN properties p ON p.id = u.property_id JOIN users owner ON owner.id = p.owner_id
       WHERE u.id = ?`
    )
    .get(unit_id);
  if (owner) {
    sendNotificationEmail({
      userId: owner.id,
      to: owner.email,
      subject: `New maintenance request from your tenant — ${owner.property_name} Unit ${owner.unit_number}`,
      html: `<p>Hi ${owner.name || ''},</p>
        <p>Your tenant submitted a new maintenance request for <strong>${owner.property_name} Unit ${owner.unit_number}</strong>:</p>
        <p><strong>${title}</strong> (${priority || 'normal'} priority)${description ? `<br>${description}` : ''}</p>
        <p>Log in to IronGate Housing to view details.</p>`,
    }).catch(() => {});
  }
});

router.get('/documents', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  if (tenantIds.length === 0 && leaseIds.length === 0) return res.json([]);
  const tenantPlaceholders = tenantIds.map(() => '?').join(',') || 'NULL';
  const leasePlaceholders = leaseIds.map(() => '?').join(',') || 'NULL';
  const rows = db
    .prepare(
      `SELECT * FROM documents
       WHERE tenant_id IN (${tenantPlaceholders}) OR lease_id IN (${leasePlaceholders})
       ORDER BY uploaded_at DESC`
    )
    .all(...tenantIds, ...leaseIds);
  res.json(rows);
});

router.post('/documents', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  if (leaseIds.length === 0) {
    fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    return res.status(403).json({ error: 'No lease on file for your account' });
  }

  // Uploads are tied to one of the tenant's own leases — either the one they
  // specify, or their most relevant one (active lease preferred) by default.
  const { lease_id, category } = req.body;
  const leasePlaceholders = leaseIds.map(() => '?').join(',');
  let lease;
  if (lease_id) {
    lease = db.prepare(`SELECT * FROM leases WHERE id = ? AND id IN (${leasePlaceholders})`).get(lease_id, ...leaseIds);
    if (!lease) {
      fs.unlink(path.join(uploadDir, req.file.filename), () => {});
      return res.status(403).json({ error: "That lease isn't linked to your account" });
    }
  } else {
    lease = db
      .prepare(
        `SELECT * FROM leases WHERE id IN (${leasePlaceholders}) ORDER BY (status = 'active') DESC, start_date DESC LIMIT 1`
      )
      .get(...leaseIds);
  }

  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(lease.unit_id);
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(unit.property_id);

  const info = db
    .prepare(
      `INSERT INTO documents (owner_id, property_id, lease_id, tenant_id, filename, original_name, category, uploaded_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'tenant')`
    )
    .run(
      property.owner_id,
      property.id,
      lease.id,
      lease.tenant_id,
      req.file.filename,
      req.file.originalname,
      category || 'other'
    );
  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/documents/:id', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  const tenantPlaceholders = tenantIds.map(() => '?').join(',') || 'NULL';
  const leasePlaceholders = leaseIds.map(() => '?').join(',') || 'NULL';
  const doc = db
    .prepare(
      `SELECT * FROM documents WHERE id = ? AND uploaded_by_role = 'tenant'
       AND (tenant_id IN (${tenantPlaceholders}) OR lease_id IN (${leasePlaceholders}))`
    )
    .get(req.params.id, ...tenantIds, ...leaseIds);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(uploadDir, doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Tenant-side notifications, computed live the same way the landlord's are
// (see routes/notifications.js) — not stored rows, so "acknowledging" one
// just records its id in notification_acks to exclude it from future
// results. Ids are prefixed "t-" so they can't collide with the landlord's
// notification ids in that same acks table.
router.get('/notifications', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  const items = [];

  if (leaseIds.length > 0) {
    const leasePlaceholders = leaseIds.map(() => '?').join(',');

    const overduePayments = db
      .prepare(
        `SELECT pay.*, u.unit_number, p.name AS property_name
         FROM payments pay
         JOIN leases l ON l.id = pay.lease_id
         JOIN units u ON u.id = l.unit_id
         JOIN properties p ON p.id = u.property_id
         WHERE pay.lease_id IN (${leasePlaceholders}) AND pay.status = 'pending' AND pay.due_date < date('now')
         ORDER BY pay.due_date ASC LIMIT 10`
      )
      .all(...leaseIds);
    overduePayments.forEach((p) => {
      items.push({
        id: `t-overdue-${p.id}`,
        tone: 'red',
        message: `Rent overdue — ${p.property_name} Unit ${p.unit_number}, $${p.amount} due ${p.due_date}`,
        link: '/payments',
        timestamp: p.due_date,
      });
    });

    const endingLeases = db
      .prepare(
        `SELECT l.*, u.unit_number, p.name AS property_name
         FROM leases l
         JOIN units u ON u.id = l.unit_id
         JOIN properties p ON p.id = u.property_id
         WHERE l.id IN (${leasePlaceholders}) AND l.status = 'active' AND l.end_date IS NOT NULL
               AND l.end_date <= date('now', '+30 days')
         ORDER BY l.end_date ASC LIMIT 10`
      )
      .all(...leaseIds);
    endingLeases.forEach((l) => {
      const expired = l.end_date < new Date().toISOString().slice(0, 10);
      items.push({
        id: `t-lease-${l.id}`,
        tone: 'red',
        message: `${expired ? 'Lease ended' : 'Lease ending soon'} — ${l.property_name} Unit ${l.unit_number} (${l.end_date})`,
        link: '/',
        timestamp: l.end_date,
      });
    });
  }

  if (tenantIds.length > 0) {
    const tenantPlaceholders = tenantIds.map(() => '?').join(',');

    const resolvedMaintenance = db
      .prepare(
        `SELECT m.*, u.unit_number, p.name AS property_name
         FROM maintenance_requests m
         JOIN units u ON u.id = m.unit_id
         JOIN properties p ON p.id = u.property_id
         WHERE m.tenant_id IN (${tenantPlaceholders}) AND m.status = 'resolved'
               AND m.resolved_at >= datetime('now', '-3 days')
         ORDER BY m.resolved_at DESC LIMIT 10`
      )
      .all(...tenantIds);
    resolvedMaintenance.forEach((m) => {
      items.push({
        id: `t-maint-${m.id}`,
        tone: 'green',
        message: `Maintenance resolved — ${m.title} (${m.property_name} Unit ${m.unit_number})`,
        link: '/maintenance',
        timestamp: m.resolved_at,
      });
    });
  }

  const leasePlaceholders = leaseIds.map(() => '?').join(',') || 'NULL';
  const tenantPlaceholders = tenantIds.map(() => '?').join(',') || 'NULL';
  if (tenantIds.length > 0 || leaseIds.length > 0) {
    const newDocuments = db
      .prepare(
        `SELECT d.*, p.name AS property_name
         FROM documents d
         LEFT JOIN properties p ON p.id = d.property_id
         WHERE (d.tenant_id IN (${tenantPlaceholders}) OR d.lease_id IN (${leasePlaceholders}))
               AND d.uploaded_by_role = 'landlord' AND d.uploaded_at >= datetime('now', '-3 days')
         ORDER BY d.uploaded_at DESC LIMIT 10`
      )
      .all(...tenantIds, ...leaseIds);
    newDocuments.forEach((d) => {
      items.push({
        id: `t-doc-${d.id}`,
        tone: 'amber',
        message: `New document from your landlord — ${d.original_name}`,
        link: '/documents',
        timestamp: d.uploaded_at,
      });
    });
  }

  const acked = new Set(
    db.prepare('SELECT notification_id FROM notification_acks WHERE user_id = ?').all(req.user.id).map((r) => r.notification_id)
  );
  const unacknowledged = items.filter((item) => !acked.has(item.id));
  unacknowledged.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  res.json(unacknowledged.slice(0, 30));
});

router.post('/notifications/:id/ack', (req, res) => {
  db.prepare('INSERT OR IGNORE INTO notification_acks (user_id, notification_id) VALUES (?, ?)').run(
    req.user.id,
    req.params.id
  );
  res.status(204).end();
});

// A tenant can ask their landlord for a different way of paying rent
// (e.g. splitting it into installments), temporarily or permanently. The
// landlord reviews and approves/denies it (see routes/paymentPlans.js).
router.get('/payment-plan-requests', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  if (tenantIds.length === 0) return res.json([]);
  const placeholders = tenantIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT r.* FROM payment_plan_requests r WHERE r.tenant_id IN (${placeholders}) ORDER BY r.created_at DESC`
    )
    .all(...tenantIds);
  res.json(rows);
});

router.post('/payment-plan-requests', (req, res) => {
  const { tenant_id, installment_plan, duration, temporary_end_date, note } = req.body;
  const validPlans = ['full', 'split2', 'split4'];
  if (!tenant_id || !validPlans.includes(installment_plan)) {
    return res.status(400).json({ error: 'tenant_id and a valid installment_plan are required' });
  }
  const resolvedDuration = duration === 'permanent' ? 'permanent' : 'temporary';

  const tenantIds = linkedTenantIds(req.user.id);
  if (!tenantIds.includes(Number(tenant_id))) {
    return res.status(403).json({ error: "That tenant record isn't linked to your account" });
  }

  const info = db
    .prepare(
      `INSERT INTO payment_plan_requests (tenant_id, requested_by_user_id, installment_plan, duration, temporary_end_date, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      tenant_id,
      req.user.id,
      installment_plan,
      resolvedDuration,
      resolvedDuration === 'temporary' ? temporary_end_date || null : null,
      note || null
    );

  const tenant = db
    .prepare(
      `SELECT t.first_name, t.last_name, owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email
       FROM tenants t JOIN users owner ON owner.id = t.owner_id WHERE t.id = ?`
    )
    .get(tenant_id);
  if (tenant) {
    sendNotificationEmail({
      userId: tenant.owner_id,
      to: tenant.owner_email,
      subject: `Payment plan request from ${tenant.first_name} ${tenant.last_name}`,
      html: `<p>Hi ${tenant.owner_name || ''},</p>
        <p>${tenant.first_name} ${tenant.last_name} has requested a ${resolvedDuration} change to their payment
        plan (${installment_plan === 'full' ? 'pay in full' : installment_plan === 'split2' ? 'split into 2 payments' : 'split into 4 payments'}).</p>
        ${note ? `<p>Note from tenant: "${note}"</p>` : ''}
        <p>Log in to IronGate Housing and open the Payment Plans tab to review.</p>`,
    }).catch(() => {});
  }

  const row = db.prepare('SELECT * FROM payment_plan_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.get('/documents/:id/download', (req, res) => {
  const tenantIds = linkedTenantIds(req.user.id);
  const leaseIds = linkedLeaseIds(tenantIds);
  const tenantPlaceholders = tenantIds.map(() => '?').join(',') || 'NULL';
  const leasePlaceholders = leaseIds.map(() => '?').join(',') || 'NULL';
  const doc = db
    .prepare(
      `SELECT * FROM documents WHERE id = ? AND (tenant_id IN (${tenantPlaceholders}) OR lease_id IN (${leasePlaceholders}))`
    )
    .get(req.params.id, ...tenantIds, ...leaseIds);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(uploadDir, doc.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });
  res.download(filePath, doc.original_name);
});

module.exports = router;
