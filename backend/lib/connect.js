// Stripe Connect helpers. Rent is charged *directly on the landlord's connected
// Stripe account* (the landlord is the merchant of record and Stripe pays the
// money out to the bank account they added during Stripe's hosted onboarding),
// so IronGate never holds rent funds or sees bank details.
const db = require('../db');
const { getStripe } = require('../stripeClient');

const APP_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173';

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function landlordNotReadyError() {
  return httpError(
    "Online payments aren't available yet — your landlord hasn't finished connecting a bank account to receive rent. Ask them to set it up under Profile → Get paid, or pay another way (e.g. Zelle) in the meantime.",
    409
  );
}

function ownerForPayment(paymentId) {
  return db
    .prepare(
      `SELECT owner.id, owner.name, owner.email, owner.stripe_account_id, owner.stripe_charges_enabled
       FROM payments pay
       JOIN leases l ON l.id = pay.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN properties p ON p.id = u.property_id
       JOIN users owner ON owner.id = p.owner_id
       WHERE pay.id = ?`
    )
    .get(paymentId);
}

// Pulls the account's current state from Stripe and caches whether it can take
// payments / receive payouts. Called after onboarding and from the
// account.updated webhook so the app never has to guess.
async function syncAccountStatus(stripe, userId, accountId) {
  const account = await stripe.accounts.retrieve(accountId);
  db.prepare('UPDATE users SET stripe_charges_enabled = ?, stripe_payouts_enabled = ? WHERE id = ?').run(
    account.charges_enabled ? 1 : 0,
    account.payouts_enabled ? 1 : 0,
    userId
  );
  return account;
}

// Throws a friendly error unless the landlord can actually accept payments.
async function assertLandlordReady(stripe, owner) {
  if (!owner || !owner.stripe_account_id) throw landlordNotReadyError();
  if (owner.stripe_charges_enabled) return;
  // Cached flag may be stale (e.g. onboarding just finished) — re-check once.
  const account = await syncAccountStatus(stripe, owner.id, owner.stripe_account_id);
  if (!account.charges_enabled) throw landlordNotReadyError();
}

// A tenant's Stripe Customer lives on the landlord's connected account (that's
// where saved payment methods are stored under direct charges).
async function getOrCreateCustomer(stripe, user, accountId) {
  const existing = db
    .prepare('SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ? AND stripe_account_id = ?')
    .get(user.id, accountId);
  if (existing) return existing.stripe_customer_id;

  const customer = await stripe.customers.create(
    { email: user.email, name: user.name, metadata: { irongate_user_id: String(user.id) } },
    { stripeAccount: accountId }
  );
  db.prepare('INSERT INTO stripe_customers (user_id, stripe_account_id, stripe_customer_id) VALUES (?, ?, ?)').run(
    user.id,
    accountId,
    customer.id
  );
  return customer.id;
}

// Creates the Stripe-hosted Checkout page for a rent payment on the landlord's
// connected account. When the payer is a logged-in tenant, the session is tied
// to their Customer so previously saved cards / bank accounts are offered and
// they can choose to save a new one. Payment methods are not hard-coded:
// Checkout offers whatever the landlord's Stripe account has enabled
// (card, ACH bank debit, wallets...).
async function createRentCheckout({ payment, owner, tenantUser }) {
  const stripe = getStripe();
  await assertLandlordReady(stripe, owner);

  const params = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: Math.round((Number(payment.amount) - Number(payment.amount_paid || 0)) * 100), // remaining balance
          product_data: {
            name: `Rent — ${payment.property_name}, Unit ${payment.unit_number}`,
            description: `${payment.first_name} ${payment.last_name} · due ${payment.due_date}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { payment_id: String(payment.id) },
    payment_intent_data: { metadata: { payment_id: String(payment.id) } },
    success_url: `${APP_URL}/pay/success?payment_id=${payment.id}`,
    cancel_url: `${APP_URL}/pay/cancel?payment_id=${payment.id}`,
  };

  if (tenantUser) {
    params.customer = await getOrCreateCustomer(stripe, tenantUser, owner.stripe_account_id);
    params.saved_payment_method_options = { payment_method_save: 'enabled' };
  }

  const session = await stripe.checkout.sessions.create(params, { stripeAccount: owner.stripe_account_id });
  db.prepare('UPDATE payments SET stripe_session_id = ? WHERE id = ?').run(session.id, payment.id);
  return session;
}

module.exports = {
  APP_URL,
  httpError,
  landlordNotReadyError,
  ownerForPayment,
  syncAccountStatus,
  assertLandlordReady,
  getOrCreateCustomer,
  createRentCheckout,
};
