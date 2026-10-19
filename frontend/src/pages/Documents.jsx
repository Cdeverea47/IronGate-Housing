import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Label, Select, ErrorText, EmptyState } from '../components/UI.jsx';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('lease_agreement');
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/documents'), api.get('/properties'), api.get('/tenants')])
      .then(([d, p, t]) => {
        setDocuments(d);
        setProperties(p);
        setTenants(t);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleUpload(e) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current.files[0];
    if (!file) {
      setError('Choose a file to upload');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    if (propertyId) fd.append('property_id', propertyId);
    if (tenantId) fd.append('tenant_id', tenantId);
    try {
      await api.post('/documents', fd, { isForm: true });
      setModalOpen(false);
      setPropertyId('');
      setTenantId('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.original_name}"?`)) return;
    await api.del(`/documents/${doc.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Documents</h1>
          <p className="text-white/60 text-sm mt-1">Leases, receipts, and other files</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Upload document</Button>
      </div>

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : documents.length === 0 ? (
        <EmptyState message="No documents uploaded yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {documents.map((d) => (
            <div key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{d.original_name}</div>
                <div className="text-sm text-white/60">{d.category.replace('_', ' ')} · {new Date(d.uploaded_at).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <a href={api.downloadUrl(d.id)} className="text-white/90 hover:text-white text-sm font-medium underline">Download</a>
                <Button variant="danger" onClick={() => handleDelete(d)}>Delete</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload document">
        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <Label>File</Label>
            <input ref={fileRef} type="file" className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white file:text-sm" required />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="lease_agreement">Digital lease (lease agreement)</option>
              <option value="receipt">Receipt</option>
              <option value="inspection">Inspection report</option>
              <option value="insurance_policy">Insurance policy</option>
              <option value="listing_photo">Listing photo</option>
              <option value="id">ID / verification</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Related property (optional)</Label>
            <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Related tenant (optional)</Label>
            <Select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              <option value="">None</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </Select>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Upload</Button>
        </form>
      </Modal>
    </div>
  );
}
