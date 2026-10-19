import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';
import { monthsLeftInfo } from '../leaseUtils.js';
import { unitName } from '../unitName.js';

const emptyForm = { unit_id: '', tenant_id: '', start_date: '', end_date: '', rent_amount: '', deposit_amount: '', status: 'active' };

export default function Leases() {
  const [leases, setLeases] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [editLease, setEditLease] = useState({ open: false, lease: null });
  const [editForm, setEditForm] = useState({ end_date: '', rent_amount: '', status: 'active' });
  const [editError, setEditError] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

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
      const lease = await api.post('/leases', form);
      setModalOpen(false);
      setForm(emptyForm);
      setCreated(lease.charges_created > 0 ? lease.charges_created : null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEdit(lease) {
    setEditForm({ end_date: lease.end_date || '', rent_amount: lease.rent_amount, status: lease.status });
    setEditError(null);
    setEditResult(null);
    setEditLease({ open: true, lease });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await api.put(`/leases/${editLease.lease.id}`, {
        end_date: editForm.end_date || null,
        rent_amount: editForm.rent_amount,
        status: editForm.status,
      });
      setEditResult(res.charges_created || 0);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(l) {
    const msg =
      `Delete the lease for ${l.first_name} ${l.last_name} (${l.property_name} ${unitName(l.unit_number)})?\n\n` +
      `All of its rent payments and history will be deleted too` +
      (l.status === 'active' ? ', and the unit will become unoccupied' : '') +
      `. This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      await api.del(`/leases/${l.id}`);
      setCreated(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-rose-200">{error}</p> : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leases</h1>
          <p className="text-white/60 text-sm mt-1">Track lease terms across units</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={units.length === 0 || tenants.length === 0}>
          + Add lease
        </Button>
      </div>

      {created ? (
        <p className="text-sm text-emerald-300">
          Lease saved — {created} upcoming rent payment{created === 1 ? '' : 's'} scheduled through the end date. Tenants
          can see and pay them under Payments.
        </p>
      ) : null}

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
                    {l.first_name} {l.last_name} · {l.property_name} {unitName(l.unit_number)}
                  </div>
                  <div className="text-sm text-white/60">
                    {l.start_date} — {l.end_date || 'ongoing'} · ${l.rent_amount}/mo
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {l.status === 'active' ? <Badge tone={monthsLeft.tone}>{monthsLeft.label}</Badge> : null}
                  <Badge tone={l.status === 'active' ? 'green' : 'slate'}>{l.status}</Badge>
                  <button type="button" onClick={() => openEdit(l)} className="text-sm text-white/80 hover:text-white underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(l)} className="text-sm text-rose-300 hover:text-rose-200">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal
        open={editLease.open}
        onClose={() => setEditLease({ open: false, lease: null })}
        title={editLease.lease ? `Edit lease — ${editLease.lease.first_name} ${editLease.lease.last_name}` : 'Edit lease'}
      >
        <form onSubmit={handleEditSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>End date</Label>
              <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
            </div>
            <div>
              <Label>Monthly rent ($)</Label>
              <Input type="number" step="0.01" min="0" value={editForm.rent_amount} onChange={(e) => setEditForm({ ...editForm, rent_amount: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
              <option value="terminated">Terminated</option>
            </Select>
          </div>
          <p className="text-xs text-white/50">
            Setting or changing the end date reschedules every upcoming unpaid rent charge through the new end date.
            Ending the lease removes the upcoming unpaid charges.
          </p>
          <ErrorText>{editError}</ErrorText>
          {editResult !== null ? (
            <p className="text-sm text-emerald-300">
              Saved{editResult > 0 ? ` — ${editResult} upcoming rent payment${editResult === 1 ? '' : 's'} scheduled.` : '.'}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save lease'}
          </Button>
        </form>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add lease">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Unit</Label>
            <Select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
              <option value="">Select a unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{unitName(u.unit_number)}</option>
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
          <p className="text-xs text-white/50 -mt-1">
            Set an end date and every month's rent through then is scheduled automatically — tenants see it under
            Upcoming and can pay any time.
          </p>
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
