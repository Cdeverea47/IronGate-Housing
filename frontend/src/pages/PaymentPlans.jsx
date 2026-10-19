import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Badge, EmptyState, Input, Label, Select, ErrorText } from '../components/UI.jsx';

const PLAN_LABELS = {
  full: 'Pay in full each month',
  split2: 'Split into 2 payments',
  split4: 'Split into 4 payments',
};

export default function PaymentPlans() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [assign, setAssign] = useState({ tenant_id: '', installment_plan: 'split2', duration: 'temporary', temporary_end_date: '', note: '' });
  const [assignError, setAssignError] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);

  useEffect(() => {
    api.get('/tenants').then(setTenants).catch(() => {});
  }, []);

  async function handleAssign(e) {
    e.preventDefault();
    setAssignError(null);
    setAssigning(true);
    try {
      await api.post('/payment-plans/assign', {
        ...assign,
        temporary_end_date: assign.duration === 'temporary' ? assign.temporary_end_date : null,
      });
      setAssign({ ...assign, note: '' });
      setAssigned(true);
      setTimeout(() => setAssigned(false), 2500);
      load();
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  function load() {
    setLoading(true);
    api
      .get('/payment-plans')
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function decide(request, status) {
    setBusyId(request.id);
    try {
      await api.put(`/payment-plans/${request.id}`, { status });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Payment plans</h1>
        <p className="text-white/60 text-sm mt-1">Set a plan for a tenant, or review their requests</p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-medium text-white/90">Set a plan for a tenant</h2>
        <p className="text-xs text-white/50 mt-1 mb-4">
          Takes effect right away — no request from the tenant needed. They're notified by email. Choose "Pay in full"
          to remove a plan.
        </p>
        <form onSubmit={handleAssign} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Tenant</Label>
              <Select value={assign.tenant_id} onChange={(e) => setAssign({ ...assign, tenant_id: e.target.value })} required>
                <option value="">Select a tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={assign.installment_plan} onChange={(e) => setAssign({ ...assign, installment_plan: e.target.value })}>
                {Object.entries(PLAN_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={assign.duration} onChange={(e) => setAssign({ ...assign, duration: e.target.value })}>
                <option value="temporary">Temporary</option>
                <option value="permanent">Permanent</option>
              </Select>
            </div>
            {assign.duration === 'temporary' ? (
              <div>
                <Label>Until</Label>
                <Input type="date" value={assign.temporary_end_date} onChange={(e) => setAssign({ ...assign, temporary_end_date: e.target.value })} required />
              </div>
            ) : null}
          </div>
          <div>
            <Label>Note to tenant (optional)</Label>
            <Input value={assign.note} onChange={(e) => setAssign({ ...assign, note: e.target.value })} />
          </div>
          <ErrorText>{assignError}</ErrorText>
          <Button type="submit" disabled={assigning}>
            {assigning ? 'Saving…' : assigned ? 'Plan set ✓' : 'Set plan'}
          </Button>
        </form>
      </Card>

      {error ? <p className="text-rose-200 text-sm">{error}</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState message="No payment plans or requests yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">
                  {r.first_name} {r.last_name}
                </div>
                <div className="text-sm text-white/60 truncate">
                  {r.initiated_by === 'landlord' ? 'Set by you · ' : ''}
                  {PLAN_LABELS[r.installment_plan] || r.installment_plan} · {r.duration}
                  {r.duration === 'temporary' && r.temporary_end_date ? ` until ${r.temporary_end_date}` : ''}
                </div>
                {r.note ? <div className="text-sm text-white/70 mt-1 max-w-md truncate">"{r.note}"</div> : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={r.status === 'approved' ? 'green' : r.status === 'denied' ? 'red' : 'amber'}>
                  {r.status}
                </Badge>
                {r.status === 'pending' ? (
                  <>
                    <Button variant="secondary" onClick={() => decide(r, 'approved')} disabled={busyId === r.id}>
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => decide(r, 'denied')} disabled={busyId === r.id}>
                      Deny
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
