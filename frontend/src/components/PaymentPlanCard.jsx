import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Input, Textarea, Label, Select, ErrorText } from './UI.jsx';

const INSTALLMENT_PLANS = [
  { value: 'full', label: 'Pay in full each month' },
  { value: 'split2', label: 'Split into 2 payments' },
  { value: 'split4', label: 'Split into 4 payments' },
];

function planLabel(value) {
  return INSTALLMENT_PLANS.find((p) => p.value === value)?.label || value;
}

// Tenant: see the current payment plan and ask the landlord for a different
// one (temporary or permanent). A request doesn't change anything until the
// landlord approves it.
export default function PaymentPlanCard() {
  const [overview, setOverview] = useState(null);
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('split2');
  const [duration, setDuration] = useState('temporary');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  function load() {
    Promise.all([api.get('/portal/overview'), api.get('/portal/payment-plan-requests')])
      .then(([o, r]) => {
        setOverview(o);
        setRequests(r);
      })
      .catch(() => {});
  }

  useEffect(load, []);

  const lease = overview?.leases?.[0];
  const hasPending = requests.some((r) => r.status === 'pending');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!lease) {
      setError('No lease found on your account yet');
      return;
    }
    setSaving(true);
    try {
      const row = await api.post('/portal/payment-plan-requests', {
        tenant_id: lease.tenant_id,
        installment_plan: plan,
        duration,
        temporary_end_date: duration === 'temporary' ? endDate || null : null,
        note: note || null,
      });
      setRequests((prev) => [row, ...prev]);
      setNote('');
      setOpen(false);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-white/90">Payment plan</h3>
          {lease?.active_installment_plan ? (
            <p className="text-sm text-white/70 mt-1">
              Current plan: <strong>{planLabel(lease.active_installment_plan)}</strong>
              {lease.active_installment_plan_until ? ` until ${lease.active_installment_plan_until}` : ' (permanent)'}
            </p>
          ) : (
            <p className="text-sm text-white/50 mt-1">No special plan on file — you're on the standard full payment.</p>
          )}
        </div>
        {!open ? (
          <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={!lease || hasPending}>
            {hasPending ? 'Request pending' : 'Request a payment plan'}
          </Button>
        ) : null}
      </div>

      {sent ? <p className="text-sm text-emerald-300">Request sent — your landlord will review it.</p> : null}

      {open ? (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-white/10">
          <p className="text-xs text-white/50">
            Your request goes to your landlord for approval — it won't take effect until they approve it.
          </p>
          <div>
            <Label>Requested plan</Label>
            <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
              {INSTALLMENT_PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Duration</Label>
            <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="temporary">Temporary</option>
              <option value="permanent">Permanent</option>
            </Select>
          </div>
          {duration === 'temporary' ? (
            <div>
              <Label>Until</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          ) : null}
          <div>
            <Label>Note to landlord (optional)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Sending…' : 'Send request'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {requests.length > 0 ? (
        <div className="pt-3 border-t border-white/10 space-y-2">
          <h4 className="text-xs font-medium text-white/60 uppercase tracking-wide">History</h4>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-white/80">
                {r.initiated_by === 'landlord' ? 'Set by your landlord · ' : ''}
                {planLabel(r.installment_plan)} · {r.duration}
              </span>
              <span
                className={`text-xs font-medium ${
                  r.status === 'approved' ? 'text-emerald-300' : r.status === 'denied' ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
