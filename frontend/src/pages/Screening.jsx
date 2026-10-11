import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Button, Modal, Input, Textarea, Label, Select, Badge, ErrorText, EmptyState } from '../components/UI.jsx';

const emptyForm = { applicant_name: '', applicant_email: '', property_id: '' };
const emptyResultForm = { result_summary: '', result_link: '' };

export default function Screening() {
  const [requests, setRequests] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resultModal, setResultModal] = useState({ open: false, request: null });
  const [resultForm, setResultForm] = useState(emptyResultForm);
  const [resultError, setResultError] = useState(null);
  const [resultSaving, setResultSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/screenings'), api.get('/properties')])
      .then(([s, p]) => {
        setRequests(s);
        setProperties(p);
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
      await api.post('/screenings', { ...form, property_id: form.property_id || null });
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openResultModal(request) {
    setResultForm({ result_summary: request.result_summary || '', result_link: request.result_link || '' });
    setResultError(null);
    setResultModal({ open: true, request });
  }

  async function handleSaveResult(e) {
    e.preventDefault();
    setResultError(null);
    setResultSaving(true);
    try {
      await api.put(`/screenings/${resultModal.request.id}`, { ...resultForm, status: 'completed' });
      setResultModal({ open: false, request: null });
      load();
    } catch (err) {
      setResultError(err.message);
    } finally {
      setResultSaving(false);
    }
  }

  async function handleDelete(request) {
    if (!confirm(`Delete the screening request for ${request.applicant_name}?`)) return;
    await api.del(`/screenings/${request.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tenant screening</h1>
          <p className="text-white/60 text-sm mt-1">Send a potential tenant a credit/background check, then record the result</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Send screening</Button>
      </div>

      <Card className="p-4 text-sm text-white/70">
        Sending a request emails the applicant a link to{' '}
        <a
          href="https://www.mysmartmove.com/"
          target="_blank"
          rel="noreferrer"
          className="underline text-white hover:text-white/90"
        >
          TransUnion SmartMove
        </a>{' '}
        to complete their own screening. Once they let you know it's done, mark it complete here and note the
        result.
      </Card>

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState message="No screening requests yet." />
      ) : (
        <Card className="divide-y divide-white/10">
          {requests.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{r.applicant_name}</div>
                <div className="text-sm text-white/60 truncate">
                  {r.applicant_email}
                  {r.property_name ? ` · ${r.property_name}` : ''}
                </div>
                {r.status === 'completed' && r.result_summary ? (
                  <div className="text-sm text-white/80 mt-1.5 max-w-md truncate">{r.result_summary}</div>
                ) : null}
                {r.status === 'completed' && r.result_link ? (
                  <a
                    href={r.result_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-white/70 hover:text-white"
                  >
                    View report
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.status !== 'completed' && r.applicant_reported_at ? (
                  <Badge tone="amber">Applicant says done</Badge>
                ) : null}
                <Badge tone={r.status === 'completed' ? 'green' : 'amber'}>
                  {r.status === 'completed' ? 'Completed' : 'Sent'}
                </Badge>
                <Button variant="secondary" onClick={() => openResultModal(r)}>
                  {r.status === 'completed' ? 'Edit result' : 'Mark complete'}
                </Button>
                <Button variant="danger" onClick={() => handleDelete(r)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Send screening request">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Applicant name</Label>
            <Input
              value={form.applicant_name}
              onChange={(e) => setForm({ ...form, applicant_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Applicant email</Label>
            <Input
              type="email"
              value={form.applicant_email}
              onChange={(e) => setForm({ ...form, applicant_email: e.target.value })}
              required
            />
          </div>
          {properties.length > 0 ? (
            <div>
              <Label>Property (optional)</Label>
              <Select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
                <option value="">None</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Sending…' : 'Send screening request'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={resultModal.open}
        onClose={() => setResultModal({ open: false, request: null })}
        title={`Screening result — ${resultModal.request?.applicant_name || ''}`}
      >
        <form onSubmit={handleSaveResult} className="space-y-3">
          <div>
            <Label>Result summary</Label>
            <Textarea
              rows={4}
              value={resultForm.result_summary}
              onChange={(e) => setResultForm({ ...resultForm, result_summary: e.target.value })}
              placeholder="e.g. Credit score 720, no evictions, income verified"
            />
          </div>
          <div>
            <Label>Report link (optional)</Label>
            <Input
              value={resultForm.result_link}
              onChange={(e) => setResultForm({ ...resultForm, result_link: e.target.value })}
              placeholder="Paste a link to the full report if you have one"
            />
          </div>
          <ErrorText>{resultError}</ErrorText>
          <Button type="submit" className="w-full" disabled={resultSaving}>
            {resultSaving ? 'Saving…' : 'Save & mark complete'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
