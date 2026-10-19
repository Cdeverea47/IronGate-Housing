import React from 'react';
import { LogoBadge, LogoMark, Wordmark } from './Logo.jsx';

// Shared look for the login / sign-up screens: the app's blue gradient with a
// six big faint IronGate logos scattered around and one bold logo above the
// form card.
// Fixed, scattered positions (percent of the screen) so the layout is stable.
const BIG_LOGOS = [
  { top: '-6%', left: '-5%', size: 300, rotate: -14, opacity: 0.14 },
  { top: '8%', left: '72%', size: 220, rotate: 18, opacity: 0.12 },
  { top: '42%', left: '3%', size: 180, rotate: 9, opacity: 0.12 },
  { top: '58%', left: '80%', size: 340, rotate: -20, opacity: 0.14 },
  { top: '80%', left: '28%', size: 240, rotate: 15, opacity: 0.12 },
  { top: '86%', left: '-4%', size: 200, rotate: -8, opacity: 0.12 },
];

export function AuthShell({ children, wide = false }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-gradient-diagonal text-white flex flex-col items-center justify-center px-4 py-10">
      {/* Six big logos scattered around the edges */}
      {BIG_LOGOS.map((l, i) => (
        <LogoMark
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute text-white"
          style={{ top: l.top, left: l.left, width: l.size, height: l.size, opacity: l.opacity, transform: `rotate(${l.rotate}deg)` }}
        />
      ))}

      {/* The main logo, centered above the card */}
      <div className="relative z-10 flex flex-col items-center gap-3 mb-8">
        <LogoBadge size={88} />
        <span className="text-2xl font-semibold tracking-tight">
          <Wordmark />
        </span>
      </div>

      <div
        className={`relative z-10 w-full ${wide ? 'max-w-md' : 'max-w-sm'} rounded-2xl border border-white/30 bg-white shadow-soft p-8 text-slate-900`}
      >
        {children}
      </div>

      <div className="relative z-10 mt-6 text-sm text-white/70">© {new Date().getFullYear()} IronGate Housing</div>
    </div>
  );
}

// Step 1 of login / sign-up: who are you?
export function RoleChooser({ title, subtitle, onChoose }) {
  const options = [
    { value: 'landlord', label: 'Landlord', hint: 'Manage properties, tenants and rent' },
    { value: 'tenant', label: 'Tenant', hint: 'View your lease, pay rent, request repairs' },
  ];
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900 mb-1">{title}</h1>
      <p className="text-sm text-slate-500 mb-6">{subtitle}</p>
      <div className="space-y-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChoose(o.value)}
            className="w-full text-left rounded-xl border border-slate-200 px-4 py-3.5 hover:border-brand-700 hover:bg-slate-50 transition-colors"
          >
            <div className="font-semibold text-slate-900">I'm a {o.label.toLowerCase()}</div>
            <div className="text-xs text-slate-500 mt-0.5">{o.hint}</div>
          </button>
        ))}
      </div>
    </>
  );
}
