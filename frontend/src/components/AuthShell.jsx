import React from 'react';
import { LogoBadge, LogoMark, Wordmark } from './Logo.jsx';

// Shared look for the login / sign-up screens: the app's blue gradient with a
// large, faint IronGate logo in the background and the form in a centered card.
export function AuthShell({ children, wide = false }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-gradient-diagonal text-white flex flex-col items-center justify-center px-4 py-10">
      {/* Background logo */}
      <LogoMark className="pointer-events-none absolute -right-24 -bottom-24 h-[560px] w-[560px] text-white opacity-10" />
      <LogoMark className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] text-white opacity-[0.07]" />

      <div className="relative z-10 flex items-center gap-2.5 mb-6">
        <LogoBadge size={40} />
        <span className="text-xl font-semibold tracking-tight">
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
