const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../emailClient');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

function ownsRequest(id, userId) {
  return db.prepare('SELECT * FROM screening_requests WHERE id = ? AND owner_id = ?').get(id, userId);
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, p.name AS property_name
       FROM screening_requests s
       LEFT JOIN properties p ON p.id = s.property_id
       WHERE s.owner_id = ?
       ORDER BY s.status ASC, s.sent_at DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { applicant_name, applicant_email, property_id } = req.body;
  if (!applicant_name || !applicant_email) {
    return res.status(400).json({ error: 'applicant_name and applicant_email are required' });
  }
  if (property_id) {
    const owns = db.prepare('SELECT id FROM properties WHERE id = ? AND owner_id = ?').get(property_id, req.user.id);
    if (!owns) return res.status(404).json({ error: 'Property not found' });
  }

  const landlord = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  const property = property_id ? db.prepare('SELECT name FROM properties WHERE id = ?').get(property_id) : null;
  const token = crypto.randomBytes(20).toString('hex');

  const info = db
    .prepare(
      `INSERT INTO screening_requests (owner_id, applicant_name, applicant_email, property_id, status, token)
       VALUES (?, ?, ?, ?, 'sent', ?)`
    )
    .run(req.user.id, applicant_name.trim(), applicant_email.trim(), property_id || null, token);

  // The email links to our own page (rather than straight to the screening
  // site) so the applicant has somewhere to come back to on IronGate itself
  // if they lose the email — that page carries the SmartMove link plus a
  // button to let the landlord know once they're done.
  const pageUrl = `${APP_URL}/screening-request/${token}`;
  await sendEmail({
    to: applicant_email.trim(),
    subject: `Screening request from ${landlord?.name || 'your prospective landlord'}`,
    html: `
      <p>Hi ${applicant_name.trim()},</p>
      <p>${landlord?.name || 'Your prospective landlord'} has requested a background/credit check as part of your
      rental application${property ? ` for <strong>${property.name}</strong>` : ''}.</p>
      <p>View your screening request and instructions here:</p>
      <p><a href="${pageUrl}">${pageUrl}</a></p>
    `,
  });

  const row = db
    .prepare(
      `SELECT s.*, p.name AS property_name FROM screening_requests s
       LEFT JOIN properties p ON p.id = s.property_id WHERE s.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = ownsRequest(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Screening request not found' });

  const { status, result_summary, result_link } = req.body;
  const newStatus = status === 'completed' || status === 'sent' ? status : existing.status;
  const completedAt =
    newStatus === 'completed' && existing.status !== 'completed'
      ? new Date().toISOString()
      : newStatus === 'completed'
      ? existing.completed_at
      : null;

  db.prepare(
    `UPDATE screening_requests SET status = ?, result_summary = ?, result_link = ?, completed_at = ? WHERE id = ?`
  ).run(
    newStatus,
    result_summary !== undefined ? result_summary : existing.result_summary,
    result_link !== undefined ? result_link : existing.result_link,
    completedAt,
    req.params.id
  );

  const row = db
    .prepare(
      `SELECT s.*, p.name AS property_name FROM screening_requests s
       LEFT JOIN properties p ON p.id = s.property_id WHERE s.id = ?`
    )
    .get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = ownsRequest(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Screening request not found' });
  db.prepare('DELETE FROM screening_requests WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
