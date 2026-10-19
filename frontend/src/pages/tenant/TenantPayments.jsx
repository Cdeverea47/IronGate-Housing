import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Button, Modal, Badge, EmptyState } from '../../components/UI.jsx';
import { PaymentMethodsCard } from '../../components/PaymentSetupCards.jsx';
import PaymentPlanCard from '../../components/PaymentPlanCard.jsx';
import { unitName } from '../../unitName.js';

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

const todayStr = () => new Date().toISOString().slice(0, 10);

function dueLabel(dueDate) {
  const days = Math.round((new Date(`${dueDate}T00:00:00Z`) - new Date(`${todayStr()}T00:00:00Z`)) / 86400000);
  if (days === 0) return 'due today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
}

function PaymentGroup({ title, subtitle, tone, rows, onPay, loadingId }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-white/80">{title}</h2>
        {subtitle ? <span className="text-xs text-white/50">{subtitle}</span> : null}
      </div>
      <Card className="divide-y divide-white/10">
        {rows.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-white truncate">
                {p.notes ? `${p.notes} · ` : ''}
                {p.property_name} · {unitName(p.unit_number)}
              </div>
              <div className="text-sm text-white/60">
                ${Number(p.amount).toFixed(2)} due {p.due_date}
                {Number(p.amount_paid) > 0 && p.status !== 'paid'
                  ? ` · $${Number(p.amount_paid).toFixed(2)} paid, $${(Number(p.amount) - Number(p.amount_paid)).toFixed(2)} left`
                  : ''}
                {p.status !== 'paid' ? ` · ${dueLabel(p.due_date)}` : ''}
                {p.paid_date ? ` · paid ${p.paid_date}${p.method ? ` via ${methodLabels[p.method] || p.method}` : ''}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge tone={tone || statusTone(p.status, p.due_date)}>{p.status === 'pending' && !tone ? 'upcoming' : p.status}</Badge>
              {p.status !== 'paid' ? (
                <Button variant="secondary" onClick={() => onPay(p)} disabled={loadingId === p.id}>
                  {loadingId === p.id ? 'Creating link…' : 'Pay now'}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
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

  const today = todayStr();
  const unpaid = payments.filter((p) => p.status !== 'paid');
  const overdue = unpaid.filter((p) => p.due_date < today).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const upcoming = unpaid.filter((p) => p.due_date >= today).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const paid = payments.filter((p) => p.status === 'paid').sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
  const overdueTotal = overdue.reduce((sum, p) => sum + Number(p.amount), 0);
  const upcomingTotal = upcoming.reduce((sum, p) => sum + Number(p.amount), 0);
  const nextUp = overdue[0] || upcoming[0];
  const groupProps = { onPay: requestPaymentLink, loadingId: linkLoadingId };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payments</h1>
        <p className="text-white/60 text-sm mt-1">What's due, what's coming up, and your payment history</p>
      </div>

      <PaymentMethodsCard />

      <PaymentPlanCard />

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
        <>
          {nextUp ? (
            <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/50">{overdue.length > 0 ? 'Amount past due' : 'Next payment'}</p>
                <p className="text-2xl font-semibold text-white">
                  ${(overdue.length > 0 ? overdueTotal : Number(nextUp.amount)).toFixed(2)}
                </p>
                <p className="text-sm text-white/60">
                  {overdue.length > 0
                    ? `${overdue.length} overdue payment${overdue.length > 1 ? 's' : ''}`
                    : `${nextUp.notes ? `${nextUp.notes} · ` : ''}due ${nextUp.due_date} (${dueLabel(nextUp.due_date)})`}
                </p>
              </div>
              <p className="text-xs text-white/50 max-w-xs">
                You can pay any upcoming payment early — no need to wait for the due date.
              </p>
            </Card>
          ) : null}

          <PaymentGroup title="Overdue" tone="red" rows={overdue} {...groupProps} />
          <PaymentGroup
            title="Upcoming"
            subtitle={upcoming.length > 0 ? `${upcoming.length} scheduled · $${upcomingTotal.toFixed(2)} total` : null}
            rows={upcoming}
            {...groupProps}
          />
          <PaymentGroup title="Paid" rows={paid} {...groupProps} />
        </>
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
