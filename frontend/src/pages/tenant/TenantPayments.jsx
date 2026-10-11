import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Button, Modal, Badge, EmptyState } from '../../components/UI.jsx';

const methodLabels = {
  cash: 'Cash',
  check: 'Check',
  zelle: 'Zelle',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};

function statusTone(status, dueDate) {
  if (status === 'paid') return 'green';
  if (status === 'pending' && dueDate < new Date().toISOString().slice(0, 10)) return 'red';
  return 'amber';
}

export default function TenantPayments() {
  const [payments, setPayments] = useState([]);
  const [zelleContact, setZelleContact] = useState('');
  const [loading, setLoading] = useState(true);
  const [linkModal, setLinkModal] = useState({ open: false, url: '', copied: false });
  const [linkError, setLinkError] = useState(null);
  const [linkLoadingId, setLinkLoadingId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/portal/payments'), api.get('/portal/overview')])
      .then(([p, overview]) => {
        setPayments(p);
        const withZelle = (overview.leases || []).find((l) => l.zelle_contact);
        setZelleContact(withZelle ? withZelle.zelle_contact : '');
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function requestPaymentLink(payment) {
    setLinkError(null);
    setLinkLoadingId(payment.id);
    try {
      const { url } = await api.post(`/portal/payments/${payment.id}/checkout`);
      setLinkModal({ open: true, url, copied: false });
    } catch (err) {
      setLinkError(err.message);
      setLinkModal({ open: true, url: '', copied: false });
    } finally {
      setLinkLoadingId(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkModal.url);
      setLinkModal((m) => ({ ...m, copied: true }));
    } catch {
      // Clipboard API can fail without HTTPS/permissions — the link is still selectable text.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payments</h1>
        <p className="text-white/60 text-sm mt-1">Your rent history and balance</p>
      </div>

      {zelleContact ? (
        <Card className="p-4">
          <p className="text-sm text-white/80">
            Prefer Zelle? Send rent to <span className="font-medium text-white">{zelleContact}</span> and let your
            landlord know once it's sent.
          </p>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : payments.length === 0 ? (
        <EmptyState message="No payments recorded yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {payments.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-white">
                  {p.property_name} · Unit {p.unit_number}
                </div>
                <div className="text-sm text-white/60">
                  ${p.amount} due {p.due_date}
                  {p.paid_date ? ` · paid ${p.paid_date}${p.method ? ` via ${methodLabels[p.method] || p.method}` : ''}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone(p.status, p.due_date)}>{p.status}</Badge>
                {p.status !== 'paid' ? (
                  <Button variant="secondary" onClick={() => requestPaymentLink(p)} disabled={linkLoadingId === p.id}>
                    {linkLoadingId === p.id ? 'Creating link…' : 'Pay now'}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={linkModal.open} onClose={() => setLinkModal({ open: false, url: '', copied: false })} title="Pay rent">
        {linkError ? (
          <p className="text-sm text-rose-200">{linkError}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              This opens a secure, Stripe-hosted payment page — your card details never pass through this app.
            </p>
            <div className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white break-all">
              {linkModal.url}
            </div>
            <div className="flex gap-2">
              <Button onClick={copyLink} className="flex-1">
                {linkModal.copied ? 'Copied ✓' : 'Copy link'}
              </Button>
              <Button variant="secondary" onClick={() => window.open(linkModal.url, '_blank')}>
                Open
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
