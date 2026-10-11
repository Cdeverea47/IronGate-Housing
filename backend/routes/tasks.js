const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

function ownsTask(taskId, userId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?').get(taskId, userId);
}

function withPropertyName(row) {
  return { ...row, done: !!row.done };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS property_name
       FROM tasks t
       LEFT JOIN properties p ON p.id = t.property_id
       WHERE t.owner_id = ?
       ORDER BY t.done ASC, t.due_date IS NULL, t.due_date ASC, t.created_at DESC`
    )
    .all(req.user.id);
  res.json(rows.map(withPropertyName));
});

router.post('/', (req, res) => {
  const { title, due_date, property_id, audience } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  const safeAudience = audience === 'tenant' ? 'tenant' : 'landlord';
  const info = db
    .prepare('INSERT INTO tasks (owner_id, title, due_date, property_id, audience) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, title.trim(), due_date || null, property_id || null, safeAudience);
  const row = db
    .prepare(
      `SELECT t.*, p.name AS property_name FROM tasks t LEFT JOIN properties p ON p.id = t.property_id WHERE t.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json(withPropertyName(row));
});

router.put('/:id', (req, res) => {
  const existing = ownsTask(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const { title, due_date, done, property_id, audience } = req.body;
  db.prepare('UPDATE tasks SET title = ?, due_date = ?, done = ?, property_id = ?, audience = ? WHERE id = ?').run(
    title ?? existing.title,
    due_date !== undefined ? due_date : existing.due_date,
    done !== undefined ? (done ? 1 : 0) : existing.done,
    property_id !== undefined ? property_id || null : existing.property_id,
    audience === 'tenant' || audience === 'landlord' ? audience : existing.audience,
    req.params.id
  );
  const row = db
    .prepare(
      `SELECT t.*, p.name AS property_name FROM tasks t LEFT JOIN properties p ON p.id = t.property_id WHERE t.id = ?`
    )
    .get(req.params.id);
  res.json(withPropertyName(row));
});

router.delete('/:id', (req, res) => {
  const existing = ownsTask(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// The dashboard's "My tasks" box also lists auto-generated items (overdue
// rent, high-priority maintenance, insurance renewals, draft listings).
// Those aren't rows in `tasks` — they're computed live on the frontend from
// other endpoints — so lining one out just records its id here, the same
// way notification acknowledgements work.
router.get('/acks', (req, res) => {
  const rows = db.prepare('SELECT item_id FROM dashboard_item_acks WHERE user_id = ?').all(req.user.id);
  res.json(rows.map((r) => r.item_id));
});

router.post('/acks', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  db.prepare('INSERT OR IGNORE INTO dashboard_item_acks (user_id, item_id) VALUES (?, ?)').run(req.user.id, id);
  res.status(204).end();
});

module.exports = router;
