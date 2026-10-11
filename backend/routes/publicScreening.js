// Public, unauthenticated route: the applicant clicks a tokenized link from
// their screening-request email and lands on this page/endpoint. No login
// required — the token itself is the access control, same idea as a
// password-reset link.
const express = require('express');
const db = require('../db');
const { sendEmail } = require('../emailClient');

const router = express.Router();

function getByToken(token) {
  return db
    .prepare(
      `SELECT s.*, p.name AS property_name, owner.name AS landlord_name, owner.email AS landlord_email
       FROM screening_requests s
       LEFT JOIN properties p ON p.id = s.property_id
       JOIN users owner ON owner.id = s.owner_id
       WHERE s.token = ?`
    )
    .get(token);
}

router.get('/:token', (req, res) => {
  const request = getByToken(req.params.token);
  if (!request) return res.status(404).json({ error: 'Screening request not found' });
  res.json({
    applicant_name: request.applicant_name,
    property_name: request.property_name,
    landlord_name: request.landlord_name,
    status: request.status,
    applicant_reported_at: request.applicant_reported_at,
  });
});

// The applicant hits this once they've completed screening on the
// third-party site, so the landlord gets an email nudge to come review it —
// this does NOT mark the request "completed" itself, since only the
// landlord can confirm the actual result.
router.post('/:token/report', async (req, res) => {
  const request = getByToken(req.params.token);
  if (!request) return res.status(404).json({ error: 'Screening request not found' });

  db.prepare('UPDATE screening_requests SET applicant_reported_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    request.id
  );

  await sendEmail({
    to: request.landlord_email,
    subject: `${request.applicant_name} completed their screening`,
    html: `<p>Hi ${request.landlord_name || ''},</p>
      <p><strong>${request.applicant_name}</strong> has reported that they completed their screening${
      request.property_name ? ` for <strong>${request.property_name}</strong>` : ''
    }.</p>
      <p>Log in to IronGate Housing and open the Screening tab to review and record the result.</p>`,
  }).catch(() => {});

  res.status(204).end();
});

module.exports = router;
