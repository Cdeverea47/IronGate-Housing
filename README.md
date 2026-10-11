# IronGate Housing — Landlord & Tenant Property Manager

A full-stack property management app with two account types: landlords manage properties, units, tenants, leases, rent payments, maintenance requests, and document storage; tenants get their own portal to view their lease, pay rent, submit maintenance requests, and download shared documents.

**Stack:** React + Vite + Tailwind (frontend), Node.js + Express + SQLite (backend).

## Project structure

```
landlord-tenant-app/
  backend/     Express API + SQLite database (Node's built-in node:sqlite)
  frontend/    React app (Vite + Tailwind)
```

## Requirements

- Node.js 18+ and npm

## 1. Set up the backend

```bash
cd backend
npm install
cp .env.example .env    # edit JWT_SECRET to a random string
npm run dev
```

The API runs at `http://localhost:4000`. It creates `data.db` (SQLite) automatically on first run, along with an `uploads/` folder for document storage.

## 2. Set up the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` and proxies `/api` requests to the backend.

Open `http://localhost:5173`, click **Create one** to register, choose **Landlord** or **Tenant**, then log in. The sign-in page has the same Landlord/Tenant toggle — pick the account type you're signing into.

## 3. Landlord vs. tenant accounts

At signup you choose an account type:

- **Landlord** — full access to properties, units, tenants, leases, payments, maintenance, documents, insurance, and listings, as described below.
- **Tenant** — a scoped-down portal (see "Tenant portal" below) showing only their own lease, rent history, maintenance requests, and shared documents. Tenant accounts can't see or touch any landlord's management data.

A tenant account connects to the tenant record a landlord creates for them by matching email addresses — there's no invite code to enter. This works in either order: if the landlord adds the tenant (Tenants page) first, a matching signup links immediately; if the tenant signs up first, the link happens automatically the next time they log in after their landlord adds them. Use the exact same email on both sides.

The same email can also be used for both a landlord and a tenant account — useful if you manage properties and also rent one yourself. Since sign-in now asks which account type you want up front, just pick the right one on the toggle; you'll only be asked to disambiguate further in the rare case both accounts share the exact same password.

## 4. Using the app (landlord)

1. **Properties** — add a property, then add units to it (bedrooms, bathrooms, rent, status).
2. **Tenants** — add tenant contact info.
3. **Leases** — link a tenant to a unit with a start date and monthly rent. This marks the unit occupied. Each active lease shows how many months are left before it ends (or "Month-to-month" if there's no end date) — see "Lease renewal reminders" below for what happens as that date approaches.
4. **Payments** — log expected rent per lease. For any pending payment, click **Send payment link** to generate a secure, Stripe-hosted checkout page and copy/share the link with your tenant — it's marked paid automatically once they pay. You can also click **Mark paid manually** and choose cash, check, Zelle, bank transfer, or other. At the top of the Payments page you can save your own Zelle email/phone as a reminder to show tenants who want to pay that way — see "Zelle payments" below. Overdue pending payments are flagged.
5. **Maintenance** — log repair requests per unit and track status (open → in progress → resolved).
6. **Documents** — upload lease agreements, receipts, IDs, etc., optionally tied to a property or tenant, and download them anytime.
7. **Dashboard** — portfolio summary: occupancy, active leases, rent collected this month, overdue payments, open maintenance.
8. **Notifications** — the bell icon in the header shows overdue rent, recently received payments, high-priority and new maintenance requests, expiring/expired insurance policies, and leases ending within 30 days. Click an item to jump to the relevant page. Some of these events can also be emailed to you — see "Set up email notifications" below.

Each landlord account only sees its own data — the API scopes every query by the logged-in user.

## 5. Tenant portal

Tenants get a simpler view with four pages:

1. **Dashboard** — their lease details (unit, address, rent, dates, deposit) and landlord contact info, including the landlord's Zelle contact if saved. Each lease shows how many months are left before it ends.
2. **Payments** — their rent history and balance. For any pending payment they can click **Pay now** to open the same secure Stripe checkout landlords can send, without waiting for a link.
3. **Maintenance** — submit a new request against their unit and see the status of past ones.
4. **Documents** — download anything their landlord has shared with them (via the tenant or lease fields when uploading).

If a tenant signs up before their landlord has added them, the Dashboard shows a message asking them to check back — it links up automatically once the landlord adds a matching tenant record.

## 6. Lease renewal reminders

As a lease's end date gets within 30 days, it's flagged in two ways:

- **In-app** — it shows up in the notification bell (and as a red/amber badge on the Leases page and the tenant's Dashboard) for as long as it stays within that window.
- **Email** — a one-time reminder goes out to both the landlord and the tenant (if the tenant record has an email on file) when the lease first enters the 30-day window, via the same Resend setup as other email notifications (see "Set up email notifications" below).

The email fires once per lease term — editing the lease's end date (i.e. renewing it) resets that, so a newly extended lease gets its own reminder as its new end date approaches. This check runs automatically once a day; no setup is needed beyond having Resend configured for the email half.

## 7. Password reset

Click **Forgot password?** on the sign-in page, pick the account type (landlord or tenant), and enter your email. If a matching account exists, you'll get an emailed link (valid for 1 hour) to choose a new password — this uses the same Resend setup as email notifications, so it needs `RESEND_API_KEY` configured (see "Set up email notifications" below). Without it, the reset email is skipped rather than failing, so set that up first if you want this to actually deliver.

There's no separate username to recover — your username is just the email you signed up with, which the forgot-password page reminds you of.

## 8. Set up Stripe (online rent payments)

Rent payments use [Stripe Checkout](https://stripe.com/payments/checkout) — a Stripe-hosted page that collects card details directly. Card numbers never pass through this app or its server, so you don't have to handle PCI compliance yourself.

1. Create a free account at [dashboard.stripe.com](https://dashboard.stripe.com) if you don't have one.
2. In the Stripe Dashboard, make sure you're in **Test mode** (toggle top-right) while you're trying this out.
3. Go to **Developers → API keys** and copy the **Secret key** (starts with `sk_test_...`).
4. Paste it into `backend/.env` as `STRIPE_SECRET_KEY`.
5. Set up the webhook that tells your app when a payment succeeds:
   - **Easiest for local testing:** install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then run:
     ```bash
     stripe login
     stripe listen --forward-to localhost:4000/api/webhooks/stripe
     ```
     This prints a webhook signing secret (`whsec_...`) — copy it into `backend/.env` as `STRIPE_WEBHOOK_SECRET`. Keep `stripe listen` running alongside your backend while you test.
   - **For a real deployment:** in the Stripe Dashboard go to **Developers → Webhooks → Add endpoint**, set the URL to `https://yourdomain.com/api/webhooks/stripe`, subscribe to the `checkout.session.completed` event, and copy the signing secret it gives you into `STRIPE_WEBHOOK_SECRET`.
6. Set `PUBLIC_APP_URL` in `backend/.env` to wherever your frontend is reachable (`http://localhost:5173` locally, your real domain in production). This is where tenants land after paying.
7. Restart the backend after editing `.env`.

To test a payment without a real card, use one of [Stripe's test card numbers](https://stripe.com/docs/testing) — e.g. `4242 4242 4242 4242`, any future expiry date, any CVC.

When you're ready to accept real payments, finish Stripe's account activation (business details, bank account for payouts) and switch to your **Live mode** API keys and webhook — everything else works the same.

## 9. Zelle payments

Zelle doesn't offer a public API that third-party apps like this one can use to send, request, or verify payments automatically — everything happens inside your bank's own app or website. To support Zelle anyway, this app treats it as a manual payment method:

1. Go to **Payments** and save your Zelle email or phone number in the "Your Zelle email or phone" box at the top. This is just stored as a reminder for you.
2. When a tenant tells you they've sent rent via Zelle (or any other off-app method), click **Mark paid manually** on that payment and select **Zelle** (or Cash, Check, etc.) from the dropdown.
3. If you generate a Stripe payment link for a tenant who'd rather use Zelle, the link modal will remind you of your saved Zelle contact so you can share it with them directly.

## 10. Set up email notifications (optional)

In-app notifications (the bell icon) always work with no setup. Email notifications are optional and currently fire for three events — a new maintenance request, a payment being marked paid (by Stripe, or manually), and a lease entering its last 30 days — using [Resend](https://resend.com):

1. Create a free account at [resend.com](https://resend.com).
2. Go to **API Keys** and create a key (starts with `re_...`).
3. Paste it into `backend/.env` as `RESEND_API_KEY`.
4. By default emails send from `onboarding@resend.dev` (Resend's shared test address, no domain setup required). To send from your own address, [verify a domain in Resend](https://resend.com/domains) and set `EMAIL_FROM` in `backend/.env`, e.g. `EMAIL_FROM=IronGate Housing <notifications@yourdomain.com>`.
5. Restart the backend after editing `.env`.

If `RESEND_API_KEY` isn't set, email sending is skipped silently (logged to the backend console) and the rest of the app — including in-app notifications — keeps working normally.

## Production build

```bash
cd frontend
npm run build
```

This outputs static files to `frontend/dist`. The backend (`server.js`) is already configured to serve that folder automatically, so in production you only need to run the backend:

```bash
cd backend
NODE_ENV=production npm start
```

and visit `http://localhost:4000`.

## Notes

- Auth uses JWT (7-day expiry) with bcrypt-hashed passwords. Set a strong, unique `JWT_SECRET` in `backend/.env` before any real use.
- The SQLite database is a single file (`backend/data.db`) — back it up periodically if you rely on this for real data.
- This was built as a solid starting point, not a finished commercial product: there's no multi-user roles per property (e.g. a property manager acting on a landlord's behalf). That's a natural next addition.
- Password reset links expire after 1 hour and are single-use; requesting a new one invalidates any earlier unused link for that account.
- The lease renewal check runs in-process (a startup check plus a daily timer) rather than a system cron job, so it only runs while the backend process itself is running.
- Tenant accounts are strictly read/limited-write on their own data — they can view their lease, pay rent, submit maintenance requests, and download shared documents, but can't see or edit any landlord management data (properties, other tenants, etc.), enforced on the backend.
- Stripe is optional — if `STRIPE_SECRET_KEY` isn't set, the rest of the app works fine; only "Send payment link" will show an error until you configure it.
- Email notifications are optional — if `RESEND_API_KEY` isn't set, emails are simply skipped; in-app notifications (the bell icon) work either way.
- Zelle is supported as a manual payment method with a saved contact reminder, not a live integration — no third-party app can send, request, or confirm Zelle payments automatically.
- Only card payments are enabled by default. Stripe Checkout also supports ACH bank transfers and other methods, which you can turn on from the Stripe Dashboard under Checkout settings (may require additional verification).
