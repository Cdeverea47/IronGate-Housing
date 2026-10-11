// Automatic "lease ending soon" email reminders. This runs on a plain
// setInterval (see server.js) rather than a cron dependency, since the app
// otherwise avoids adding npm packages. Each qualifying lease is only
// emailed once (tracked via leases.renewal_reminder_sent_at) — the bell
// notification in routes/notifications.js re-checks live every time instead,
// so it doesn't need the same guard.
const db = require('../db');
const { sendEmail, sendNotificationEmail } = require('../emailClient');

async function checkLeaseRenewals() {
  const leases = db
    .prepare(
      `SELECT l.*, u.unit_number, p.name AS property_name,
              t.first_name, t.last_name, t.email AS tenant_email, t.user_id AS tenant_user_id,
              owner.id AS owner_user_id, owner.name AS owner_name, owner.email AS owner_email
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN users owner ON owner.id = p.owner_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.status = 'active'
         AND l.end_date IS NOT NULL
         AND l.end_date <= date('now', '+30 days')
         AND l.end_date >= date('now')
         AND l.renewal_reminder_sent_at IS NULL`
    )
    .all();

  for (const lease of leases) {
    const subject = `Lease ending soon — ${lease.property_name} Unit ${lease.unit_number}`;
    const tenantName = `${lease.first_name} ${lease.last_name}`;

    // This is a heads-up, not an essential/security email, so it respects
    // each recipient's "email notifications" preference.
    await sendNotificationEmail({
      userId: lease.owner_user_id,
      to: lease.owner_email,
      subject,
      html: `<p>Hi ${lease.owner_name || ''},</p>
        <p>${tenantName}'s lease at <strong>${lease.property_name} Unit ${lease.unit_number}</strong> ends on
        <strong>${lease.end_date}</strong> — that's within the next 30 days.</p>
        <p>Log in to IronGate Housing to start a renewal or confirm the move-out.</p>`,
    }).catch(() => {});

    if (lease.tenant_email) {
      const tenantHtml = `<p>Hi ${lease.first_name},</p>
          <p>Your lease at <strong>${lease.property_name} Unit ${lease.unit_number}</strong> ends on
          <strong>${lease.end_date}</strong> — that's within the next 30 days.</p>
          <p>Reach out to your landlord if you'd like to renew, or to confirm your move-out plans.</p>`;
      if (lease.tenant_user_id) {
        await sendNotificationEmail({ userId: lease.tenant_user_id, to: lease.tenant_email, subject, html: tenantHtml }).catch(
          () => {}
        );
      } else {
        // No linked login account yet, so there's no preference to check.
        await sendEmail({ to: lease.tenant_email, subject, html: tenantHtml }).catch(() => {});
      }
    }

    db.prepare("UPDATE leases SET renewal_reminder_sent_at = datetime('now') WHERE id = ?").run(lease.id);
  }

  return leases.length;
}

module.exports = { checkLeaseRenewals };
