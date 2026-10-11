import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, ErrorText, EmptyState } from '../components/UI.jsx';

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', notes: '' };

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    api.get('/tenants').then(setTenants).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/tenants', form);
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
          <h1 className="text-2xl font-semibold text-white">Tenants</h1>
          <p className="text-white/60 text-sm mt-1">Everyone renting from you</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Add tenant</Button>
      </div>

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : tenants.length === 0 ? (
        <EmptyState message="No tenants yet." action={<Button className="mt-4" onClick={() => setModalOpen(true)}>Add your first tenant</Button>} />
      ) : (
        <Card className="divide-y divide-white/10">
          {tenants.map((t) => (
            <Link key={t.id} to={`/tenants/${t.id}`} className="p-4 flex items-center justify-between hover:bg-white/5 block">
              <div>
                <div className="font-medium text-white">{t.first_name} {t.last_name}</div>
                <div className="text-sm text-white/60">{t.email || '—'} {t.phone ? `· ${t.phone}` : ''}</div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add tenant">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Save tenant</Button>
        </form>
      </Modal>
    </div>
  );
}
