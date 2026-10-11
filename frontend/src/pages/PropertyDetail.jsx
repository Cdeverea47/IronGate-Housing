import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';
import { PROPERTY_TYPES, propertyTypeLabel } from '../propertyTypes.js';

const emptyUnit = { unit_number: '', bedrooms: '', bathrooms: '', rent_amount: '', status: 'vacant' };
const emptyEditForm = {
  name: '',
  property_type: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
};

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyUnit);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState(null);

  function load() {
    api.get(`/properties/${id}`).then(setProperty).catch((err) => setError(err.message));
  }

  useEffect(load, [id]);

  async function handleAddUnit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/units', { ...form, property_id: id });
      setModalOpen(false);
      setForm(emptyUnit);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function openEditModal() {
    setEditForm({
      name: property.name || '',
      property_type: property.property_type || '',
      address_line1: property.address_line1 || '',
      address_line2: property.address_line2 || '',
      city: property.city || '',
      state: property.state || '',
      zip: property.zip || '',
      notes: property.notes || '',
    });
    setEditError(null);
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError(null);
    try {
      await api.put(`/properties/${id}`, editForm);
      setEditModalOpen(false);
      load();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleDeleteProperty() {
    if (!confirm('Delete this property and all its units? This cannot be undone.')) return;
    await api.del(`/properties/${id}`);
    navigate('/properties');
  }

  if (error) return <p className="text-rose-200">{error}</p>;
  if (!property) return <p className="text-white/60">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/properties" className="text-sm text-white/70 hover:text-white">← Back to properties</Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-semibold text-white">{property.name}</h1>
            {propertyTypeLabel(property.property_type) ? (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/80">
                {propertyTypeLabel(property.property_type)}
              </span>
            ) : null}
          </div>
          <p className="text-white/60 text-sm mt-1">
            {property.address_line1}
            {property.city ? `, ${property.city}` : ''} {property.state || ''} {property.zip || ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openEditModal}>Edit</Button>
          <Button onClick={() => setModalOpen(true)}>+ Add unit</Button>
          <Button variant="danger" onClick={handleDeleteProperty}>Delete</Button>
        </div>
      </div>

      {property.notes ? <Card className="p-4 text-sm text-white/70">{property.notes}</Card> : null}

      <div>
        <h2 className="text-lg font-medium text-white mb-3">Units</h2>
        {property.units.length === 0 ? (
          <EmptyState message="No units added yet." />
        ) : (
          <Card className="divide-y divide-white/10">
            {property.units.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Unit {u.unit_number}</div>
                  <div className="text-sm text-white/60">
                    {u.bedrooms ?? '–'} bd · {u.bathrooms ?? '–'} ba · ${u.rent_amount ?? '–'}/mo
                  </div>
                </div>
                <Badge tone={u.status === 'occupied' ? 'green' : 'slate'}>{u.status}</Badge>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add unit">
        <form onSubmit={handleAddUnit} className="space-y-3">
          <div>
            <Label>Unit number (optional)</Label>
            <Input
              value={form.unit_number}
              onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
              placeholder="e.g. 1, A, Main — leave blank to auto-number"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bedrooms</Label>
              <Input type="number" step="0.5" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Monthly rent ($)</Label>
            <Input type="number" step="0.01" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Under maintenance</option>
            </Select>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Save unit</Button>
        </form>
      </Modal>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit property">
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          </div>
          <div>
            <Label>Property type</Label>
            <Select value={editForm.property_type} onChange={(e) => setEditForm({ ...editForm, property_type: e.target.value })}>
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
            <Input value={editForm.address_line1} onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })} required />
          </div>
          <div>
            <Label>Address line 2</Label>
            <Input value={editForm.address_line2} onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
            </div>
            <div>
              <Label>Zip</Label>
              <Input value={editForm.zip} onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <ErrorText>{editError}</ErrorText>
          <Button type="submit" className="w-full">Save changes</Button>
        </form>
      </Modal>
    </div>
  );
}
