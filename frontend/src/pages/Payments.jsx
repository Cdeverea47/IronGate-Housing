import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';
import { GetPaidCard } from '../components/PaymentSetupCards.jsx';
import { unitName } from '../unitName.js';

const emptySchedule = { lease_id: '', label: '', amount: '', first_due_date: '', repeat: 'once', count: '3' };
const emptyForm = { lease_id: '', amount: '', due_date: '', paid_date: '', method: 'bank_transfer', status: 'pending', notes: '' };

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

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState(emptySchedule);
  const [scheduleError, setScheduleError] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [linkModal, setLinkModal] = useState({ open: false, url: '', copied: false });
  const [linkError, setLinkError] = useState(null);
  const [linkLoadingId, setLinkLoadingId] = useState(null);
  const [markPaidModal, setMarkPaidModal] = useState({ open: false, payment: null, method: 'cash', amount: '', date: '' });
  const [zelleContact, setZelleContact] = useState('');
  const [zelleSaving, setZelleSaving] = useState(false);
  const [zelleSaved, setZelleSaved] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/payments'), api.get('/leases'), api.get('/auth/me')])
      .then(([p, l, me]) => {
        setPayments(p);
        setLeases(l);
        setZelleContact(me.zelle_contact || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Taking a card: the card number is typed on Stripe's own secure page, never
  // into this app, so it's never sent to or stored on our server.
  const takeCardNow = form.method === 'card' && form.status !== 'paid';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post('/payments', form);
      if (takeCardNow) {
        try {
          const { url } = await api.post(`/payments/${created.id}/checkout`);
          window.location.href = url;
          return;
        } catch (err) {
          // The payment is saved either way; just couldn't open the card page.
          setError(`Payment saved, but the secure card page couldn't open: ${err.message}`);
          load();
          return;
        }
      }
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSchedule(e) {
    e.preventDefault();
    setScheduleError(null);
    setScheduling(true);
    try {
      await api.post('/payments/schedule', schedule);
      setScheduleOpen(false);
      setSchedule(emptySchedule);
      load();
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduling(false);
    }
  }

  async function removePayment(p) {
    if (!confirm(`Remove the $${p.amount} payment due ${p.due_date}?`)) return;
    await api.del(`/payments/${p.id}`);
    load();
  }

  async function confirmMarkPaid(e) {
    e.preventDefault();
    const { payment, method, amount, date } = markPaidModal;
    const received = Number(amount);
    if (!(received > 0)) return;
    const already = Number(payment.amount_paid || 0);
    try {
      await api.put(`/payments/${payment.id}`, {
        amount_paid: Math.min(Number(payment.amount), already + received),
        paid_date: date || new Date().toISOString().slice(0, 10),
        method,
      });
    } catch (err) {
      alert(err.message);
    }
    setMarkPaidModal({ open: false, payment: null, method: 'cash', amount: '', date: '' });
    load();
  }

  function openRecordPayment(p) {
    const remaining = Number(p.amount) - Number(p.amount_paid || 0);
    setMarkPaidModal({
      open: true,
      payment: p,
      method: 'cash',
      amount: remaining.toFixed(2),
      date: new Date().toISOString().slice(0, 10),
    });
  }

  // Undo a payment that was marked by mistake (wrong month / wrong amount).
  async function unpay(p) {
    const paid = Number(p.amount_paid || 0);
    if (!confirm(`Undo the $${paid.toFixed(2)} recorded for the payment due ${p.due_date}? It goes back to unpaid.`)) return;
    try {
      await api.post(`/payments/${p.id}/unpay`, {});
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveZelleContact(e) {
    e.preventDefault();
    setZelleSaving(true);
    setZelleSaved(false);
    try {
      await api.patch('/auth/me', { zelle_contact: zelleContact });
      setZelleSaved(true);
      setTimeout(() => setZelleSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setZelleSaving(false);
    }
  }

  async function requestPaymentLink(payment) {
    setLinkError(null);
    setLinkLoadingId(payment.id);
    try {
      const { url } = await api.post(`/payments/${payment.id}/checkout`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Payments</h1>
          <p className="text-white/60 text-sm mt-1">Rent due and rent received</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setScheduleOpen(true)} disabled={leases.length === 0}>
            Schedule future payments
          </Button>
          <Button onClick={() => setModalOpen(true)} disabled={leases.length === 0}>+ Add payment</Button>
        </div>
      </div>

      <GetPaidCard />

      <Card className="p-4">
        <form onSubmit={saveZelleContact} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Your Zelle email or phone (optional)</Label>
            <Input
              value={zelleContact}
              onChange={(e) => setZelleContact(e.target.value)}
              placeholder="you@example.com or (555) 123-4567"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={zelleSaving}>
            {zelleSaved ? 'Saved ✓' : zelleSaving ? 'Saving…' : 'Save'}
          </Button>
        </form>
        <p className="text-xs text-white/50 mt-2">
          Shown to you as a reminder of what to give tenants who want to pay rent via Zelle — banks don't allow
          apps like this one to send or request Zelle payments directly.
        </p>
      </Card>

      {leases.length === 0 ? <p className="text-sm text-amber-200">Create a lease before recording payments.</p> : null}

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
                  {p.first_name} {p.last_name} · {p.property_name} {unitName(p.unit_number)}
                </div>
                <div className="text-sm text-white/60">
                  {p.notes ? `${p.notes} · ` : ''}${p.amount} due {p.due_date}
                  {Number(p.amount_paid) > 0 && p.status !== 'paid'
                    ? ` · $${Number(p.amount_paid).toFixed(2)} paid, $${(Number(p.amount) - Number(p.amount_paid)).toFixed(2)} left`
                    : ''}
                  {p.status !== 'paid' && p.due_date > new Date().toISOString().slice(0, 10) ? ' · upcoming' : ''}
                  {p.paid_date ? ` · paid ${p.paid_date}${p.method ? ` via ${methodLabels[p.method] || p.method}` : ''}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={Number(p.amount_paid) > 0 && p.status !== 'paid' ? 'amber' : statusTone(p.status, p.due_date)}>
                  {Number(p.amount_paid) > 0 && p.status !== 'paid' ? 'partial' : p.status}
                </Badge>
                {Number(p.amount_paid) > 0 ? (
                  <button type="button" onClick={() => unpay(p)} className="text-xs text-amber-200 hover:text-amber-100 underline">
                    Unpay
                  </button>
                ) : null}
                {p.status !== 'paid' && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => requestPaymentLink(p)}
                      disabled={linkLoadingId === p.id}
                    >
                      {linkLoadingId === p.id ? 'Creating link…' : 'Send payment link'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => openRecordPayment(p)}
                    >
                      Record payment
                    </Button>
                    <button
                      type="button"
                      onClick={() => removePayment(p)}
                      className="text-xs text-rose-300 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule future payments">
        <form onSubmit={handleSchedule} className="space-y-3">
          <p className="text-xs text-white/60">
            Tenants see these under "Upcoming" right away and can pay any of them at any time — before or on the due
            date.
          </p>
          <div>
            <Label>Lease</Label>
            <Select value={schedule.lease_id} onChange={(e) => setSchedule({ ...schedule, lease_id: e.target.value })} required>
              <option value="">Select a lease</option>
              {leases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.first_name} {l.last_name} · {l.property_name} {unitName(l.unit_number)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>What's it for? (optional)</Label>
            <Input value={schedule.label} onChange={(e) => setSchedule({ ...schedule, label: e.target.value })} placeholder="e.g. Rent, Pet fee, Utilities" maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" min="0" value={schedule.amount} onChange={(e) => setSchedule({ ...schedule, amount: e.target.value })} required />
            </div>
            <div>
              <Label>First due date</Label>
              <Input type="date" min={new Date().toISOString().slice(0, 10)} value={schedule.first_due_date} onChange={(e) => setSchedule({ ...schedule, first_due_date: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Repeat</Label>
              <Select value={schedule.repeat} onChange={(e) => setSchedule({ ...schedule, repeat: e.target.value })}>
                <option value="once">Just once</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </Select>
            </div>
            {schedule.repeat !== 'once' ? (
              <div>
                <Label>How many payments</Label>
                <Input type="number" min="1" max="24" value={schedule.count} onChange={(e) => setSchedule({ ...schedule, count: e.target.value })} required />
              </div>
            ) : null}
          </div>
          <ErrorText>{scheduleError}</ErrorText>
          <Button type="submit" className="w-full" disabled={scheduling}>
            {scheduling ? 'Scheduling…' : 'Schedule payments'}
          </Button>
        </form>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add payment">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Lease</Label>
            <Select value={form.lease_id} onChange={(e) => setForm({ ...form, lease_id: e.target.value })} required>
              <option value="">Select a lease</option>
              {leases.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.first_name} {l.last_name} · {l.property_name} {unitName(l.unit_number)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="late">Late</option>
              </Select>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {Object.entries(methodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {value === 'card' ? 'Card (debit or credit)' : label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {form.method === 'card' ? (
            <p className="text-xs text-white/60 rounded-lg bg-white/5 px-3 py-2">
              {takeCardNow
                ? "You'll enter the debit or credit card on Stripe's secure payment page — the card number never touches this app or our servers. Requires your bank to be connected under Get paid."
                : 'Status is Paid, so this just records a card payment already taken — no card details are collected.'}
            </p>
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : takeCardNow ? 'Save & enter card securely' : 'Save payment'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={markPaidModal.open}
        onClose={() => setMarkPaidModal({ open: false, payment: null, method: 'cash', amount: '', date: '' })}
        title="Record payment"
      >
        <form onSubmit={confirmMarkPaid} className="space-y-3">
          <p className="text-sm text-white/70">
            {markPaidModal.payment
              ? `$${markPaidModal.payment.amount} due ${markPaidModal.payment.due_date}. Enter how much the tenant actually paid — a smaller amount is saved as a partial payment.`
              : ''}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount received ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={markPaidModal.amount}
                onChange={(e) => setMarkPaidModal((m) => ({ ...m, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Date received</Label>
              <Input
                type="date"
                value={markPaidModal.date}
                onChange={(e) => setMarkPaidModal((m) => ({ ...m, date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Method</Label>
            <Select
              value={markPaidModal.method}
              onChange={(e) => setMarkPaidModal((m) => ({ ...m, method: e.target.value }))}
            >
              {Object.entries(methodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Save payment
          </Button>
        </form>
      </Modal>

      <Modal
        open={linkModal.open}
        onClose={() => setLinkModal({ open: false, url: '', copied: false })}
        title="Secure payment link"
      >
        {linkError ? (
          <ErrorText>{linkError}</ErrorText>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Send this link to your tenant. It opens a secure, Stripe-hosted payment page — card details never
              pass through this app.
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
            <p className="text-xs text-white/50">
              The payment updates to "paid" automatically once your tenant completes checkout.
            </p>
            {zelleContact ? (
              <p className="text-xs text-white/50 pt-2 border-t border-white/10">
                Prefer Zelle? Tell your tenant to send rent to <span className="text-white/80">{zelleContact}</span>{' '}
                and mark it paid manually here once received.
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
