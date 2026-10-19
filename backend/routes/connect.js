// Landlord-side Stripe Connect: lets a landlord connect the bank account that
// rent gets paid out to. Stripe's hosted onboarding collects identity + bank
// details, so none of that ever touches this server.
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getStripe, friendlyStripeError, stripeV2 } = require('../stripeClient');
const { APP_URL, syncAccountStatus } = require('../lib/connect');

const router = express.Router();
router.use(requireAuth, requireRole('landlord'));

function currentUser(id) {
  return db.prepare('SELECT id, name, email, stripe_account_id FROM users WHERE id = ?').get(id);
}

function handleError(err, res, next) {
  const friendly = friendlyStripeError(err);
  if (friendly.statusCode) return res.status(friendly.statusCode).json({ error: friendly.message });
  next(friendly);
}

function summarize(account) {
  const bank = account.external_accounts && account.external_accounts.data && account.external_accounts.data[0];
  return {
    connected: true,
    details_submitted: !!account.details_submitted,
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    bank: bank ? { bank_name: bank.bank_name || null, last4: bank.last4 || null } : null,
    requirements_due: (account.requirements && account.requirements.currently_due) || [],
  };
}

// Current connection state (also refreshes the cached flags used at checkout).
router.get('/status', async (req, res, next) => {
  const user = currentUser(req.user.id);
  if (!user.stripe_account_id) return res.json({ connected: false });
  try {
    const stripe = getStripe();
    const account = await syncAccountStatus(stripe, user.id, user.stripe_account_id);
    res.json(summarize(account));
  } catch (err) {
    handleError(err, res, next);
  }
});

// Creates the connected account on first use, then returns a one-time Stripe
// onboarding URL for the browser to redirect to. Safe to call again to resume
// or update onboarding.
router.post('/onboard', async (req, res, next) => {
  const user = currentUser(req.user.id);
  try {
    const stripe = getStripe();
    let accountId = user.stripe_account_id;
    if (!accountId) {
      // Accounts v2. The landlord is the merchant of record: full Stripe
      // Dashboard, Stripe collects its fees from them and covers their losses.
      const account = await stripeV2('core/accounts', {
        contact_email: user.email,
        display_name: user.name || user.email,
        dashboard: 'full',
        identity: { country: 'us' },
        configuration: {
          merchant: { capabilities: { card_payments: { requested: true } } },
        },
        defaults: {
          currency: 'usd',
          responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
          locales: ['en-US'],
        },
        metadata: { irongate_user_id: String(user.id) },
      });
      accountId = account.id;
      db.prepare('UPDATE users SET stripe_account_id = ? WHERE id = ?').run(accountId, user.id);
    }

    const link = await stripeV2('core/account_links', {
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant'],
          refresh_url: `${APP_URL}/profile?connect=refresh`,
          return_url: `${APP_URL}/profile?connect=return`,
        },
      },
    });
    res.status(201).json({ url: link.url });
  } catch (err) {
    handleError(err, res, next);
  }
});

// Where a landlord goes to see payouts, change their bank, etc. (their full
// Stripe Dashboard).
router.get('/dashboard-link', (req, res) => {
  const user = currentUser(req.user.id);
  if (!user.stripe_account_id) return res.status(400).json({ error: 'Connect a bank account first' });
  res.json({ url: `https://dashboard.stripe.com/${user.stripe_account_id}` });
});

module.exports = router;
