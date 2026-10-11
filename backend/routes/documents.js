const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getUploadsDir } = require('../lib/paths');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

const uploadDir = getUploadsDir();
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const { property_id, lease_id, tenant_id } = req.query;
  let sql = 'SELECT * FROM documents WHERE owner_id = ?';
  const params = [req.user.id];
  if (property_id) {
    sql += ' AND property_id = ?';
    params.push(property_id);
  }
  if (lease_id) {
    sql += ' AND lease_id = ?';
    params.push(lease_id);
  }
  if (tenant_id) {
    sql += ' AND tenant_id = ?';
    params.push(tenant_id);
  }
  sql += ' ORDER BY uploaded_at DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const { property_id, lease_id, tenant_id, category } = req.body;
  const info = db
    .prepare(
      `INSERT INTO documents (owner_id, property_id, lease_id, tenant_id, filename, original_name, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      property_id || null,
      lease_id || null,
      tenant_id || null,
      req.file.filename,
      req.file.originalname,
      category || 'other'
    );
  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
});

router.get('/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(uploadDir, doc.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });
  res.download(filePath, doc.original_name);
});

router.delete('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const filePath = path.join(uploadDir, doc.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
