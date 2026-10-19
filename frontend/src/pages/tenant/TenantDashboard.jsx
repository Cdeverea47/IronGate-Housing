import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Badge, EmptyState, LinkButton } from '../../components/UI.jsx';
import { monthsLeftInfo } from '../../leaseUtils.js';
import { unitName } from '../../unitName.js';

function statusTone(status) {
  if (status === 'active') return 'green';
  if (status === 'ended') return 'slate';
  return 'amber';
}

export default function TenantDashboard() {
  const [data, setData] = useState({ linked: true, leases: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/portal/overview')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Your home</h1>
        <p className="text-white/60 text-sm mt-1">Lease details and landlord contact info</p>
      </div>

      {error ? <p className="text-sm text-rose-200">{error}</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : !data.linked || data.leases.length === 0 ? (
        <EmptyState message="No lease is linked to your account yet. Ask your landlord to add you as a tenant using the same email you registered with, and it'll connect automatically the next time you sign in." />
      ) : (
        <div className="space-y-4">
          {data.leases.map((l) => {
            const monthsLeft = monthsLeftInfo(l.end_date);
            return (
              <Card key={l.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {l.property_name} · {unitName(l.unit_number)}
                    </div>
                    <div className="text-sm text-white/60 mt-0.5">
                      {l.address_line1}
                      {l.address_line2 ? `, ${l.address_line2}` : ''}
                      {l.city ? `, ${l.city}` : ''} {l.state || ''} {l.zip || ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.status === 'active' ? <Badge tone={monthsLeft.tone}>{monthsLeft.label}</Badge> : null}
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                  <div>
                    <div className="text-xs font-medium text-white/60 uppercase tracking-wide">Rent</div>
                    <div className="mt-1 text-white font-medium">${l.rent_amount}/mo</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white/60 uppercase tracking-wide">Lease start</div>
                    <div className="mt-1 text-white font-medium">{l.start_date}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white/60 uppercase tracking-wide">Lease end</div>
                    <div className="mt-1 text-white font-medium">{l.end_date || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white/60 uppercase tracking-wide">Deposit</div>
                    <div className="mt-1 text-white font-medium">${l.deposit_amount || 0}</div>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-white/10 text-sm text-white/70">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-medium text-white/90 mb-1">Landlord</div>
                      <div>{l.landlord_name} · {l.landlord_email}</div>
                      {l.zelle_contact ? (
                        <div className="mt-1 text-white/60">Zelle: {l.zelle_contact}</div>
                      ) : null}
                    </div>
                    {l.landlord_email ? (
                      <LinkButton
                        variant="secondary"
                        href={`mailto:${l.landlord_email}?subject=${encodeURIComponent(
                          `${l.property_name} ${unitName(l.unit_number)}`
                        )}`}
                      >
                        Email landlord
                      </LinkButton>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
