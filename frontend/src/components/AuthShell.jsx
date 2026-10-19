import React from 'react';
import { LogoBadge, LogoMark, Wordmark } from './Logo.jsx';

// Shared look for the login / sign-up screens: the app's blue gradient with a
// field of faint IronGate logos filling the screen and one bold logo above the
// form card.
export function AuthShell({ children, wide = false }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-gradient-diagonal text-white flex flex-col items-center justify-center px-4 py-10">
      {/* Tiled background of faint logos (alternating tilt) filling the screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid text-white"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gridAutoRows: '110px' }}
      >
        {Array.from({ length: 140 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            <LogoMark
              className={`h-12 w-12 opacity-[0.12] ${i % 2 === 0 ? 'rotate-[-12deg]' : 'rotate-[12deg]'}`}
            />
          </div>
        ))}
      </div>

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
