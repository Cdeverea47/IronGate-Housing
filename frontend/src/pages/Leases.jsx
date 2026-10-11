import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';
import { monthsLeftInfo } from '../leaseUtils.js';

const emptyForm = { unit_id: '', tenant_id: '', start_date: '', end_date: '', rent_amount: '', deposit_amount: '', status: 'active' };

export default function Leases() {
  const [leases, setLeases] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/leases'), api.get('/units'), api.get('/tenants')])
      .then(([l, u, t]) => {
        setLeases(l);
        setUnits(u);
        setTenants(t);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/leases', form);
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leases</h1>
          <p className="text-white/60 text-sm mt-1">Track lease terms across units</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={units.length === 0 || tenants.length === 0}>
          + Add lease
        </Button>
      </div>

      {units.length === 0 || tenants.length === 0 ? (
        <p className="text-sm text-amber-200">Add at least one unit and one tenant before creating a lease.</p>
      ) : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : leases.length === 0 ? (
        <EmptyState message="No leases yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {leases.map((l) => {
            const monthsLeft = monthsLeftInfo(l.end_date);
            return (
              <div key={l.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">
                    {l.first_name} {l.last_name} · {l.property_name} Unit {l.unit_number}
                  </div>
                  <div className="text-sm text-white/60">
                    {l.start_date} — {l.end_date || 'ongoing'} · ${l.rent_amount}/mo
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {l.status === 'active' ? <Badge tone={monthsLeft.tone}>{monthsLeft.label}</Badge> : null}
                  <Badge tone={l.status === 'active' ? 'green' : 'slate'}>{l.status}</Badge>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add lease">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Unit</Label>
            <Select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
              <option value="">Select a unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Tenant</Label>
            <Select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} required>
              <option value="">Select a tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monthly rent ($)</Label>
              <Input type="number" step="0.01" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} required />
            </div>
            <div>
              <Label>Deposit ($)</Label>
              <Input type="number" step="0.01" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} />
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Save lease</Button>
        </form>
      </Modal>
    </div>
  );
}
