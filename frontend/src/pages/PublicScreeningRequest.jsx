import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Card, Button } from '../components/UI.jsx';

const SCREENING_SITE_URL = 'https://www.mysmartmove.com/';

export default function PublicScreeningRequest() {
  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    api
      .get(`/public/screening/${token}`)
      .then((r) => {
        setRequest(r);
        setReported(!!r.applicant_reported_at);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  async function handleReport() {
    setReporting(true);
    try {
      await api.post(`/public/screening/${token}/report`);
      setReported(true);
    } catch {
      // ignore — the button will just stay clickable
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient-diagonal bg-fixed text-white px-4">
      <Card className="w-full max-w-md p-8">
        {error ? (
          <p className="text-rose-200 text-sm text-center">
            {error === 'Screening request not found'
              ? "We couldn't find this screening request — the link may be out of date."
              : error}
          </p>
        ) : !request ? (
          <p className="text-white/60 text-sm text-center">Loading…</p>
        ) : (
          <div className="text-center space-y-4">
            <h1 className="text-xl font-semibold">Hi {request.applicant_name},</h1>
            <p className="text-sm text-white/70">
              {request.landlord_name || 'Your prospective landlord'} has requested a background/credit check as part
              of your rental application{request.property_name ? ` for ${request.property_name}` : ''}.
            </p>

            {request.status === 'completed' ? (
              <p className="text-sm text-emerald-200">
                Your landlord has already reviewed your screening — no further action needed.
              </p>
            ) : (
              <>
                <Button onClick={() => window.open(SCREENING_SITE_URL, '_blank')} className="w-full">
                  Complete screening on TransUnion SmartMove ↗
                </Button>
                <p className="text-xs text-white/50">
                  Once you've finished there, let your landlord know so they can review your results.
                </p>
                <Button
                  variant="secondary"
                  onClick={handleReport}
                  disabled={reporting || reported}
                  className="w-full"
                >
                  {reported ? "Landlord notified ✓" : reporting ? 'Notifying…' : "I've completed my screening"}
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
