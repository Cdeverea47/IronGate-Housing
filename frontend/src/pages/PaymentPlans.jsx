import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Badge, EmptyState } from '../components/UI.jsx';

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
        <p className="text-white/60 text-sm mt-1">Review payment plan requests from your tenants</p>
      </div>

      {error ? <p className="text-rose-200 text-sm">{error}</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState message="No payment plan requests yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">
                  {r.first_name} {r.last_name}
                </div>
                <div className="text-sm text-white/60 truncate">
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
