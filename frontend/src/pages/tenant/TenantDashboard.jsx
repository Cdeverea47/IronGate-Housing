import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Badge, EmptyState, LinkButton } from '../../components/UI.jsx';
import { monthsLeftInfo } from '../../leaseUtils.js';
import { unitName } from '../../unitName.js';

function statusTone(status) {
  if (status === 'active') return 'green';
  if (status === 'ended') return 'slate';
  return 'amber';
}

function greetingForHour(hour) {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (n) => String(n).padStart(2, '0');
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const ymd = (d) => `${ym(d)}-${pad(d.getDate())}`;

function Stat({ label, value, tone = 'text-white', sub }) {
  return (
    <div>
      <div className="text-xs font-medium text-white/60 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub ? <div className="text-xs text-white/50 mt-0.5">{sub}</div> : null}
    </div>
  );
}

export default function TenantDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ linked: true, leases: [] });
  const [payments, setPayments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    Promise.all([
      api.get('/portal/overview'),
      api.get('/portal/payments').catch(() => []),
      api.get('/portal/maintenance').catch(() => []),
    ])
      .then(([overview, pays, maint]) => {
        setData(overview);
        setPayments(pays);
        setMaintenance(maint);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : '';
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  // This month's rent picture (local calendar month).
  const monthKey = ym(now);
  const monthStart = `${monthKey}-01`;
  const todayStr = ymd(now);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextKey = ym(next);
  const isPaid = (p) => p.status === 'paid';
  const thisMonth = payments.filter((p) => p.due_date.startsWith(monthKey));
  const monthDue = thisMonth.reduce((t, p) => t + Number(p.amount), 0);
  const monthPaid = thisMonth.filter(isPaid).reduce((t, p) => t + Number(p.amount), 0);
  const monthLeft = monthDue - monthPaid;
  // Unpaid from earlier months rolls into this month's total.
  const carryOver = payments
    .filter((p) => !isPaid(p) && p.due_date < monthStart)
    .reduce((t, p) => t + Number(p.amount), 0);
  const totalDue = monthLeft + carryOver;
  const nextMonthRent = payments.filter((p) => p.due_date.startsWith(nextKey)).reduce((t, p) => t + Number(p.amount), 0);
  const upcomingPayments = payments
    .filter((p) => !isPaid(p) && p.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);
  const openMaintenance = maintenance.filter((m) => m.status !== 'resolved').slice(0, 5);
  const hasLease = data.linked && data.leases.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {greetingForHour(now.getHours())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-white/60 text-sm mt-1">Your home, rent and requests at a glance</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{dateLabel}</div>
          <div className="text-xs text-white/50 mt-0.5 tabular-nums">{timeLabel}</div>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-200">{error}</p> : null}

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : !data.linked || data.leases.length === 0 ? (
        <EmptyState message="No lease is linked to your account yet. Ask your landlord to add you as a tenant using the same email you registered with, and it'll connect automatically the next time you sign in." />
      ) : (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h2 className="text-lg font-semibold text-white">
                {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} rent
              </h2>
              <Link to="/payments" className="text-sm text-white/80 hover:text-white underline">
                Pay now
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Rent this month" value={money(monthDue)} />
              <Stat label="Paid" value={money(monthPaid)} tone="text-emerald-300" />
              <Stat label="Left to pay" value={money(monthLeft)} tone={monthLeft > 0 ? 'text-amber-200' : 'text-white'} />
              <Stat
                label="Total due"
                value={money(totalDue)}
                tone={totalDue > 0 ? 'text-rose-200' : 'text-white'}
                sub={carryOver > 0 ? `includes ${money(carryOver)} past due` : null}
              />
            </div>
            {totalDue > 0 ? (
              <p className="mt-4 text-sm text-white/70">
                If {money(totalDue)} isn't paid by the end of the month, it rolls over: next month you'd owe{' '}
                <span className="font-semibold text-white">{money(totalDue + nextMonthRent)}</span>
                {nextMonthRent > 0 ? ` (${money(nextMonthRent)} next month's rent + ${money(totalDue)} unpaid)` : ''}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-emerald-200">You're all paid up for this month.</p>
            )}
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">Upcoming payments</h2>
                <Link to="/payments" className="text-sm text-white/80 hover:text-white underline">
                  View all
                </Link>
              </div>
              {upcomingPayments.length === 0 ? (
                <p className="text-sm text-white/60">Nothing coming up.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {upcomingPayments.map((p) => (
                    <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{p.notes || 'Rent'}</div>
                        <div className="text-xs text-white/60">Due {p.due_date}</div>
                      </div>
                      <div className="text-sm font-semibold text-white tabular-nums">{money(p.amount)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">Upcoming maintenance</h2>
                <Link to="/maintenance" className="text-sm text-white/80 hover:text-white underline">
                  View all
                </Link>
              </div>
              {openMaintenance.length === 0 ? (
                <p className="text-sm text-white/60">No open maintenance requests.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {openMaintenance.map((m) => (
                    <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{m.title}</div>
                        <div className="text-xs text-white/60">
                          {m.unit_label || ''} · reported {String(m.created_at).slice(0, 10)}
                        </div>
                      </div>
                      <Badge tone={m.status === 'open' ? 'amber' : 'blue'}>{String(m.status).replace(/_/g, ' ')}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

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
