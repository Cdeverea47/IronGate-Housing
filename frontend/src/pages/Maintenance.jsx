import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';

const emptyForm = { unit_id: '', title: '', description: '', priority: 'normal', status: 'open' };

export default function Maintenance() {
  const [requests, setRequests] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/maintenance'), api.get('/units')])
      .then(([r, u]) => {
        setRequests(r);
        setUnits(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/maintenance', form);
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(req, status) {
    await api.put(`/maintenance/${req.id}`, { status });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Maintenance</h1>
          <p className="text-white/60 text-sm mt-1">Repair and service requests</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={units.length === 0}>+ New request</Button>
      </div>

      {units.length === 0 ? <p className="text-sm text-amber-200">Add a unit before logging maintenance requests.</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState message="No maintenance requests." />
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
                <Select value={r.status} onChange={(e) => updateStatus(r, e.target.value)} className="w-36">
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </Select>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New maintenance request">
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
          <Button type="submit" className="w-full">Save request</Button>
        </form>
      </Modal>
    </div>
  );
}
