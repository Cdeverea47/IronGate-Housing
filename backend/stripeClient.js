const Stripe = require('stripe');

let stripeInstance = null;

// Lazily constructed so the rest of the app still works if Stripe isn't
// configured yet — only routes that actually need Stripe will throw. This
// also catches the .env.example placeholder value (`sk_test_...`) being left
// in place, which otherwise reaches Stripe's API and comes back as a
// confusing "Invalid API Key provided" error with no indication of what to
// fix.
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  const looksConfigured = key && key.startsWith('sk_') && !key.includes('...');
  if (!looksConfigured) {
    const err = new Error(
      'Online card payments aren\'t set up yet — set a real STRIPE_SECRET_KEY in backend/.env (see README) to enable them. You can pay via Zelle in the meantime, if your landlord has that set up.'
    );
    err.statusCode = 503;
    throw err;
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

// Translates raw Stripe SDK errors into messages that actually tell the
// landlord/tenant what's wrong and what to do, instead of surfacing Stripe's
// own wording (e.g. "Invalid API Key provided: sk_test_***") verbatim.
function friendlyStripeError(err) {
  if (err.type === 'StripeAuthenticationError') {
    const friendly = new Error(
      "Online card payments aren't configured correctly — the Stripe API key in backend/.env is invalid. Ask your admin to check STRIPE_SECRET_KEY, or pay via Zelle instead."
    );
    friendly.statusCode = 503;
    return friendly;
  }
  if (err.type === 'StripeConnectionError') {
    const friendly = new Error('Could not reach Stripe right now — please try again in a moment, or pay via Zelle.');
    friendly.statusCode = 503;
    return friendly;
  }
  return err;
}

module.exports = { getStripe, friendlyStripeError };
