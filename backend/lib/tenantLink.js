const db = require('../db');

// Links tenant records (created by landlords) to a tenant's own login account,
// matched by email. Called whenever a tenant user registers/logs in (in case a
// landlord already added them) and whenever a landlord adds/edits a tenant
// record (in case that person already has a tenant account).

// Given a tenant USER's id + email, link any un-linked tenant records that share that email.
function linkRecordsToUser(userId, email) {
  if (!email) return;
  db.prepare(`UPDATE tenants SET user_id = ? WHERE user_id IS NULL AND lower(email) = lower(?)`).run(userId, email);
}

// Given a tenant RECORD's email, link it to a matching tenant user account if one exists.
function linkRecordToExistingUser(tenantRecordId, email) {
  if (!email) return;
  const user = db.prepare(`SELECT id FROM users WHERE role = 'tenant' AND lower(email) = lower(?)`).get(email);
  if (user) {
    db.prepare(`UPDATE tenants SET user_id = ? WHERE id = ? AND user_id IS NULL`).run(user.id, tenantRecordId);
  }
}

module.exports = { linkRecordsToUser, linkRecordToExistingUser };
