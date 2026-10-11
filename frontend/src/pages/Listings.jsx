import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import {
  Card,
  Button,
  Modal,
  Input,
  Textarea,
  Label,
  Select,
  Badge,
  ErrorText,
  EmptyState,
} from '../components/UI.jsx';

const emptyForm = {
  unit_id: '',
  title: '',
  description: '',
  rent_amount: '',
  available_date: '',
  pet_policy: '',
  amenities: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  status: 'draft',
};

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function buildListingText(listing) {
  const address = [listing.address_line1, listing.city, listing.state, listing.zip].filter(Boolean).join(', ');
  const lines = [
    listing.title,
    `${address} — Unit ${listing.unit_number}`,
    '',
    `Rent: ${listing.rent_amount ? `${money(listing.rent_amount)}/mo` : 'Contact for pricing'}`,
    listing.available_date ? `Available: ${listing.available_date}` : null,
    listing.bedrooms || listing.bathrooms ? `${listing.bedrooms ?? '–'} bed / ${listing.bathrooms ?? '–'} bath` : null,
    listing.pet_policy ? `Pet policy: ${listing.pet_policy}` : null,
    listing.amenities ? `Amenities: ${listing.amenities}` : null,
    '',
    listing.description || '',
    '',
    'Contact:',
    listing.contact_name || null,
    listing.contact_email || null,
    listing.contact_phone || null,
  ].filter((line) => line !== null);
  return lines.join('\n');
}

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copyModal, setCopyModal] = useState({ open: false, listing: null, copied: false });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const filesRef = useRef(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/listings'), api.get('/properties'), api.get('/units')])
      .then(([l, p, u]) => {
        setListings(l);
        setProperties(p);
        setUnits(u);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const unitOptions = useMemo(() => {
    const propertyById = Object.fromEntries(properties.map((p) => [p.id, p]));
    return units.map((u) => ({
      ...u,
      label: `${propertyById[u.property_id]?.name || 'Unknown property'} — Unit ${u.unit_number}`,
    }));
  }, [properties, units]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const files = filesRef.current?.files ? Array.from(filesRef.current.files) : [];
      const photoIds = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'listing_photo');
        const doc = await api.post('/documents', fd, { isForm: true });
        photoIds.push(doc.id);
      }
      await api.post('/listings', { ...form, photo_document_ids: photoIds });
      setModalOpen(false);
      setForm(emptyForm);
      if (filesRef.current) filesRef.current.value = '';
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(listing) {
    if (!confirm(`Delete the listing "${listing.title}"?`)) return;
    await api.del(`/listings/${listing.id}`);
    load();
  }

  async function updateStatus(listing, status) {
    await api.put(`/listings/${listing.id}`, { status });
    load();
  }

  async function copyListingText(listing) {
    const text = buildListingText(listing);
    try {
      await navigator.clipboard.writeText(text);
      setCopyModal({ open: true, listing, copied: true });
    } catch {
      setCopyModal({ open: true, listing, copied: false });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Listings</h1>
          <p className="text-white/60 text-sm mt-1">Prep a vacancy listing, then post it to Zillow, Trulia, or Redfin</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={units.length === 0}>
          + New listing
        </Button>
      </div>

      <Card className="p-4 text-sm text-white/70">
        Zillow, Trulia, and Redfin don't offer a public API for posting listings automatically, so there's no
        one-click "publish" here. Instead, build your listing below, then click <strong>Copy text</strong> and
        paste it into{' '}
        <a
          href="https://www.zillow.com/rental-manager/"
          target="_blank"
          rel="noreferrer"
          className="underline text-white hover:text-white/90"
        >
          Zillow Rental Manager
        </a>{' '}
        (free) — it syndicates to Trulia and, in most markets, Redfin automatically. You can also check{' '}
        <a href="https://www.trulia.com" target="_blank" rel="noreferrer" className="underline text-white hover:text-white/90">
          Trulia
        </a>{' '}
        and{' '}
        <a href="https://www.redfin.com" target="_blank" rel="noreferrer" className="underline text-white hover:text-white/90">
          Redfin
        </a>{' '}
        directly once it's live.
      </Card>

      {units.length === 0 ? <p className="text-sm text-amber-200">Add a unit before creating a listing.</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : listings.length === 0 ? (
        <EmptyState message="No listings yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {listings.map((listing) => (
            <div key={listing.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{listing.title}</div>
                <div className="text-sm text-white/60 truncate">
                  {listing.property_name} · Unit {listing.unit_number}
                  {listing.rent_amount ? ` · ${money(listing.rent_amount)}/mo` : ''}
                  {listing.available_date ? ` · avail ${listing.available_date}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={listing.status}
                  onChange={(e) => updateStatus(listing, e.target.value)}
                  className="w-32"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
                <Badge tone={listing.status === 'active' ? 'green' : listing.status === 'archived' ? 'slate' : 'amber'}>
                  {listing.status}
                </Badge>
                <Button variant="secondary" onClick={() => copyListingText(listing)}>
                  Copy text
                </Button>
                <Button variant="danger" onClick={() => handleDelete(listing)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New listing">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Unit</Label>
            <Select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
              <option value="">Select a unit</option>
              {unitOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Listing title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Bright 2BR near downtown"
              required
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Sell the space — natural light, recent updates, nearby transit, etc."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rent ($/mo)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.rent_amount}
                onChange={(e) => setForm({ ...form, rent_amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Available date</Label>
              <Input
                type="date"
                value={form.available_date}
                onChange={(e) => setForm({ ...form, available_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Pet policy</Label>
            <Input
              value={form.pet_policy}
              onChange={(e) => setForm({ ...form, pet_policy: e.target.value })}
              placeholder="Cats OK, no dogs"
            />
          </div>
          <div>
            <Label>Amenities</Label>
            <Input
              value={form.amenities}
              onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              placeholder="In-unit laundry, parking, dishwasher"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Contact name</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Photos (optional)</Label>
            <input
              ref={filesRef}
              type="file"
              multiple
              accept="image/*"
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white file:text-sm"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save listing'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={copyModal.open}
        onClose={() => setCopyModal({ open: false, listing: null, copied: false })}
        title="Listing text"
      >
        {copyModal.listing ? (
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              {copyModal.copied
                ? 'Copied to your clipboard — paste it into Zillow Rental Manager (or Trulia/Redfin) to finish posting.'
                : "Couldn't copy automatically — select and copy the text below."}
            </p>
            <pre className="whitespace-pre-wrap rounded-lg border border-white/20 bg-white/10 p-3.5 text-sm text-white max-h-72 overflow-y-auto">
              {buildListingText(copyModal.listing)}
            </pre>
            <Button
              onClick={() => window.open('https://www.zillow.com/rental-manager/', '_blank')}
              className="w-full"
            >
              Open Zillow Rental Manager
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
