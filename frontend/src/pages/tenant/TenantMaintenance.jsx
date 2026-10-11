import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../../components/UI.jsx';

const emptyForm = { unit_id: '', title: '', description: '', priority: 'normal' };

export default function TenantMaintenance() {
  const [requests, setRequests] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/portal/maintenance'), api.get('/portal/overview')])
      .then(([r, overview]) => {
        setRequests(r);
        const activeLeases = (overview.leases || []).filter((l) => l.status === 'active');
        const source = activeLeases.length > 0 ? activeLeases : overview.leases || [];
        setUnits(source.map((l) => ({ id: l.unit_id, unit_number: l.unit_number, property_name: l.property_name })));
        setForm((f) => ({ ...f, unit_id: source[0]?.unit_id || '' }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/portal/maintenance', form);
      setModalOpen(false);
      setForm((f) => ({ ...emptyForm, unit_id: f.unit_id }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Maintenance</h1>
          <p className="text-white/60 text-sm mt-1">Report an issue or check on a request</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={units.length === 0}>+ New request</Button>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-amber-200">No unit is linked to your account yet, so requests can't be submitted.</p>
      ) : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState message="No maintenance requests yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{r.title}</div>
                <div className="text-sm text-white/60">
                  {r.property_name} · Unit {r.unit_number}
                  {r.description ? ` — ${r.description}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={r.priority === 'high' ? 'red' : r.priority === 'low' ? 'slate' : 'amber'}>{r.priority}</Badge>
                <Badge tone={r.status === 'resolved' ? 'green' : r.status === 'in_progress' ? 'blue' : 'slate'}>
                  {r.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New maintenance request">
        <form onSubmit={handleSubmit} className="space-y-3">
          {units.length > 1 ? (
            <div>
              <Label>Unit</Label>
              <Select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.property_name} · Unit {u.unit_number}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Submit request</Button>
        </form>
      </Modal>
    </div>
  );
}
