import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { Card, Button, ErrorText } from '../../components/UI.jsx';

export default function TenantInsurance() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  const policies = documents.filter((d) => d.category === 'renters_insurance');

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
    fd.append('category', 'renters_insurance');
    setUploading(true);
    try {
      await api.post('/portal/documents', fd, { isForm: true });
      fileRef.current.value = '';
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.original_name}"?`)) return;
    await api.del(`/portal/documents/${doc.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Rental insurance</h1>
        <p className="text-white/60 text-sm mt-1">Keep proof of your renter's insurance on file with your landlord</p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-medium text-white/80 mb-1">Renter's insurance</h2>
        <p className="text-xs text-white/50 mb-4">
          Upload proof of your renter's insurance policy so your landlord has it on file.
        </p>

        {loading ? (
          <p className="text-sm text-white/60 mb-4">Loading…</p>
        ) : policies.length === 0 ? (
          <p className="text-sm text-white/50 mb-4">No policy uploaded yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {policies.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3.5 py-2.5">
                <div className="text-sm text-white/90 truncate">
                  {d.original_name}
                  <span className="text-white/50"> · {new Date(d.uploaded_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <a href={api.portalDownloadUrl(d.id)} className="text-white/90 hover:text-white text-sm font-medium underline">
                    Download
                  </a>
                  {d.uploaded_by_role === 'tenant' ? (
                    <button onClick={() => handleDelete(d)} className="text-rose-200 hover:text-rose-100 text-sm font-medium">
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            className="flex-1 min-w-[200px] text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white file:text-sm"
          />
          <Button type="submit" variant="secondary" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
        <ErrorText light>{error}</ErrorText>
      </Card>
    </div>
  );
}
