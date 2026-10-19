import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Badge, Textarea, Button, LinkButton, Label, ErrorText } from '../components/UI.jsx';
import { unitName } from '../unitName.js';

export default function TenantDetail() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState(null);

  useEffect(() => {
    api
      .get(`/tenants/${id}`)
      .then((t) => {
        setTenant(t);
        setNotes(t.notes || '');
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleSaveNotes() {
    setNotesSaving(true);
    setNotesSaved(false);
    setNotesError(null);
    try {
      await api.put(`/tenants/${id}`, { notes });
      setTenant((t) => ({ ...t, notes }));
      setNotesSaved(true);
    } catch (err) {
      setNotesError(err.message);
    } finally {
      setNotesSaving(false);
    }
  }

  if (error) return <p className="text-rose-200">{error}</p>;
  if (!tenant) return <p className="text-white/60">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/tenants" className="text-sm text-white/70 hover:text-white">← Back to tenants</Link>
          <h1 className="text-2xl font-semibold text-white mt-1">{tenant.first_name} {tenant.last_name}</h1>
          <p className="text-white/60 text-sm mt-1">{tenant.email || '—'} {tenant.phone ? `· ${tenant.phone}` : ''}</p>
        </div>
        <LinkButton
          href="https://www.mysmartmove.com/"
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
        >
          Run credit check ↗
        </LinkButton>
      </div>

      <Card className="p-4 space-y-2">
        <Label>Notes</Label>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaved(false);
          }}
          placeholder="Add notes about this tenant…"
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleSaveNotes} disabled={notesSaving}>
            {notesSaving ? 'Saving…' : notesSaved ? 'Saved ✓' : 'Save notes'}
          </Button>
          <ErrorText>{notesError}</ErrorText>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-medium text-white mb-3">Leases</h2>
        {tenant.leases.length === 0 ? (
          <Card className="p-6 text-white/60 text-sm">No leases for this tenant.</Card>
        ) : (
          <Card className="divide-y divide-white/10">
            {tenant.leases.map((l) => (
              <div key={l.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{l.property_name} · {unitName(l.unit_number)}</div>
                  <div className="text-sm text-white/60">
                    {l.start_date} — {l.end_date || 'ongoing'} · ${l.rent_amount}/mo
                  </div>
                </div>
                <Badge tone={l.status === 'active' ? 'green' : 'slate'}>{l.status}</Badge>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
