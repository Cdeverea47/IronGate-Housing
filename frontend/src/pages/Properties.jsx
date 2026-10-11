import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, ErrorText, EmptyState } from '../components/UI.jsx';
import { PROPERTY_TYPES, propertyTypeLabel } from '../propertyTypes.js';

const emptyForm = {
  name: '',
  property_type: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
};

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    api
      .get('/properties')
      .then(setProperties)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/properties', form);
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
          <h1 className="text-2xl font-semibold text-white">Properties</h1>
          <p className="text-white/60 text-sm mt-1">Manage your rental properties</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Add property</Button>
      </div>

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : properties.length === 0 ? (
        <EmptyState message="No properties yet." action={<Button className="mt-4" onClick={() => setModalOpen(true)}>Add your first property</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`}>
              <Card className="p-4 h-full hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-white">{p.name}</div>
                  {propertyTypeLabel(p.property_type) ? (
                    <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/80">
                      {propertyTypeLabel(p.property_type)}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-white/60 mt-1">
                  {p.address_line1}
                  {p.city ? `, ${p.city}` : ''} {p.state || ''} {p.zip || ''}
                </div>
                <div className="text-xs text-white/40 mt-3">{p.unit_count} unit{p.unit_count === 1 ? '' : 's'}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add property">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Property type</Label>
            <Select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>
              <option value="">Select a type (optional)</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Address line 1</Label>
            <Input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} required />
          </div>
          <div>
            <Label>Address line 2</Label>
            <Input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <Label>Zip</Label>
              <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Save property</Button>
        </form>
      </Modal>
    </div>
  );
}
