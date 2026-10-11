import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, StatCard, Badge } from '../components/UI.jsx';

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function MonthlyIncomeChart({ monthly }) {
  const max = Math.max(1, ...monthly.map((m) => Math.max(m.due, m.collected)));
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/80">Rent due vs. collected</h3>
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white/25" /> Due
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-white" /> Collected
          </span>
        </div>
      </div>
      <div className="flex items-end gap-3 h-40">
        {monthly.map((m) => (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-full flex items-end justify-center gap-1 h-full">
              <div
                className="w-3 rounded-t bg-white/25"
                style={{ height: `${Math.max(2, (m.due / max) * 100)}%` }}
                title={`Due: ${money(m.due)}`}
              />
              <div
                className="w-3 rounded-t bg-white"
                style={{ height: `${Math.max(2, (m.collected / max) * 100)}%` }}
                title={`Collected: ${money(m.collected)}`}
              />
            </div>
            <div className="mt-2 text-[11px] text-white/50 whitespace-nowrap">{m.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OccupancyChart({ monthly }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium text-white/80 mb-4">Occupancy rate</h3>
      <div className="flex items-end gap-3 h-40">
        {monthly.map((m) => (
          <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="text-[11px] text-white/60 mb-1">{m.occupancyRate}%</div>
            <div className="w-full flex items-end justify-center h-full">
              <div
                className="w-5 rounded-t bg-emerald-300/70"
                style={{ height: `${Math.max(2, m.occupancyRate)}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-white/50 whitespace-nowrap">{m.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Performance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/performance')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-rose-200">{error}</p>;
  if (!data) return <p className="text-white/60">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Performance</h1>
        <p className="text-white/60 text-sm mt-1">Last 6 months across your portfolio</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Collection rate"
          value={data.collectionRate === null ? '—' : `${data.collectionRate}%`}
          sub="collected vs. due"
        />
        <StatCard label="Total collected" value={money(data.windowCollected)} />
        <StatCard label="Total due" value={money(data.windowDue)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyIncomeChart monthly={data.monthly} />
        <OccupancyChart monthly={data.monthly} />
      </div>

      <div>
        <h2 className="text-lg font-medium text-white mb-3">By property</h2>
        {data.properties.length === 0 ? (
          <Card className="p-6 text-white/60 text-sm">No properties yet.</Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/50 text-xs uppercase tracking-wide border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Occupancy</th>
                  <th className="px-4 py-3 font-medium">Total collected</th>
                  <th className="px-4 py-3 font-medium">Open maintenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.properties.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-3 text-white/70">
                      {p.occupiedCount}/{p.unitCount} · {p.occupancyRate}%
                    </td>
                    <td className="px-4 py-3 text-white/70">{money(p.totalCollected)}</td>
                    <td className="px-4 py-3">
                      {p.openMaintenance > 0 ? (
                        <Badge tone="amber">{p.openMaintenance} open</Badge>
                      ) : (
                        <span className="text-white/40">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
