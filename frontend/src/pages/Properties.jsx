import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, ErrorText, EmptyState } from '../components/UI.jsx';
import { PROPERTY_TYPES, propertyTypeLabel } from '../propertyTypes.js';

// Suggested unit setup for each property type (the landlord can always change it).
const TYPE_SUGGESTIONS = {
  single_family: { mode: 'single' },
  townhouse: { mode: 'single' },
  condo: { mode: 'single' },
  mobile_home: { mode: 'single' },
  duplex: { mode: 'multi', count: 2 },
  triplex: { mode: 'multi', count: 3 },
  fourplex: { mode: 'multi', count: 4 },
  apartment: { mode: 'multi', count: 6 },
};

const emptyUnits = { mode: 'later', count: '2', bedrooms: '', bathrooms: '', rent_amount: '' };

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
  const [units, setUnits] = useState(emptyUnits);
  const [unitsTouched, setUnitsTouched] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      const body = { ...form };
      if (units.mode === 'single') {
        body.units = { count: 1, single: true, bedrooms: units.bedrooms, bathrooms: units.bathrooms, rent_amount: units.rent_amount };
      } else if (units.mode === 'multi' || units.mode === 'rooms') {
        body.units = {
          rooms: units.mode === 'rooms',
          count: units.count,
          bedrooms: units.bedrooms,
          bathrooms: units.bathrooms,
          rent_amount: units.rent_amount,
        };
      }
      await api.post('/properties', body);
      closeModal();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setForm(emptyForm);
    setUnits(emptyUnits);
    setUnitsTouched(false);
  }

  // Picking a property type suggests a sensible unit setup, until the landlord
  // chooses one themselves.
  function handleTypeChange(value) {
    setForm({ ...form, property_type: value });
    const suggestion = TYPE_SUGGESTIONS[value];
    if (suggestion && !unitsTouched) {
      setUnits({ ...units, mode: suggestion.mode, count: String(suggestion.count || units.count) });
    }
  }

  function chooseMode(mode) {
    setUnitsTouched(true);
    setUnits({ ...units, mode });
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

      <Modal open={modalOpen} onClose={closeModal} title="Add property">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Property type</Label>
            <Select value={form.property_type} onChange={(e) => handleTypeChange(e.target.value)}>
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
          <div className="pt-3 border-t border-white/10 space-y-3">
            <div>
              <Label>Units (optional)</Label>
              <p className="text-xs text-white/50 -mt-1">
                Add them now or later from the property page. Tenants and leases attach to a unit.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'later', label: 'Add later' },
                { value: 'single', label: 'Single family' },
                { value: 'multi', label: 'Multifamily' },
                { value: 'rooms', label: 'Rent by room' },
              ].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => chooseMode(m.value)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    units.mode === m.value
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {units.mode === 'single' ? (
              <p className="text-xs text-white/60">
                One home, no separate units — we'll set it up as a single rentable unit so you can add a tenant and
                lease right away.
              </p>
            ) : null}

            {units.mode === 'multi' || units.mode === 'rooms' ? (
              <div>
                <Label>{units.mode === 'rooms' ? 'How many rooms for rent?' : 'How many units?'}</Label>
                <Input type="number" min="1" max="100" value={units.count} onChange={(e) => setUnits({ ...units, count: e.target.value })} required />
                <p className="text-xs text-white/50 mt-1">{units.mode === 'rooms' ? 'Named Room 1, Room 2… — each room gets its own tenant, lease and rent.' : 'Numbered 1, 2, 3… — rename or edit them anytime.'}</p>
              </div>
            ) : null}

            {units.mode !== 'later' ? (
              <div className={`grid gap-3 ${units.mode === 'rooms' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                <div className={units.mode === 'rooms' ? 'hidden' : ''}>
                  <Label>Beds</Label>
                  <Input type="number" step="0.5" min="0" value={units.bedrooms} onChange={(e) => setUnits({ ...units, bedrooms: e.target.value })} />
                </div>
                <div className={units.mode === 'rooms' ? 'hidden' : ''}>
                  <Label>Baths</Label>
                  <Input type="number" step="0.5" min="0" value={units.bathrooms} onChange={(e) => setUnits({ ...units, bathrooms: e.target.value })} />
                </div>
                <div>
                  <Label>{units.mode === 'rooms' ? 'Rent per room ($/mo)' : 'Rent ($/mo)'}</Label>
                  <Input type="number" step="0.01" min="0" value={units.rent_amount} onChange={(e) => setUnits({ ...units, rent_amount: e.target.value })} />
                </div>
              </div>
            ) : null}
            {units.mode === 'multi' ? (
              <p className="text-xs text-white/50">{units.mode === 'rooms' ? 'Rent applies to every room — adjust individual rooms later.' : 'Beds, baths and rent apply to every unit — adjust individual ones later.'}</p>
            ) : null}
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save property'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
