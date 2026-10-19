const express = require('express');
const db = require('../db');
const { unitLabel } = require('../lib/labels');
const { normalizeCategory, categoryLabel } = require('../lib/maintenanceCategories');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendNotificationEmail } = require('../emailClient');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

function ownsUnit(unitId, userId) {
  return db
    .prepare(`SELECT u.* FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = ? AND p.owner_id = ?`)
    .get(unitId, userId);
}
function ownsRequest(reqId, userId) {
  return db
    .prepare(
      `SELECT m.* FROM maintenance_requests m
       JOIN units u ON u.id = m.unit_id JOIN properties p ON p.id = u.property_id
       WHERE m.id = ? AND p.owner_id = ?`
    )
    .get(reqId, userId);
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `SELECT m.*, u.unit_number, u.is_default AS unit_is_default, p.name AS property_name
             FROM maintenance_requests m
             JOIN units u ON u.id = m.unit_id
             JOIN properties p ON p.id = u.property_id
             WHERE p.owner_id = ?`;
  const params = [req.user.id];
  if (status) {
    sql += ' AND m.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY m.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map((r) => ({ ...r, unit_label: unitLabel(r.unit_number, r.property_name, r.unit_is_default) })));
});

router.post('/', (req, res) => {
  const { unit_id, tenant_id, title, description, priority, status, category } = req.body;
  if (!unit_id || !title) return res.status(400).json({ error: 'unit_id and title are required' });
  const cat = normalizeCategory(category);
  if (!cat.ok) return res.status(400).json({ error: 'Unknown maintenance category' });
  if (!ownsUnit(unit_id, req.user.id)) return res.status(404).json({ error: 'Unit not found' });
  const info = db
    .prepare(
      `INSERT INTO maintenance_requests (unit_id, tenant_id, title, description, priority, status, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(unit_id, tenant_id || null, title, description || null, priority || 'normal', status || 'open', cat.value);
  const created = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);

  // Notify the owner by email — best-effort, doesn't block the response.
  const owner = db
    .prepare(
      `SELECT owner.id, owner.email, owner.name, u.unit_number, u.is_default AS unit_is_default, p.name AS property_name
       FROM units u JOIN properties p ON p.id = u.property_id JOIN users owner ON owner.id = p.owner_id
       WHERE u.id = ?`
    )
    .get(unit_id);
  if (owner) {
    sendNotificationEmail({
      userId: owner.id,
      to: owner.email,
      subject: `New maintenance request — ${unitLabel(owner.unit_number, owner.property_name, owner.unit_is_default)}`,
      html: `<p>Hi ${owner.name || ''},</p>
        <p>A new maintenance request was logged for <strong>${unitLabel(owner.unit_number, owner.property_name, owner.unit_is_default)}</strong>:</p>
        <p><strong>${title}</strong>${cat.value ? ` [${categoryLabel(cat.value)}]` : ''} (${priority || 'normal'} priority)${description ? `<br>${description}` : ''}</p>
        <p>Log in to IronGate Housing to view details.</p>`,
    }).catch(() => {});
  }
});

router.put('/:id', (req, res) => {
  const existing = ownsRequest(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Maintenance request not found' });
  const { title, description, priority, status, category } = req.body;
  const cat = category === undefined ? { ok: true, value: existing.category } : normalizeCategory(category);
  if (!cat.ok) return res.status(400).json({ error: 'Unknown maintenance category' });
  const resolvedAt = status === 'resolved' ? new Date().toISOString() : existing.resolved_at;
  db.prepare(
    `UPDATE maintenance_requests SET title = ?, description = ?, priority = ?, status = ?, resolved_at = ?, category = ? WHERE id = ?`
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    priority ?? existing.priority,
    status ?? existing.status,
    resolvedAt,
    cat.value,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = ownsRequest(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Maintenance request not found' });
  db.prepare('DELETE FROM maintenance_requests WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
