const express = require('express');
const db = require('../db');
const { getStripe } = require('../stripeClient');
const { sendEmail } = require('../emailClient');

const router = express.Router();

// Stripe requires the raw, unparsed request body to verify the signature —
// this route must be mounted before express.json() in server.js.
router.post('/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set — cannot verify incoming Stripe webhook.');
    return res.status(500).send('Webhook not configured');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const paymentId = session.metadata && session.metadata.payment_id;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    if (paymentId) {
      const result = db.prepare(
        `UPDATE payments
         SET status = 'paid', paid_date = date('now'), method = 'card', stripe_payment_intent_id = ?
         WHERE id = ? AND status != 'paid'`
      ).run(paymentIntentId, paymentId);

      if (result.changes > 0) {
        const details = db
          .prepare(
            `SELECT pay.amount, owner.email AS owner_email, owner.name AS owner_name,
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
        if (details) {
          sendEmail({
            to: details.owner_email,
            subject: `Payment received — $${details.amount} (${details.property_name} Unit ${details.unit_number})`,
            html: `<p>Hi ${details.owner_name || ''},</p>
              <p>${details.first_name} ${details.last_name} just paid <strong>$${details.amount}</strong> for
              <strong>${details.property_name} Unit ${details.unit_number}</strong> via card.</p>
              <p>Log in to IronGate Housing to view details.</p>`,
          }).catch(() => {});
        }
      }
    }
  }

  res.json({ received: true });
});

module.exports = router;
