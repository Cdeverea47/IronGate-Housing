const express = require('express');
const db = require('../db');
const { getStripe } = require('../stripeClient');
const { sendEmail } = require('../emailClient');

const router = express.Router();

// Rent is charged directly on each landlord's *connected* Stripe account, so
// its events arrive through a Connect webhook endpoint ("Listen to events on
// Connected accounts" in the Stripe dashboard), which has its own signing
// secret. Platform-level events use the regular secret. Either may be set;
// the signature decides which one the event came from.
function verifyEvent(rawBody, signature) {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
  if (secrets.length === 0) {
    const err = new Error('No webhook secret configured');
    err.notConfigured = true;
    throw err;
  }
  const stripe = getStripe();
  let lastError;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function markRentPaid(session, connectedAccountId) {
  const paymentId = session.metadata && session.metadata.payment_id;
  if (!paymentId) return;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  // Only trust a payment event from the landlord's own connected account.
  const details = db
    .prepare(
      `SELECT pay.amount, owner.email AS owner_email, owner.name AS owner_name, owner.stripe_account_id,
              t.first_name, t.last_name, u.unit_number, p.name AS property_name
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN users owner ON owner.id = p.owner_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE pay.id = ?`
    )
    .get(paymentId);
  if (!details) return;
  if (connectedAccountId && details.stripe_account_id !== connectedAccountId) {
    console.error(`Ignoring payment ${paymentId}: event account ${connectedAccountId} does not match landlord account.`);
    return;
  }
  // Delayed methods (e.g. ACH) complete the session before the money lands.
  // Only mark paid once Stripe says the payment actually succeeded.
  if (session.payment_status && session.payment_status !== 'paid') return;

  const result = db
    .prepare(
      `UPDATE payments
       SET status = 'paid', amount_paid = amount, paid_date = date('now'), method = 'card', stripe_payment_intent_id = ?
       WHERE id = ? AND status != 'paid'`
    )
    .run(paymentIntentId, paymentId);

  if (result.changes > 0) {
    sendEmail({
      to: details.owner_email,
      subject: `Payment received — $${details.amount} (${details.property_name} Unit ${details.unit_number})`,
      html: `<p>Hi ${details.owner_name || ''},</p>
        <p>${details.first_name} ${details.last_name} just paid <strong>$${details.amount}</strong> for
        <strong>${details.property_name} Unit ${details.unit_number}</strong> online.</p>
        <p>The funds are on their way to your connected bank account. Log in to IronGate Housing to view details.</p>`,
    }).catch(() => {});
  }
}

// Stripe requires the raw, unparsed request body to verify the signature —
// this route must be mounted before express.json() in server.js.
router.post('/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = verifyEvent(req.body, signature);
  } catch (err) {
    if (err.notConfigured) {
      console.error('No STRIPE_WEBHOOK_SECRET / STRIPE_CONNECT_WEBHOOK_SECRET set — cannot verify incoming Stripe webhook.');
      return res.status(500).send('Webhook not configured');
    }
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    markRentPaid(event.data.object, event.account || null);
  } else if (event.type === 'account.updated') {
    // Keep the cached "can this landlord take payments / receive payouts" flags fresh.
    const account = event.data.object;
    db.prepare('UPDATE users SET stripe_charges_enabled = ?, stripe_payouts_enabled = ? WHERE stripe_account_id = ?').run(
      account.charges_enabled ? 1 : 0,
      account.payouts_enabled ? 1 : 0,
      account.id
    );
  }

  res.json({ received: true });
});

module.exports = router;
