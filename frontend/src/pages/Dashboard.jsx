import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { StatCard, Card, Badge, Input, Button, Select } from '../components/UI.jsx';
import { propertyTypeLabel } from '../propertyTypes.js';

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function greetingForHour(hour) {
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good evening';
}

function RentDonut({ due, collected, remaining }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const pct = due > 0 ? Math.min(1, collected / due) : 0;
  const collectedLength = pct * circumference;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium text-white/80 mb-4">This month's rent</h3>
      {due === 0 ? (
        <p className="text-sm text-white/60">No rent due this month yet.</p>
      ) : (
        <div className="flex items-center gap-6">
          <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0 -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="16" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${collectedLength} ${circumference}`}
            />
            <text
              x="70"
              y="70"
              textAnchor="middle"
              dominantBaseline="middle"
              transform="rotate(90 70 70)"
              className="fill-white"
              style={{ fontSize: '22px', fontWeight: 600 }}
            >
              {Math.round(pct * 100)}%
            </text>
          </svg>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-white shrink-0" />
              <span className="text-white/80">Collected</span>
              <span className="text-white font-medium ml-auto">{money(collected)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-white/15 shrink-0" />
              <span className="text-white/80">Left to collect</span>
              <span className="text-white font-medium ml-auto">{money(remaining)}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <span className="text-white/60">Total due</span>
              <span className="text-white font-medium ml-auto">{money(due)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function MyTasksBox({ autoItems, ackedAutoIds, onAckAuto }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [audience, setAudience] = useState('landlord');
  const [properties, setProperties] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ackedAuto, setAckedAuto] = useState(() => new Set());

  function load() {
    api
      .get('/tasks')
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    api.get('/properties').then(setProperties).catch(() => {});
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.post('/tasks', { title: title.trim(), property_id: propertyId || null, audience });
      setTitle('');
      setPropertyId('');
      setAudience('landlord');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await api.put(`/tasks/${task.id}`, { done: !task.done });
  }

  async function removeTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await api.del(`/tasks/${task.id}`);
  }

  // Lining out an auto-generated item (rent overdue, high-priority
  // maintenance, insurance renewal, draft listing) works the same way as a
  // manual task's checkbox: it shows a strikethrough right away, then
  // persists so the item stays dismissed until the underlying data changes.
  function toggleAutoDone(item) {
    setAckedAuto((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    onAckAuto(item.id);
  }

  const visibleAutoItems = autoItems.filter((item) => !ackedAutoIds.has(item.id));
  const openTaskCount = tasks.filter((t) => !t.done).length;

  // Landlord tasks get a blue tint, tenant tasks a purple tint, so the two
  // are distinguishable at a glance in the shared "My tasks" list.
  function audienceRowClass(taskAudience) {
    return taskAudience === 'tenant'
      ? 'bg-purple-500/20 hover:bg-purple-500/25'
      : 'bg-blue-500/15 hover:bg-blue-500/20';
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/80">My tasks</h3>
        {openTaskCount + visibleAutoItems.length > 0 ? (
          <span className="text-xs text-white/50">{openTaskCount + visibleAutoItems.length} open</span>
        ) : null}
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {visibleAutoItems.map((item) => {
          const done = ackedAuto.has(item.id);
          return (
            <div
              key={`auto-${item.id}`}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${audienceRowClass('landlord')}`}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleAutoDone(item)}
                className="h-4 w-4 rounded border-white/30 bg-white/10 accent-white shrink-0"
              />
              <Link to={item.link} className={`text-sm flex-1 truncate ${done ? 'text-white/40 line-through' : 'text-white/90'}`}>
                {item.label}
              </Link>
              <Badge tone={item.tone}>{item.badge}</Badge>
            </div>
          );
        })}

        {!loading &&
          tasks.map((task) => (
            <div key={task.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${audienceRowClass(task.audience)}`}>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleDone(task)}
                className="h-4 w-4 rounded border-white/30 bg-white/10 accent-white shrink-0"
              />
              <span className={`text-sm flex-1 truncate ${task.done ? 'text-white/40 line-through' : 'text-white/90'}`}>
                {task.property_name ? `${task.property_name} — ${task.title}` : task.title}
              </span>
              <button onClick={() => removeTask(task)} className="text-white/40 hover:text-white/80 text-sm shrink-0">
                ✕
              </button>
            </div>
          ))}

        {!loading && tasks.length === 0 && visibleAutoItems.length === 0 ? (
          <p className="text-sm text-white/50 px-1">Nothing on your plate — add a to-do below.</p>
        ) : null}
      </div>

      <form onSubmit={handleAdd} className="space-y-2 mt-4 pt-4 border-t border-white/10">
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a to-do…"
            className="flex-1"
          />
          <Button type="submit" variant="secondary" disabled={saving || !title.trim()}>
            Add
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAudience('landlord')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors border ${
              audience === 'landlord'
                ? 'bg-blue-500/25 border-blue-400/60 text-white'
                : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
            }`}
          >
            Landlord task
          </button>
          <button
            type="button"
            onClick={() => setAudience('tenant')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors border ${
              audience === 'tenant'
                ? 'bg-purple-500/25 border-purple-400/60 text-white'
                : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
            }`}
          >
            Tenant task
          </button>
        </div>
        {properties.length > 0 ? (
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="text-xs">
            <option value="">All</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : null}
      </form>
    </Card>
  );
}

function RentalInsuranceCard({ policies }) {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(index) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }

  if (!policies || policies.length === 0) {
    return <StatCard label="Rental insurance" value="Not added" sub="Add one on the Insurance page" />;
  }

  if (policies.length === 1) {
    const p = policies[0];
    return (
      <StatCard
        label="Rental insurance"
        value={`${p.coverage_start || '—'} – ${p.coverage_end || 'ongoing'}`}
        sub={p.provider}
      />
    );
  }

  return (
    <Card className="p-5 transition-colors hover:bg-white/15">
      <div className="text-xs font-medium text-white/60 uppercase tracking-wide">Rental insurance</div>
      <div ref={scrollRef} onScroll={handleScroll} className="mt-1.5 flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {policies.map((p, i) => (
          <div key={i} className="min-w-full shrink-0 snap-start">
            <div className="text-2xl font-semibold text-white truncate">
              {p.coverage_start || '—'} – {p.coverage_end || 'ongoing'}
            </div>
            <div className="mt-1 text-xs text-white/50 truncate">{p.provider}</div>
            <div className="mt-1 text-[11px] text-white/40 lowercase truncate">
              {propertyTypeLabel(p.property_type) || p.property_name}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {policies.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Show policy ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/30'}`}
          />
        ))}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [upcomingPayments, setUpcomingPayments] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [draftListings, setDraftListings] = useState([]);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [ackedAutoIds, setAckedAutoIds] = useState(() => new Set());

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/maintenance?status=open'),
      api.get('/insurance'),
      api.get('/payments?status=pending'),
      api.get('/listings'),
      api.get('/tasks/acks'),
    ])
      .then(([s, m, insurance, payments, listings, acks]) => {
        setSummary(s);
        setMaintenance(m.slice(0, 5));
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + 30);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        setRenewals(insurance.filter((p) => p.coverage_end && p.coverage_end <= cutoffStr).slice(0, 5));
        const sortedPayments = [...payments].sort((a, b) => a.due_date.localeCompare(b.due_date));
        setUpcomingPayments(sortedPayments.slice(0, 5));
        setDraftListings(listings.filter((l) => l.status === 'draft'));
        setAckedAutoIds(new Set(acks));
      })
      .catch((err) => setError(err.message));
  }, []);

  function ackAutoItem(id) {
    api.post('/tasks/acks', { id }).catch(() => {});
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeLabel = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : '';

  if (error) return <p className="text-rose-200">{error}</p>;
  if (!summary) return <p className="text-white/60">Loading…</p>;

  const todayStr = now.toISOString().slice(0, 10);
  const autoItems = [
    ...upcomingPayments
      .filter((p) => p.due_date < todayStr)
      .map((p) => ({
        id: `pay-${p.id}`,
        label: `Rent overdue — ${p.first_name} ${p.last_name}, ${p.property_name} Unit ${p.unit_number}`,
        tone: 'red',
        badge: 'Overdue',
        link: '/payments',
      })),
    ...maintenance
      .filter((m) => m.priority === 'high')
      .map((m) => ({
        id: `maint-${m.id}`,
        label: `${m.title} — ${m.property_name} Unit ${m.unit_number}`,
        tone: 'red',
        badge: 'High priority',
        link: '/maintenance',
      })),
    ...renewals.map((p) => ({
      id: `ins-${p.id}`,
      label: `${p.property_name} — ${p.policy_type === 'homeowner' ? "homeowner's" : 'rental'} insurance renewal`,
      tone: 'amber',
      badge: p.coverage_end < todayStr ? 'Expired' : 'Renew soon',
      link: '/insurance',
    })),
    ...draftListings.map((l) => ({
      id: `list-${l.id}`,
      label: `Finish listing — ${l.title}`,
      tone: 'slate',
      badge: 'Draft',
      link: '/listings',
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {greetingForHour(now.getHours())}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-white/60 text-sm mt-1">A snapshot of your portfolio</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">{dateLabel}</div>
          <div className="text-xs text-white/50 mt-0.5 tabular-nums">{timeLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Properties" value={summary.propertyCount} />
        <StatCard label="Tenants" value={summary.tenantCount} />
        <StatCard label="Active leases" value={summary.activeLeases} />
        <StatCard
          label="Vacancy"
          value={summary.unitVacant}
          sub={`${summary.unitOccupied} occupied of ${summary.unitTotal} unit${summary.unitTotal === 1 ? '' : 's'}`}
        />
        <StatCard label="Collected this month" value={money(summary.monthToDateCollected)} />
        <StatCard label="Overdue payments" value={summary.overdueCount} sub={money(summary.overdueTotal)} />
        <StatCard label="Open maintenance" value={summary.openMaintenance} />
        <RentalInsuranceCard policies={summary.rentalInsurancePolicies} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MyTasksBox autoItems={autoItems} ackedAutoIds={ackedAutoIds} onAckAuto={ackAutoItem} />
        <RentDonut due={summary.monthRentDue} collected={summary.monthRentCollected} remaining={summary.monthRentRemaining} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-medium text-white mb-3">Upcoming payments</h2>
          {upcomingPayments.length === 0 ? (
            <Card className="p-6 text-white/60 text-sm">No pending payments.</Card>
          ) : (
            <Card className="divide-y divide-white/10">
              {upcomingPayments.map((p) => {
                const overdue = p.due_date < now.toISOString().slice(0, 10);
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">
                        {p.first_name} {p.last_name} · {p.property_name} Unit {p.unit_number}
                      </div>
                      <div className="text-sm text-white/60">
                        {money(p.amount)} due {p.due_date}
                      </div>
                    </div>
                    <Badge tone={overdue ? 'red' : 'amber'}>{overdue ? 'Overdue' : 'Due soon'}</Badge>
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <div>
          <h2 className="text-lg font-medium text-white mb-3">Upcoming maintenance</h2>
          {maintenance.length === 0 ? (
            <Card className="p-6 text-white/60 text-sm">No open maintenance requests.</Card>
          ) : (
            <Card className="divide-y divide-white/10">
              {maintenance.map((m) => (
                <div key={m.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{m.title}</div>
                    <div className="text-sm text-white/60">
                      {m.property_name} · Unit {m.unit_number}
                    </div>
                  </div>
                  <Badge tone={m.priority === 'high' ? 'red' : m.priority === 'low' ? 'slate' : 'amber'}>{m.priority}</Badge>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {renewals.length > 0 ? (
        <div>
          <h2 className="text-lg font-medium text-white mb-3">Insurance renewals due soon</h2>
          <Card className="divide-y divide-white/10">
            {renewals.map((p) => {
              const overdue = p.coverage_end < new Date().toISOString().slice(0, 10);
              return (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">
                      {p.property_name} · {p.policy_type === 'homeowner' ? "Homeowner's" : 'Rental'} insurance
                    </div>
                    <div className="text-sm text-white/60">
                      {p.provider} · expires {p.coverage_end}
                    </div>
                  </div>
                  <Badge tone={overdue ? 'red' : 'amber'}>{overdue ? 'Expired' : 'Renew soon'}</Badge>
                </div>
              );
            })}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
