import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';

const emptyForm = {
  property_id: '',
  policy_type: 'rental',
  provider: '',
  policy_number: '',
  premium_amount: '',
  premium_frequency: 'annual',
  coverage_start: '',
  coverage_end: '',
  notes: '',
};

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function policyTone(coverageEnd) {
  if (!coverageEnd) return 'slate';
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  if (coverageEnd < today) return 'red';
  if (coverageEnd <= cutoffStr) return 'amber';
  return 'green';
}

function policyLabel(coverageEnd) {
  if (!coverageEnd) return 'No end date';
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  if (coverageEnd < today) return 'Expired';
  if (coverageEnd <= cutoffStr) return 'Renew soon';
  return 'Active';
}

export default function Insurance() {
  const [policies, setPolicies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/insurance'), api.get('/properties')])
      .then(([policyList, props]) => {
        setPolicies(policyList);
        setProperties(props);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let documentId = null;
      const file = fileRef.current?.files[0];
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'insurance_policy');
        fd.append('property_id', form.property_id);
        const doc = await api.post('/documents', fd, { isForm: true });
        documentId = doc.id;
      }
      await api.post('/insurance', { ...form, document_id: documentId });
      setModalOpen(false);
      setForm(emptyForm);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(policy) {
    if (!confirm(`Delete this ${policy.policy_type} insurance policy with ${policy.provider}?`)) return;
    await api.del(`/insurance/${policy.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Rental insurance</h1>
          <p className="text-white/60 text-sm mt-1">Rental and homeowner's policies by property</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={properties.length === 0}>
          + Add policy
        </Button>
      </div>

      {properties.length === 0 ? <p className="text-sm text-amber-200">Add a property before recording a policy.</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : policies.length === 0 ? (
        <EmptyState message="No insurance policies recorded yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {policies.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-white">
                  {p.property_name} · {p.policy_type === 'homeowner' ? "Homeowner's" : 'Rental'} insurance
                </div>
                <div className="text-sm text-white/60">
                  {p.provider}
                  {p.policy_number ? ` · #${p.policy_number}` : ''}
                  {p.premium_amount ? ` · ${money(p.premium_amount)}/${p.premium_frequency === 'monthly' ? 'mo' : 'yr'}` : ''}
                </div>
                <div className="text-xs text-white/50 mt-0.5">
                  {p.coverage_start ? `${p.coverage_start} — ` : ''}
                  {p.coverage_end || 'no end date'}
                  {p.document_name ? (
                    <>
                      {' · '}
                      <a href={api.downloadUrl(p.document_id)} className="underline hover:text-white">
                        {p.document_name}
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge tone={policyTone(p.coverage_end)}>{policyLabel(p.coverage_end)}</Badge>
                <Button variant="danger" onClick={() => handleDelete(p)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add insurance policy">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Property</Label>
            <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} required>
              <option value="">Select a property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Policy type</Label>
            <Select value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value })}>
              <option value="rental">Rental / landlord insurance</option>
              <option value="homeowner">Homeowner's insurance</option>
            </Select>
          </div>
          <div>
            <Label>Provider</Label>
            <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} required />
          </div>
          <div>
            <Label>Policy number</Label>
            <Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Premium ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.premium_amount}
                onChange={(e) => setForm({ ...form, premium_amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Billed</Label>
              <Select value={form.premium_frequency} onChange={(e) => setForm({ ...form, premium_frequency: e.target.value })}>
                <option value="annual">Annually</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Coverage start</Label>
              <Input type="date" value={form.coverage_start} onChange={(e) => setForm({ ...form, coverage_start: e.target.value })} />
            </div>
            <div>
              <Label>Coverage end / renewal date</Label>
              <Input type="date" value={form.coverage_end} onChange={(e) => setForm({ ...form, coverage_end: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div>
            <Label>Policy document (optional)</Label>
            <input
              ref={fileRef}
              type="file"
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white file:text-sm"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save policy'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
