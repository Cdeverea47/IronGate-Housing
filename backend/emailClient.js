// Sends transactional emails via the Resend HTTP API using Node's built-in
// fetch — no SDK/npm dependency required. If RESEND_API_KEY isn't set, this
// silently no-ops (logging to console) so the rest of the app keeps working
// without email configured.

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'IronGate Housing <onboarding@resend.dev>';

  if (!apiKey || !to) {
    console.log(`[email] skipped (not configured or no recipient) — subject: "${subject}" to: ${to || 'n/a'}`);
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[email] Resend request failed (${res.status}): ${text}`);
      return { skipped: false, ok: false };
    }
    return { skipped: false, ok: true };
  } catch (err) {
    console.error('[email] failed to send:', err.message);
    return { skipped: false, ok: false };
  }
}

// For non-essential notification emails (as opposed to security/transactional
// ones like password resets or 2FA codes, which always send regardless of
// this preference), check the recipient's email_notifications_enabled flag
// first. Requiring db here (rather than in every call site) keeps that check
// in one place.
async function sendNotificationEmail({ userId, to, subject, html }) {
  const db = require('./db');
  const user = db.prepare('SELECT email_notifications_enabled FROM users WHERE id = ?').get(userId);
  if (user && !user.email_notifications_enabled) {
    console.log(`[email] skipped (notifications disabled for user ${userId}) — subject: "${subject}"`);
    return { skipped: true };
  }
  return sendEmail({ to, subject, html });
}

module.exports = { sendEmail, sendNotificationEmail };
