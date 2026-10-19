import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, ErrorText } from './UI.jsx';

// Landlord: connect the bank account rent is paid out to. Stripe's hosted
// onboarding collects the identity + bank details — none of it touches us.
export function GetPaidCard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    api
      .get('/connect/status')
      .then(setStatus)
      .catch((err) => {
        setStatus({ connected: false, unavailable: true });
        setError(err.message);
      });
  }

  useEffect(refresh, []);

  async function go(path, method = 'post') {
    setError(null);
    setBusy(true);
    try {
      const { url } = method === 'get' ? await api.get(path) : await api.post(path);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const ready = status?.charges_enabled;
  const started = status?.connected && !ready;

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white/90">Get paid — connect your bank</h3>
          <p className="text-xs text-white/50 mt-1">
            Tenants pay rent online and it's deposited straight to your bank account. Your bank details are entered on
            Stripe's secure page — we never see or store them.
          </p>
        </div>
        {status ? (
          <span
            className={`text-xs font-medium shrink-0 ${
              ready ? 'text-emerald-300' : started ? 'text-amber-300' : 'text-white/50'
            }`}
          >
            {ready ? 'Ready' : started ? 'Setup incomplete' : 'Not connected'}
          </span>
        ) : null}
      </div>

      {ready && status.bank ? (
        <p className="text-sm text-white/80">
          Payouts go to <strong>{status.bank.bank_name || 'your bank'}</strong>
          {status.bank.last4 ? ` •••• ${status.bank.last4}` : ''}.
        </p>
      ) : null}
      {started ? (
        <p className="text-sm text-amber-200/90">
          Stripe still needs a bit more information before you can accept rent. Continue setup to finish.
        </p>
      ) : null}

      <ErrorText>{error}</ErrorText>
      {status ? (
        <div className="flex flex-wrap gap-2">
          {ready ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => go('/connect/dashboard-link', 'get')}>
              Manage payouts & bank
            </Button>
          ) : (
            <Button type="button" disabled={busy || status.unavailable} onClick={() => go('/connect/onboard')}>
              {busy ? 'Opening Stripe…' : started ? 'Continue setup' : 'Connect bank account'}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-white/50">Checking…</p>
      )}
    </Card>
  );
}

// Tenant: cards / bank accounts saved for paying rent. Entered on Stripe's
// hosted page; we only ever see the label (e.g. "Visa •••• 4242").
export function PaymentMethodsCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    api
      .get('/portal/payment-methods')
      .then(setData)
      .catch((err) => {
        setData({ landlords: [], waiting_on_landlord: [] });
        setError(err.message);
      });
  }

  useEffect(refresh, []);

  async function addMethod(accountId) {
    setError(null);
    setBusy(true);
    try {
      const { url } = await api.post('/portal/payment-methods/setup', { account_id: accountId });
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function removeMethod(accountId, methodId) {
    setError(null);
    try {
      await api.del(`/portal/payment-methods/${encodeURIComponent(methodId)}?account_id=${encodeURIComponent(accountId)}`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-white/90">Payment methods for rent</h3>
        <p className="text-xs text-white/50 mt-1">
          Save a card or bank account to pay rent faster. Details are entered on Stripe's secure page — we never see or
          store them.
        </p>
      </div>

      {!data ? <p className="text-sm text-white/50">Loading…</p> : null}

      {data?.landlords.map((l) => (
        <div key={l.account_id} className="space-y-2">
          <p className="text-xs font-medium text-white/60 uppercase tracking-wide">Rent to {l.landlord_name}</p>
          {l.methods.length === 0 ? (
            <p className="text-sm text-white/50">Nothing saved yet.</p>
          ) : (
            l.methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-white/90">
                  {m.label} <span className="text-white/50">· {m.detail}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeMethod(l.account_id, m.id)}
                  className="text-xs text-rose-300 hover:text-rose-200"
                >
                  Remove
                </button>
              </div>
            ))
          )}
          <Button type="button" variant="secondary" disabled={busy} onClick={() => addMethod(l.account_id)}>
            {busy ? 'Opening Stripe…' : 'Add card or bank account'}
          </Button>
        </div>
      ))}

      {data && data.landlords.length === 0 && data.waiting_on_landlord.length > 0 ? (
        <p className="text-sm text-amber-200/90">
          {data.waiting_on_landlord.join(', ')} hasn't connected a bank account for online rent yet. Once they do,
          you'll be able to add a payment method here — until then, pay another way (e.g. Zelle).
        </p>
      ) : null}
      {data && data.landlords.length === 0 && data.waiting_on_landlord.length === 0 && !error ? (
        <p className="text-sm text-white/50">Payment methods appear here once you're linked to a lease.</p>
      ) : null}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
