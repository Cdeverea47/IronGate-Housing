import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { Card, Button, Modal, Label, Select, ErrorText, EmptyState } from '../../components/UI.jsx';

const categoryLabels = {
  renters_insurance: "Renter's insurance",
  id: 'ID / verification',
  receipt: 'Receipt',
  lease_agreement: 'Lease agreement',
  inspection: 'Inspection report',
  insurance_policy: 'Insurance policy',
  listing_photo: 'Listing photo',
  other: 'Other',
};

export default function TenantDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('other');
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  function load() {
    setLoading(true);
    api
      .get('/portal/documents')
      .then(setDocuments)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Renter's insurance now lives on its own page (Payments → Rental insurance).
  const otherDocs = documents.filter((d) => d.category !== 'renters_insurance');

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
    try {
      await api.post('/portal/documents', fd, { isForm: true });
      setModalOpen(false);
      setCategory('other');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.original_name}"?`)) return;
    await api.del(`/portal/documents/${doc.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Documents</h1>
          <p className="text-white/60 text-sm mt-1">Files shared with you, plus anything you'd like to share back</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Upload document</Button>
      </div>

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : otherDocs.length === 0 ? (
        <EmptyState message="No other documents yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {otherDocs.map((d) => (
            <div key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{d.original_name}</div>
                <div className="text-sm text-white/60">
                  {categoryLabels[d.category] || d.category.replace(/_/g, ' ')} ·{' '}
                  {new Date(d.uploaded_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a href={api.portalDownloadUrl(d.id)} className="text-white/90 hover:text-white text-sm font-medium underline">
                  Download
                </a>
                {d.uploaded_by_role === 'tenant' ? (
                  <button
                    onClick={() => handleDelete(d)}
                    className="text-rose-200 hover:text-rose-100 text-sm font-medium"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload document">
        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <Label>File</Label>
            <input
              ref={fileRef}
              type="file"
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white file:text-sm"
              required
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="id">ID / verification</option>
              <option value="receipt">Receipt</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">Upload</Button>
        </form>
      </Modal>
    </div>
  );
}
